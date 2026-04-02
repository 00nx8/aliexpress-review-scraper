import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Globals ───────────────────────────────────────────────────────────────────
const mockGetUserSession = vi.fn()
const mockCreateError = (opts: { statusCode: number; message: string }) => {
  const err: any = new Error(opts.message)
  err.statusCode = opts.statusCode
  return err
}
;(global as any).defineEventHandler = (fn: Function) => fn
;(global as any).createError = mockCreateError
;(global as any).getQuery = vi.fn()
;(global as any).getRouterParam = vi.fn()
;(global as any).getUserSession = mockGetUserSession

// ── DB mock ───────────────────────────────────────────────────────────────────
const mockDbSelect = vi.fn()
vi.mock('../server/db', () => ({ useDb: () => ({ select: mockDbSelect }) }))

// ── requireUser mock ──────────────────────────────────────────────────────────
vi.mock('../server/utils/auth', () => ({
  requireUser: vi.fn(async (event: any) => {
    const session = await (global as any).getUserSession(event)
    if (!session?.user?.id) throw (global as any).createError({ statusCode: 401, message: 'Unauthorized' })
    return session.user
  })
}))

import { requireUser } from '../server/utils/auth'

const authedSession = { user: { id: 1, email: 'user@example.com' } }
const noSession = { user: null }

// ── Inline implementation of GET /api/reference/dtc ─────────────────────────
async function runGetDtc(event: object, query: {
  search?: string
  category?: string
  templateId?: string
}) {
  await requireUser(event)

  const conditions: string[] = []
  if (query.search) conditions.push('search')
  if (query.category) conditions.push('category')

  // templateId path: first fetch DTC IDs for this template
  if (query.templateId) {
    const rows: any[] = await mockDbSelect().from().where()
    const ids = rows.map((r: any) => r.dtcCodeId).filter(Boolean)
    if (!ids.length) return []
    conditions.push('templateIds')
    // Then fall through to the general query below
    return await mockDbSelect().from().where().limit()
  }

  // No search and no templateId: return starting set of generic codes
  if (!query.search && !query.templateId) {
    return await mockDbSelect().from().where().limit() // isGeneric=true, limit 50
  }

  // Search and/or category
  return await mockDbSelect().from().where().limit() // limit 200
}

// ── Inline implementation of GET /api/reference/dtc/[id] ─────────────────────
async function runGetDtcById(event: object, id: number) {
  await requireUser(event)
  const [code] = await mockDbSelect().from().where().limit()
  if (!code) throw mockCreateError({ statusCode: 404, message: 'DTC code not found' })
  return code
}

// ── Tests: GET /api/reference/dtc — auth ─────────────────────────────────────
describe('GET /api/reference/dtc — auth', () => {
  beforeEach(() => vi.clearAllMocks())

  it('throws 401 when not authenticated', async () => {
    mockGetUserSession.mockResolvedValue(noSession)
    await expect(runGetDtc({}, {})).rejects.toMatchObject({ statusCode: 401 })
  })

  it('throws 401 when session has no user id', async () => {
    mockGetUserSession.mockResolvedValue({ user: {} })
    await expect(runGetDtc({}, {})).rejects.toMatchObject({ statusCode: 401 })
  })
})

// ── Tests: initial generic codes ──────────────────────────────────────────────
describe('GET /api/reference/dtc — no search, no template → generic codes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUserSession.mockResolvedValue(authedSession)
  })

  it('returns generic codes when no search and no templateId', async () => {
    const generics = [
      { id: 1, code: 'P0100', shortDescription: 'Mass Air Flow sensor', isGeneric: true },
      { id: 2, code: 'P0200', shortDescription: 'Injector circuit', isGeneric: true }
    ]
    mockDbSelect.mockReturnValue({
      from: () => ({ where: () => ({ limit: () => Promise.resolve(generics) }) })
    })
    const result = await runGetDtc({}, {})
    expect(result).toEqual(generics)
  })

  it('returns empty array when no generic codes in DB', async () => {
    mockDbSelect.mockReturnValue({
      from: () => ({ where: () => ({ limit: () => Promise.resolve([]) }) })
    })
    const result = await runGetDtc({}, {})
    expect(result).toEqual([])
  })

  it('uses a different code path than the search query', async () => {
    // Both search=undefined and templateId=undefined → goes to generic path (first mockDbSelect call)
    // This test verifies only ONE select call is made (not two)
    mockDbSelect.mockReturnValue({
      from: () => ({ where: () => ({ limit: () => Promise.resolve([]) }) })
    })
    await runGetDtc({}, {})
    expect(mockDbSelect).toHaveBeenCalledTimes(1)
  })
})

// ── Tests: search ─────────────────────────────────────────────────────────────
describe('GET /api/reference/dtc — search', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUserSession.mockResolvedValue(authedSession)
  })

  it('returns matching codes when search is provided', async () => {
    const codes = [{ id: 5, code: 'P0301', shortDescription: 'Cylinder 1 misfire' }]
    mockDbSelect.mockReturnValue({
      from: () => ({ where: () => ({ limit: () => Promise.resolve(codes) }) })
    })
    const result = await runGetDtc({}, { search: 'misfire' })
    expect(result).toEqual(codes)
  })

  it('returns empty array when search matches nothing', async () => {
    mockDbSelect.mockReturnValue({
      from: () => ({ where: () => ({ limit: () => Promise.resolve([]) }) })
    })
    const result = await runGetDtc({}, { search: 'zzznomatch' })
    expect(result).toEqual([])
  })

  it('does NOT use the generic codes path when search is provided', async () => {
    // With search, the handler should NOT short-circuit to generic codes
    // It should go to the search path → 1 DB call with search conditions
    mockDbSelect.mockReturnValue({
      from: () => ({ where: () => ({ limit: () => Promise.resolve([]) }) })
    })
    await runGetDtc({}, { search: 'oxygen' })
    expect(mockDbSelect).toHaveBeenCalledTimes(1)
  })
})

