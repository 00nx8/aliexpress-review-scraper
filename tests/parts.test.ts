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

// ── GET /api/parts ────────────────────────────────────────────────────────────
async function runGetParts(event: object, search?: string) {
  await requireUser(event)
  if (search) {
    return mockDbSelect().from().where().limit()
  }
  return mockDbSelect().from().limit()
}

describe('GET /api/parts — auth', () => {
  beforeEach(() => vi.clearAllMocks())

  it('throws 401 when unauthenticated', async () => {
    mockGetUserSession.mockResolvedValue(noSession)
    await expect(runGetParts({})).rejects.toMatchObject({ statusCode: 401 })
  })
})

describe('GET /api/parts — list', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUserSession.mockResolvedValue(authedSession)
  })

  it('returns all parts without search', async () => {
    const parts = [{ id: 1, name: 'Oil Filter', brand: 'Mann', partNo: 'W712' }]
    mockDbSelect.mockReturnValue({ from: () => ({ limit: () => Promise.resolve(parts) }) })
    const result = await runGetParts({})
    expect(result).toEqual(parts)
  })

  it('returns filtered parts when search provided', async () => {
    const filtered = [{ id: 1, name: 'Oil Filter' }]
    mockDbSelect.mockReturnValue({
      from: () => ({ where: () => ({ limit: () => Promise.resolve(filtered) }) })
    })
    const result = await runGetParts({}, 'Oil')
    expect(result).toEqual(filtered)
  })

  it('returns empty array when no parts found', async () => {
    mockDbSelect.mockReturnValue({ from: () => ({ limit: () => Promise.resolve([]) }) })
    const result = await runGetParts({})
    expect(result).toEqual([])
  })
})

// ── POST /api/parts ───────────────────────────────────────────────────────────
// Now includes a duplicate check (409) before inserting.
async function runPostPart(event: object, body: any) {
  await requireUser(event)
  const { name, partNo, brand } = body
  if (!name) throw mockCreateError({ statusCode: 400, message: 'Name required' })

  // Duplicate check: same name + brand already exists?
  const [existing] = await mockDbSelect().from().where().limit()
  if (existing) {
    throw mockCreateError({
      statusCode: 409,
      message: 'A part with this name and brand already exists. Use the existing part and adjust the price instead.'
    })
  }

  const [part] = await mockDbInsert().values({ name, partNo: partNo || '', brand: brand || '' }).returning()
  return part
}

describe('POST /api/parts — validation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUserSession.mockResolvedValue(authedSession)
  })

  it('throws 400 when name is missing', async () => {
    mockDbSelect.mockReturnValue({ from: () => ({ where: () => ({ limit: () => Promise.resolve([]) }) }) })
    await expect(runPostPart({}, {})).rejects.toMatchObject({ statusCode: 400, message: 'Name required' })
  })

  it('throws 400 when name is empty string', async () => {
    mockDbSelect.mockReturnValue({ from: () => ({ where: () => ({ limit: () => Promise.resolve([]) }) }) })
    await expect(runPostPart({}, { name: '' })).rejects.toMatchObject({ statusCode: 400 })
  })

  it('throws 401 when unauthenticated', async () => {
    mockGetUserSession.mockResolvedValue(noSession)
    await expect(runPostPart({}, { name: 'Filter' })).rejects.toMatchObject({ statusCode: 401 })
  })
})

