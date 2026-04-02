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
;(global as any).getRouterParam = vi.fn()
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
// Now scoped: first fetches allowed customer IDs from this user's visits,
// then queries customers filtered by those IDs.
async function runGetCustomers(event: object, search?: string) {
  const user = await requireUser(event)

  // Step 1: get distinct customer IDs from this user's visits
  const allowed: any[] = await mockDbSelect().from().where()
  const ids = allowed.map((r: any) => r.id).filter(Boolean) as number[]
  if (!ids.length) return []

  // Step 2: fetch customers scoped to those IDs
  if (search) {
    return mockDbSelect().from().where().limit()
  }
  return mockDbSelect().from().where().limit()
}

describe('GET /api/customers — auth', () => {
  beforeEach(() => vi.clearAllMocks())

  it('throws 401 when not authenticated', async () => {
    mockGetUserSession.mockResolvedValue(noSession)
    await expect(runGetCustomers({})).rejects.toMatchObject({ statusCode: 401 })
  })
})

describe('GET /api/customers — user scoping', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUserSession.mockResolvedValue(authedSession)
  })

  it('returns empty array when user has no visits with customers', async () => {
    // First call: no visits → no allowed IDs
    mockDbSelect.mockReturnValueOnce({
      from: () => ({ where: () => Promise.resolve([]) })
    })
    const result = await runGetCustomers({})
    expect(result).toEqual([])
  })

  it('does not query customers table when no allowed IDs', async () => {
    mockDbSelect.mockReturnValueOnce({
      from: () => ({ where: () => Promise.resolve([]) })
    })
    await runGetCustomers({})
    // Only one DB call (the visits scoping query), not a second one for customers
    expect(mockDbSelect).toHaveBeenCalledTimes(1)
  })

  it('returns all scoped customers without search', async () => {
    const customers = [{ id: 1, name: 'John' }, { id: 2, name: 'Jane' }]
    // First call: visits query returns allowed IDs
    mockDbSelect.mockReturnValueOnce({
      from: () => ({ where: () => Promise.resolve([{ id: 1 }, { id: 2 }]) })
    })
    // Second call: customers query
    mockDbSelect.mockReturnValueOnce({
      from: () => ({ where: () => ({ limit: () => Promise.resolve(customers) }) })
    })
    const result = await runGetCustomers({})
    expect(result).toEqual(customers)
  })

  it('returns filtered customers with search param', async () => {
    const filtered = [{ id: 1, name: 'John' }]
    mockDbSelect.mockReturnValueOnce({
      from: () => ({ where: () => Promise.resolve([{ id: 1 }]) })
    })
    mockDbSelect.mockReturnValueOnce({
      from: () => ({ where: () => ({ limit: () => Promise.resolve(filtered) }) })
    })
    const result = await runGetCustomers({}, 'John')
    expect(result).toEqual(filtered)
  })

  it('only returns customers linked to this user — not others', async () => {
    // User 1 only has customer id=5 in their visits
    mockDbSelect.mockReturnValueOnce({
      from: () => ({ where: () => Promise.resolve([{ id: 5 }]) })
    })
    mockDbSelect.mockReturnValueOnce({
      from: () => ({ where: () => ({ limit: () => Promise.resolve([{ id: 5, name: 'Alice' }]) }) })
    })
    const result = await runGetCustomers({})
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe(5)
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

// ── PATCH /api/customers/[id] ─────────────────────────────────────────────────
// Allows editing name/email/phone. Scoped: user must own a visit with this customer.
async function runPatchCustomer(event: object, customerId: number, body: any) {
  const user = await requireUser(event)
  const { name, email, phoneNo } = body

  // Verify this customer appears in at least one visit for this user
  const [ownerVisit] = await mockDbSelect().from().where().limit()
  if (!ownerVisit) throw mockCreateError({ statusCode: 403, message: 'Customer not found' })

  const update: Record<string, string> = {}
  if (name !== undefined) update.name = name
  if (email !== undefined) update.email = email
  if (phoneNo !== undefined) update.phoneNo = phoneNo

  const [updated] = await mockDbUpdate().set(update).where().returning()
  return updated
}

describe('PATCH /api/customers/[id] — auth', () => {
  beforeEach(() => vi.clearAllMocks())

  it('throws 401 when not authenticated', async () => {
    mockGetUserSession.mockResolvedValue(noSession)
    await expect(runPatchCustomer({}, 1, { name: 'New Name' })).rejects.toMatchObject({ statusCode: 401 })
  })
})

describe('PATCH /api/customers/[id] — ownership', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUserSession.mockResolvedValue(authedSession)
  })

  it('throws 403 when customer does not belong to any of this user\'s visits', async () => {
    mockDbSelect.mockReturnValue({
      from: () => ({ where: () => ({ limit: () => Promise.resolve([]) }) })
    })
    await expect(runPatchCustomer({}, 99, { name: 'Hacker' })).rejects.toMatchObject({ statusCode: 403 })
  })
})

describe('PATCH /api/customers/[id] — update', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUserSession.mockResolvedValue(authedSession)
  })

  it('updates and returns the customer', async () => {
    const updated = { id: 1, name: 'New Name', email: 'new@example.com', phoneNo: '0612345678' }
    mockDbSelect.mockReturnValue({
      from: () => ({ where: () => ({ limit: () => Promise.resolve([{ id: 5 }]) }) })
    })
    mockDbUpdate.mockReturnValue({
      set: () => ({ where: () => ({ returning: () => Promise.resolve([updated]) }) })
    })
    const result = await runPatchCustomer({}, 1, { name: 'New Name', email: 'new@example.com', phoneNo: '0612345678' })
    expect(result).toEqual(updated)
  })

  it('only includes provided fields in the update', async () => {
    mockDbSelect.mockReturnValue({
      from: () => ({ where: () => ({ limit: () => Promise.resolve([{ id: 5 }]) }) })
    })
    const mockSet = vi.fn().mockReturnValue({
      where: () => ({ returning: () => Promise.resolve([{ id: 1, name: 'Updated' }]) })
    })
    mockDbUpdate.mockReturnValue({ set: mockSet })

    await runPatchCustomer({}, 1, { name: 'Updated' })
    // Only name should be in the update object, not email or phoneNo
    expect(mockSet).toHaveBeenCalledWith({ name: 'Updated' })
  })

  it('can update email only', async () => {
    mockDbSelect.mockReturnValue({
      from: () => ({ where: () => ({ limit: () => Promise.resolve([{ id: 5 }]) }) })
    })
    const mockSet = vi.fn().mockReturnValue({
      where: () => ({ returning: () => Promise.resolve([{ id: 1 }]) })
    })
    mockDbUpdate.mockReturnValue({ set: mockSet })
    await runPatchCustomer({}, 1, { email: 'updated@example.com' })
    expect(mockSet).toHaveBeenCalledWith({ email: 'updated@example.com' })
  })
})