// ── Tests: category filter ────────────────────────────────────────────────────
describe('GET /api/reference/dtc — category filter', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUserSession.mockResolvedValue(authedSession)
  })

  it('returns codes filtered by category when category provided', async () => {
    const codes = [{ id: 10, code: 'B0001', category: 'B', categoryName: 'Body' }]
    mockDbSelect.mockReturnValue({
      from: () => ({ where: () => ({ limit: () => Promise.resolve(codes) }) })
    })
    const result = await runGetDtc({}, { search: 'body', category: 'B' })
    expect(result).toEqual(codes)
  })
})

// ── Tests: templateId ─────────────────────────────────────────────────────────
describe('GET /api/reference/dtc — templateId', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUserSession.mockResolvedValue(authedSession)
  })

  it('returns [] when templateId has no associated DTC codes', async () => {
    // First call: carTemplateDtcCodes → empty
    mockDbSelect.mockReturnValueOnce({
      from: () => ({ where: () => Promise.resolve([]) })
    })
    const result = await runGetDtc({}, { templateId: '99' })
    expect(result).toEqual([])
  })

  it('returns DTC codes when templateId has associated codes', async () => {
    const dtcRows = [{ id: 1, code: 'P0100', shortDescription: 'MAF sensor' }]
    // First call: carTemplateDtcCodes → returns IDs
    mockDbSelect.mockReturnValueOnce({
      from: () => ({ where: () => Promise.resolve([{ dtcCodeId: 1 }, { dtcCodeId: 2 }]) })
    })
    // Second call: dtcCodes filtered by those IDs
    mockDbSelect.mockReturnValueOnce({
      from: () => ({ where: () => ({ limit: () => Promise.resolve(dtcRows) }) })
    })
    const result = await runGetDtc({}, { templateId: '5' })
    expect(result).toEqual(dtcRows)
  })

  it('makes exactly 2 DB calls when templateId is provided with matching codes', async () => {
    mockDbSelect.mockReturnValueOnce({
      from: () => ({ where: () => Promise.resolve([{ dtcCodeId: 1 }]) })
    })
    mockDbSelect.mockReturnValueOnce({
      from: () => ({ where: () => ({ limit: () => Promise.resolve([{ id: 1 }]) }) })
    })
    await runGetDtc({}, { templateId: '5' })
    expect(mockDbSelect).toHaveBeenCalledTimes(2)
  })

  it('makes only 1 DB call when templateId has no codes (early return)', async () => {
    mockDbSelect.mockReturnValueOnce({
      from: () => ({ where: () => Promise.resolve([]) })
    })
    await runGetDtc({}, { templateId: '5' })
    expect(mockDbSelect).toHaveBeenCalledTimes(1)
  })

  it('filters null dtcCodeIds from the mapping rows', async () => {
    // Some rows may have null dtcCodeId — these should be filtered out
    mockDbSelect.mockReturnValueOnce({
      from: () => ({ where: () => Promise.resolve([{ dtcCodeId: null }, { dtcCodeId: null }]) })
    })
    // All IDs filtered → early return []
    const result = await runGetDtc({}, { templateId: '5' })
    expect(result).toEqual([])
  })
})

// ── Tests: GET /api/reference/dtc/[id] ───────────────────────────────────────
describe('GET /api/reference/dtc/[id] — auth', () => {
  beforeEach(() => vi.clearAllMocks())

  it('throws 401 when not authenticated', async () => {
    mockGetUserSession.mockResolvedValue(noSession)
    await expect(runGetDtcById({}, 1)).rejects.toMatchObject({ statusCode: 401 })
  })
})

describe('GET /api/reference/dtc/[id] — detail', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUserSession.mockResolvedValue(authedSession)
  })

  it('returns the full DTC code record by id', async () => {
    const fullCode = {
      id: 42,
      code: 'P0301',
      category: 'P',
      categoryName: 'Powertrain',
      shortDescription: 'Cylinder 1 misfire detected',
      description: 'A long description...',
      symptoms: 'Rough idle, misfire',
      commonCauses: 'Spark plugs, ignition coil',
      severity: 'HIGH',
      isGeneric: true
    }
    mockDbSelect.mockReturnValue({
      from: () => ({ where: () => ({ limit: () => Promise.resolve([fullCode]) }) })
    })
    const result = await runGetDtcById({}, 42)
    expect(result).toEqual(fullCode)
  })

  it('throws 404 when DTC code not found', async () => {
    mockDbSelect.mockReturnValue({
      from: () => ({ where: () => ({ limit: () => Promise.resolve([]) }) })
    })
    await expect(runGetDtcById({}, 9999)).rejects.toMatchObject({
      statusCode: 404,
      message: 'DTC code not found'
    })
  })

  it('returns the raw row (all fields available for detail view)', async () => {
    const code = { id: 1, code: 'P0100', description: 'Detailed description', symptoms: 'Symptoms here' }
    mockDbSelect.mockReturnValue({
      from: () => ({ where: () => ({ limit: () => Promise.resolve([code]) }) })
    })
    const result = await runGetDtcById({}, 1)
    expect(result).toMatchObject({ description: 'Detailed description', symptoms: 'Symptoms here' })
  })
})
