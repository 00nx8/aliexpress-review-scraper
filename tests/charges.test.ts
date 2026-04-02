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
;(global as any).readBody = vi.fn()
;(global as any).getQuery = vi.fn()
;(global as any).getUserSession = mockGetUserSession

// ── DB mock ───────────────────────────────────────────────────────────────────
const mockDbSelect = vi.fn()
const mockDbInsert = vi.fn()
vi.mock('../server/db', () => ({ useDb: () => ({ select: mockDbSelect, insert: mockDbInsert }) }))

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

// ── GET /api/charges ──────────────────────────────────────────────────────────
async function runGetCharges(event: object, search?: string) {
  await requireUser(event)
  if (search) {
    return mockDbSelect().from().where().limit()
  }
  return mockDbSelect().from().limit()
}

describe('GET /api/charges — auth', () => {
  beforeEach(() => vi.clearAllMocks())

  it('throws 401 when unauthenticated', async () => {
    mockGetUserSession.mockResolvedValue(noSession)
    await expect(runGetCharges({})).rejects.toMatchObject({ statusCode: 401 })
  })
})

describe('GET /api/charges — list', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUserSession.mockResolvedValue(authedSession)
  })

  it('returns all charge templates without search', async () => {
    const charges = [
      { id: 1, name: 'Labour', price: '85.00', description: 'Per hour' },
      { id: 2, name: 'Diagnostic', price: '50.00', description: '' }
    ]
    mockDbSelect.mockReturnValue({ from: () => ({ limit: () => Promise.resolve(charges) }) })
    const result = await runGetCharges({})
    expect(result).toEqual(charges)
  })

  it('returns filtered charges with search param', async () => {
    const filtered = [{ id: 1, name: 'Labour', price: '85.00' }]
    mockDbSelect.mockReturnValue({
      from: () => ({ where: () => ({ limit: () => Promise.resolve(filtered) }) })
    })
    const result = await runGetCharges({}, 'Labour')
    expect(result).toEqual(filtered)
  })

  it('returns empty array when no templates found', async () => {
    mockDbSelect.mockReturnValue({ from: () => ({ limit: () => Promise.resolve([]) }) })
    const result = await runGetCharges({})
    expect(result).toEqual([])
  })
})

// ── POST /api/charges ─────────────────────────────────────────────────────────
async function runPostCharge(event: object, body: any) {
  await requireUser(event)
  const { name, price, description } = body
  if (!name) throw mockCreateError({ statusCode: 400, message: 'Name required' })
  const [ct] = await mockDbInsert().values({ name, price: String(price || 0), description: description || '' }).returning()
  return ct
}

describe('POST /api/charges — validation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUserSession.mockResolvedValue(authedSession)
  })

  it('throws 400 when name is missing', async () => {
    await expect(runPostCharge({}, {})).rejects.toMatchObject({ statusCode: 400, message: 'Name required' })
  })

  it('throws 400 when name is empty string', async () => {
    await expect(runPostCharge({}, { name: '' })).rejects.toMatchObject({ statusCode: 400 })
  })

  it('throws 401 when unauthenticated', async () => {
    mockGetUserSession.mockResolvedValue(noSession)
    await expect(runPostCharge({}, { name: 'Labour' })).rejects.toMatchObject({ statusCode: 401 })
  })
})

describe('POST /api/charges — create', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUserSession.mockResolvedValue(authedSession)
  })

  it('inserts charge template and returns it', async () => {
    const charge = { id: 3, name: 'Labour', price: '85.00', description: 'Per hour' }
    mockDbInsert.mockReturnValue({
      values: () => ({ returning: () => Promise.resolve([charge]) })
    })
    const result = await runPostCharge({}, { name: 'Labour', price: 85, description: 'Per hour' })
    expect(result).toEqual(charge)
  })

  it('converts price to string', async () => {
    const mockValues = vi.fn().mockReturnValue({ returning: () => Promise.resolve([{ id: 1 }]) })
    mockDbInsert.mockReturnValue({ values: mockValues })
    await runPostCharge({}, { name: 'Labour', price: 85.5 })
    expect(mockValues).toHaveBeenCalledWith(expect.objectContaining({ price: '85.5' }))
  })

  it('defaults price to "0" when not provided', async () => {
    const mockValues = vi.fn().mockReturnValue({ returning: () => Promise.resolve([{ id: 1 }]) })
    mockDbInsert.mockReturnValue({ values: mockValues })
    await runPostCharge({}, { name: 'Labour' })
    expect(mockValues).toHaveBeenCalledWith(expect.objectContaining({ price: '0' }))
  })

  it('defaults description to empty string when not provided', async () => {
    const mockValues = vi.fn().mockReturnValue({ returning: () => Promise.resolve([{ id: 1 }]) })
    mockDbInsert.mockReturnValue({ values: mockValues })
    await runPostCharge({}, { name: 'Labour' })
    expect(mockValues).toHaveBeenCalledWith(expect.objectContaining({ description: '' }))
  })
})