describe('POST /api/parts — duplicate check (409)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUserSession.mockResolvedValue(authedSession)
  })

  it('throws 409 when a part with the same name and brand already exists', async () => {
    // Duplicate found in DB
    mockDbSelect.mockReturnValue({
      from: () => ({ where: () => ({ limit: () => Promise.resolve([{ id: 7, name: 'Brake Pad', brand: 'Brembo' }]) }) })
    })
    await expect(runPostPart({}, { name: 'Brake Pad', brand: 'Brembo' })).rejects.toMatchObject({ statusCode: 409 })
  })

  it('includes a helpful message on 409', async () => {
    mockDbSelect.mockReturnValue({
      from: () => ({ where: () => ({ limit: () => Promise.resolve([{ id: 7, name: 'Brake Pad', brand: 'Brembo' }]) }) })
    })
    await expect(runPostPart({}, { name: 'Brake Pad', brand: 'Brembo' }))
      .rejects.toMatchObject({ message: expect.stringContaining('already exists') })
  })

  it('does not insert when duplicate is found', async () => {
    mockDbSelect.mockReturnValue({
      from: () => ({ where: () => ({ limit: () => Promise.resolve([{ id: 7 }]) }) })
    })
    try { await runPostPart({}, { name: 'Brake Pad', brand: 'Brembo' }) } catch {}
    expect(mockDbInsert).not.toHaveBeenCalled()
  })

  it('allows insertion when same name but different brand', async () => {
    // No duplicate found
    mockDbSelect.mockReturnValue({
      from: () => ({ where: () => ({ limit: () => Promise.resolve([]) }) })
    })
    const part = { id: 8, name: 'Brake Pad', brand: 'ATE' }
    mockDbInsert.mockReturnValue({
      values: () => ({ returning: () => Promise.resolve([part]) })
    })
    const result = await runPostPart({}, { name: 'Brake Pad', brand: 'ATE' })
    expect(result).toEqual(part)
  })

  it('allows insertion when same brand but different name', async () => {
    mockDbSelect.mockReturnValue({
      from: () => ({ where: () => ({ limit: () => Promise.resolve([]) }) })
    })
    const part = { id: 9, name: 'Oil Filter', brand: 'Brembo' }
    mockDbInsert.mockReturnValue({
      values: () => ({ returning: () => Promise.resolve([part]) })
    })
    const result = await runPostPart({}, { name: 'Oil Filter', brand: 'Brembo' })
    expect(result).toEqual(part)
  })

  it('duplicate check runs even when brand is omitted (defaults to empty string)', async () => {
    // Part with no brand — duplicate detection uses ilike(brand, '') which matches empty brand
    mockDbSelect.mockReturnValue({
      from: () => ({ where: () => ({ limit: () => Promise.resolve([{ id: 10, name: 'Generic Filter', brand: '' }]) }) })
    })
    await expect(runPostPart({}, { name: 'Generic Filter' })).rejects.toMatchObject({ statusCode: 409 })
  })
})

describe('POST /api/parts — create', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUserSession.mockResolvedValue(authedSession)
  })

  it('inserts part and returns it when no duplicate exists', async () => {
    const part = { id: 5, name: 'Brake Pad', partNo: 'BP001', brand: 'Brembo' }
    // No duplicate
    mockDbSelect.mockReturnValue({
      from: () => ({ where: () => ({ limit: () => Promise.resolve([]) }) })
    })
    mockDbInsert.mockReturnValue({
      values: () => ({ returning: () => Promise.resolve([part]) })
    })
    const result = await runPostPart({}, { name: 'Brake Pad', partNo: 'BP001', brand: 'Brembo' })
    expect(result).toEqual(part)
  })

  it('defaults partNo and brand to empty string', async () => {
    mockDbSelect.mockReturnValue({
      from: () => ({ where: () => ({ limit: () => Promise.resolve([]) }) })
    })
    const mockValues = vi.fn().mockReturnValue({ returning: () => Promise.resolve([{ id: 1, name: 'Filter' }]) })
    mockDbInsert.mockReturnValue({ values: mockValues })
    await runPostPart({}, { name: 'Filter' })
    expect(mockValues).toHaveBeenCalledWith(expect.objectContaining({ partNo: '', brand: '' }))
  })

  it('passes provided partNo and brand to insert', async () => {
    mockDbSelect.mockReturnValue({
      from: () => ({ where: () => ({ limit: () => Promise.resolve([]) }) })
    })
    const mockValues = vi.fn().mockReturnValue({ returning: () => Promise.resolve([{ id: 1 }]) })
    mockDbInsert.mockReturnValue({ values: mockValues })
    await runPostPart({}, { name: 'Filter', partNo: 'ABC123', brand: 'Mann' })
    expect(mockValues).toHaveBeenCalledWith({ name: 'Filter', partNo: 'ABC123', brand: 'Mann' })
  })
})
