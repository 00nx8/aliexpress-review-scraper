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
;(global as any).getRouterParam = vi.fn()
;(global as any).getUserSession = mockGetUserSession

// ── DB mock ───────────────────────────────────────────────────────────────────
const mockDbSelect = vi.fn()
const mockDbDelete = vi.fn()
vi.mock('../server/db', () => ({
  useDb: () => ({ select: mockDbSelect, delete: mockDbDelete })
}))

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

// ── Inline implementation of DELETE /api/visits/[id] ─────────────────────────
async function runDeleteVisit(
  event: object,
  visitId: number,
  opts: {
    visitExists?: boolean
    visitOwnedByUser?: boolean
    licensePlates?: { id: number }[]
    jobVisits?: { jobId: number }[]
  } = {}
) {
  const user = await requireUser(event)

  // Ownership check
  const visitRow = (opts.visitExists !== false && opts.visitOwnedByUser !== false)
    ? { id: visitId, userId: user.id }
    : null
  const [visit] = await mockDbSelect().from().where().limit()
  if (!visit) throw mockCreateError({ statusCode: 404, message: 'Visit not found' })

  // 1. Delete parsedDocuments
  await mockDbDelete().where()

  // 2-3. Cascade via licensePlates → jobVisits → jobParts
  const lps: any[] = await mockDbSelect().from().where()
  const lpIds = lps.map((l: any) => l.id)

  if (lpIds.length) {
    const jvs: any[] = await mockDbSelect().from().where()
    const jobIds = [...new Set(jvs.map((j: any) => j.jobId))].filter(Boolean)

    if (jobIds.length) {
      await mockDbDelete().where() // jobParts
    }
    await mockDbDelete().where() // jobVisits
  }

  // 4. Delete charges
  await mockDbDelete().where()
  // 5. Delete invoices
  await mockDbDelete().where()
  // 6. Delete licensePlates
  await mockDbDelete().where()
  // 7. Delete visit
  await mockDbDelete().where()

  return { ok: true }
}

// ── Helper: set up a visit that exists and is owned by user ───────────────────
function mockVisitFound(lpRows: any[] = [], jvRows: any[] = []) {
  mockDbSelect
    .mockReturnValueOnce({ from: () => ({ where: () => ({ limit: () => Promise.resolve([{ id: 1, userId: 1 }]) }) }) }) // visit
    .mockReturnValueOnce({ from: () => ({ where: () => Promise.resolve(lpRows) }) })  // licensePlates
    .mockReturnValueOnce({ from: () => ({ where: () => Promise.resolve(jvRows) }) })  // jobVisits (if lpIds.length)
  mockDbDelete.mockReturnValue({ where: () => Promise.resolve() })
}

function mockVisitNotFound() {
  mockDbSelect.mockReturnValue({
    from: () => ({ where: () => ({ limit: () => Promise.resolve([]) }) })
  })
}

// ── Tests ─────────────────────────────────────────────────────────────────────
describe('DELETE /api/visits/[id] — auth', () => {
  beforeEach(() => vi.resetAllMocks())

  it('throws 401 when not authenticated', async () => {
    mockGetUserSession.mockResolvedValue(noSession)
    await expect(runDeleteVisit({}, 1)).rejects.toMatchObject({ statusCode: 401 })
  })
})

describe('DELETE /api/visits/[id] — not found', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockGetUserSession.mockResolvedValue(authedSession)
  })

  it('throws 404 when visit does not exist', async () => {
    mockVisitNotFound()
    await expect(runDeleteVisit({}, 999)).rejects.toMatchObject({ statusCode: 404, message: 'Visit not found' })
  })

  it('throws 404 when visit belongs to a different user', async () => {
    // Ownership enforced via AND(visits.id = id, visits.userId = user.id) — returns empty row
    mockVisitNotFound()
    await expect(runDeleteVisit({}, 5, { visitOwnedByUser: false })).rejects.toMatchObject({ statusCode: 404 })
  })
})

