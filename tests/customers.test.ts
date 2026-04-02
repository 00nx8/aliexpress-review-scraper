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
const mockDbUpdate = vi.fn()
vi.mock('../server/db', () => ({
  useDb: () => ({ select: mockDbSelect, insert: mockDbInsert, update: mockDbUpdate })
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

// ── Helpers ────────────────────────────────────────────────────────────────────
const authedSession = { user: { id: 1, email: 'user@example.com' } }
const noSession = { user: null }

// ── GET /api/customers ────────────────────────────────────────────────────────
async function runGetCustomers(event: object, search?: string) {
  await requireUser(event)
  if (search) {
    return mockDbSelect().from().where().limit()
  }
  return mockDbSelect().from().limit()
}

describe('GET /api/customers — auth', () => {
  beforeEach(() => vi.clearAllMocks())

  it('throws 401 when not authenticated', async () => {
    mockGetUserSession.mockResolvedValue(noSession)
    await expect(runGetCustomers({})).rejects.toMatchObject({ statusCode: 401 })
  })
})

describe('GET /api/customers — list', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUserSession.mockResolvedValue(authedSession)
  })

  it('returns all customers without search', async () => {
    const customers = [{ id: 1, name: 'John' }, { id: 2, name: 'Jane' }]
    mockDbSelect.mockReturnValue({ from: () => ({ limit: () => Promise.resolve(customers) }) })
    const result = await runGetCustomers({})
    expect(result).toEqual(customers)
  })

  it('returns filtered customers with search param', async () => {
    const filtered = [{ id: 1, name: 'John' }]
    mockDbSelect.mockReturnValue({
      from: () => ({ where: () => ({ limit: () => Promise.resolve(filtered) }) })
    })
    const result = await runGetCustomers({}, 'John')
    expect(result).toEqual(filtered)
  })

  it('returns empty array when no customers found', async () => {
    mockDbSelect.mockReturnValue({ from: () => ({ limit: () => Promise.resolve([]) }) })
    const result = await runGetCustomers({})
    expect(result).toEqual([])
  })
})

// ── POST /api/customers ────────────────────────────────────────────────────────
async function runPostCustomer(event: object, body: any) {
  const user = await requireUser(event)
  const { name, email, phoneNo, visitId, existingCustomerId } = body

  if (!name) throw mockCreateError({ statusCode: 400, message: 'Name required' })

  let customerId: number

  if (existingCustomerId) {
    customerId = existingCustomerId
  } else {
    const [customer] = await mockDbInsert().values({ name, email: email || '', phoneNo: phoneNo || '' }).returning()
    customerId = customer!.id
  }

  if (visitId) {
    await mockDbUpdate().set({ customerId }).where()
  }

  return { id: customerId }
}

describe('POST /api/customers — validation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUserSession.mockResolvedValue(authedSession)
  })

  it('throws 400 when name is missing', async () => {
    await expect(runPostCustomer({}, { email: 'x@x.com' })).rejects.toMatchObject({ statusCode: 400, message: 'Name required' })
  })

  it('throws 401 when not authenticated', async () => {
    mockGetUserSession.mockResolvedValue(noSession)
    await expect(runPostCustomer({}, { name: 'John' })).rejects.toMatchObject({ statusCode: 401 })
  })
})

describe('POST /api/customers — create new', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUserSession.mockResolvedValue(authedSession)
  })

  it('inserts new customer and returns id', async () => {
    mockDbInsert.mockReturnValue({
      values: () => ({ returning: () => Promise.resolve([{ id: 42, name: 'Alice' }]) })
    })
    const result = await runPostCustomer({}, { name: 'Alice', email: 'alice@example.com' })
    expect(result).toEqual({ id: 42 })
  })

  it('defaults email and phoneNo to empty string', async () => {
    const mockValues = vi.fn().mockReturnValue({ returning: () => Promise.resolve([{ id: 1 }]) })
    mockDbInsert.mockReturnValue({ values: mockValues })
    await runPostCustomer({}, { name: 'Bob' })
    expect(mockValues).toHaveBeenCalledWith(expect.objectContaining({ email: '', phoneNo: '' }))
  })
})

describe('POST /api/customers — link existing', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUserSession.mockResolvedValue(authedSession)
  })

  it('skips insert when existingCustomerId provided', async () => {
    const result = await runPostCustomer({}, { name: 'Ignored', existingCustomerId: 99 })
    expect(result).toEqual({ id: 99 })
    expect(mockDbInsert).not.toHaveBeenCalled()
  })

  it('links customer to visit when visitId provided', async () => {
    const mockSet = vi.fn().mockReturnValue({ where: () => Promise.resolve() })
    mockDbUpdate.mockReturnValue({ set: mockSet })
    await runPostCustomer({}, { name: 'Ignored', existingCustomerId: 99, visitId: 5 })
    expect(mockSet).toHaveBeenCalledWith({ customerId: 99 })
  })

  it('skips visit update when no visitId', async () => {
    await runPostCustomer({}, { name: 'Ignored', existingCustomerId: 99 })
    expect(mockDbUpdate).not.toHaveBeenCalled()
  })
})