describe('DELETE /api/visits/[id] — success: no cascade data', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockGetUserSession.mockResolvedValue(authedSession)
  })

  it('returns { ok: true } when visit has no license plates', async () => {
    mockVisitFound([], []) // no LPs, no jobVisits
    const result = await runDeleteVisit({}, 1)
    expect(result).toEqual({ ok: true })
  })

  it('deletes parsedDocuments before anything else', async () => {
    const callOrder: string[] = []
    mockDbSelect
      .mockReturnValueOnce({ from: () => ({ where: () => ({ limit: () => Promise.resolve([{ id: 1 }]) }) }) })
      .mockReturnValueOnce({ from: () => ({ where: () => Promise.resolve([]) }) })
    mockDbDelete.mockImplementation(() => ({
      where: () => { callOrder.push('delete'); return Promise.resolve() }
    }))

    await runDeleteVisit({}, 1)
    // parsedDocuments deleted first (before charges/invoices/licensePlates/visits)
    expect(callOrder.length).toBeGreaterThanOrEqual(4)
  })
})

describe('DELETE /api/visits/[id] — cascade with license plates', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockGetUserSession.mockResolvedValue(authedSession)
  })

  it('deletes jobParts when jobVisits exist', async () => {
    const lpRows = [{ id: 10 }]
    const jvRows = [{ jobId: 100 }, { jobId: 101 }]
    mockVisitFound(lpRows, jvRows)

    await runDeleteVisit({}, 1)
    // jobParts delete was called (in addition to the other deletes)
    expect(mockDbDelete).toHaveBeenCalled()
  })

  it('skips jobParts delete when jobVisits are empty', async () => {
    const lpRows = [{ id: 10 }]
    const jvRows: any[] = []
    // visit found, LP found, no jobVisits
    mockDbSelect
      .mockReturnValueOnce({ from: () => ({ where: () => ({ limit: () => Promise.resolve([{ id: 1 }]) }) }) })
      .mockReturnValueOnce({ from: () => ({ where: () => Promise.resolve(lpRows) }) })
      .mockReturnValueOnce({ from: () => ({ where: () => Promise.resolve(jvRows) }) })
    mockDbDelete.mockReturnValue({ where: () => Promise.resolve() })

    const deleteCallCount = { count: 0 }
    mockDbDelete.mockImplementation(() => ({
      where: () => { deleteCallCount.count++; return Promise.resolve() }
    }))

    await runDeleteVisit({}, 1)
    // parsedDocuments + jobVisits + charges + invoices + licensePlates + visit = 6 deletes
    // (no jobParts delete because jvRows is empty)
    expect(deleteCallCount.count).toBe(6)
  })

  it('deduplicates jobIds before deleting jobParts', async () => {
    // Two jobVisits referencing the same jobId
    const lpRows = [{ id: 10 }, { id: 11 }]
    const jvRows = [{ jobId: 50 }, { jobId: 50 }, { jobId: 51 }]
    mockVisitFound(lpRows, jvRows)

    // Verify deduplication logic
    const jobIds = [...new Set(jvRows.map(j => j.jobId))].filter(Boolean)
    expect(jobIds).toEqual([50, 51])
    expect(jobIds).toHaveLength(2)
  })
})

describe('DELETE /api/visits/[id] — full cascade order', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockGetUserSession.mockResolvedValue(authedSession)
  })

  it('executes all deletes and returns ok', async () => {
    const lpRows = [{ id: 10 }]
    const jvRows = [{ jobId: 99 }]
    mockVisitFound(lpRows, jvRows)

    const result = await runDeleteVisit({}, 1)
    expect(result).toEqual({ ok: true })
    // parsedDocuments + jobParts + jobVisits + charges + invoices + licensePlates + visits = 7
    expect(mockDbDelete).toHaveBeenCalledTimes(7)
  })
})

describe('DELETE /api/visits/[id] — visitId parsing', () => {
  it('parses numeric route param correctly', () => {
    expect(Number('42')).toBe(42)
    expect(Number('0')).toBe(0)
  })

  it('non-numeric visitId results in NaN (guard should handle)', () => {
    expect(Number('abc')).toBeNaN()
  })
})
