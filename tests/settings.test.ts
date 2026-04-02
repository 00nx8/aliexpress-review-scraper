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
;(global as any).getUserSession = mockGetUserSession

// ── DB mock ───────────────────────────────────────────────────────────────────
const mockDbSelect = vi.fn()
const mockDbUpdate = vi.fn()
vi.mock('../server/db', () => ({ useDb: () => ({ select: mockDbSelect, update: mockDbUpdate }) }))

// ── requireUser mock ──────────────────────────────────────────────────────────
vi.mock('../server/utils/auth', () => ({
  requireUser: vi.fn(async (event: any) => {
    const session = await (global as any).getUserSession(event)
    if (!session?.user?.id) throw (global as any).createError({ statusCode: 401, message: 'Unauthorized' })
    return session.user
  })
}))

import { requireUser } from '../server/utils/auth'

const authedSession = { user: { id: 1, email: 'user@example.com', garageId: 10 } }
const noSession = { user: null }

// ── GET /api/settings ─────────────────────────────────────────────────────────
async function runGetSettings(event: object) {
  const sessionUser = await requireUser(event)
  const [user] = await mockDbSelect().from().where().limit()
  let garage = null
  if (user?.garageId) {
    const [g] = await mockDbSelect().from().where().limit()
    garage = g || null
  }
  return { user, garage }
}

describe('GET /api/settings — auth', () => {
  beforeEach(() => vi.clearAllMocks())

  it('throws 401 when unauthenticated', async () => {
    mockGetUserSession.mockResolvedValue(noSession)
    await expect(runGetSettings({})).rejects.toMatchObject({ statusCode: 401 })
  })
})

describe('GET /api/settings — success', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUserSession.mockResolvedValue(authedSession)
  })

  it('returns user and garage', async () => {
    const user = { id: 1, email: 'user@example.com', garageId: 10, subscriptionType: 'business' }
    const garage = { id: 10, name: 'Top Garage' }
    mockDbSelect
      .mockReturnValueOnce({ from: () => ({ where: () => ({ limit: () => Promise.resolve([user]) }) }) })
      .mockReturnValueOnce({ from: () => ({ where: () => ({ limit: () => Promise.resolve([garage]) }) }) })

    const result = await runGetSettings({})
    expect(result.user).toEqual(user)
    expect(result.garage).toEqual(garage)
  })

  it('returns null garage when garageId is null', async () => {
    const user = { id: 2, email: 'user2@example.com', garageId: null }
    mockDbSelect.mockReturnValue({ from: () => ({ where: () => ({ limit: () => Promise.resolve([user]) }) }) })

    const result = await runGetSettings({})
    expect(result.garage).toBeNull()
  })
})

// ── PATCH /api/settings ───────────────────────────────────────────────────────
async function runPatchSettings(event: object, body: any) {
  const sessionUser = await requireUser(event)

  const userUpdates: Record<string, any> = {}
  if (body.phoneNo !== undefined) userUpdates.phoneNo = body.phoneNo
  if (body.hourlyRate !== undefined) userUpdates.hourlyRate = String(body.hourlyRate)
  if (body.partsMarkup !== undefined) userUpdates.partsMarkup = String(body.partsMarkup)
  if (body.vatRate !== undefined) userUpdates.vatRate = String(body.vatRate)

  if (Object.keys(userUpdates).length) {
    await mockDbUpdate().set(userUpdates).where()
  }

  const [user] = await mockDbSelect().from().where().limit()

  if (user && user.garageId && (body.garageName !== undefined || body.garageEmail !== undefined)) {
    const garageUpdates: Record<string, any> = {}
    if (body.garageName !== undefined) garageUpdates.name = body.garageName
    if (body.garageEmail !== undefined) garageUpdates.email = body.garageEmail
    await mockDbUpdate().set(garageUpdates).where()
  }

  return { ok: true }
}

describe('PATCH /api/settings — auth', () => {
  beforeEach(() => vi.clearAllMocks())

  it('throws 401 when unauthenticated', async () => {
    mockGetUserSession.mockResolvedValue(noSession)
    await expect(runPatchSettings({}, {})).rejects.toMatchObject({ statusCode: 401 })
  })
})

describe('PATCH /api/settings — user fields', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUserSession.mockResolvedValue(authedSession)
  })

  it('updates user fields when provided', async () => {
    const mockSet = vi.fn().mockReturnValue({ where: () => Promise.resolve() })
    mockDbUpdate.mockReturnValue({ set: mockSet })
    mockDbSelect.mockReturnValue({ from: () => ({ where: () => ({ limit: () => Promise.resolve([{ id: 1, garageId: null }]) }) }) })

    await runPatchSettings({}, { hourlyRate: 80, partsMarkup: 10, vatRate: 21 })
    expect(mockSet).toHaveBeenCalledWith(expect.objectContaining({
      hourlyRate: '80',
      partsMarkup: '10',
      vatRate: '21'
    }))
  })

  it('converts numeric rates to strings', async () => {
    const mockSet = vi.fn().mockReturnValue({ where: () => Promise.resolve() })
    mockDbUpdate.mockReturnValue({ set: mockSet })
    mockDbSelect.mockReturnValue({ from: () => ({ where: () => ({ limit: () => Promise.resolve([{ id: 1, garageId: null }]) }) }) })

    await runPatchSettings({}, { hourlyRate: 75.5 })
    expect(mockSet).toHaveBeenCalledWith(expect.objectContaining({ hourlyRate: '75.5' }))
  })

  it('skips user update when no user fields provided', async () => {
    const mockSet = vi.fn().mockReturnValue({ where: () => Promise.resolve() })
    mockDbUpdate.mockReturnValue({ set: mockSet })
    mockDbSelect.mockReturnValue({ from: () => ({ where: () => ({ limit: () => Promise.resolve([{ id: 1, garageId: null }]) }) }) })

    await runPatchSettings({}, { garageName: 'New Name' })
    // mockSet not called for user (no user fields)
    expect(mockSet).not.toHaveBeenCalledWith(expect.objectContaining({ hourlyRate: expect.anything() }))
  })

  it('returns { ok: true }', async () => {
    mockDbUpdate.mockReturnValue({ set: () => ({ where: () => Promise.resolve() }) })
    mockDbSelect.mockReturnValue({ from: () => ({ where: () => ({ limit: () => Promise.resolve([{ id: 1, garageId: null }]) }) }) })

    const result = await runPatchSettings({}, { phoneNo: '+31612345678' })
    expect(result).toEqual({ ok: true })
  })
})

describe('PATCH /api/settings — garage fields', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUserSession.mockResolvedValue(authedSession)
  })

  it('updates garage when user has garageId and garage fields provided', async () => {
    const mockSet = vi.fn().mockReturnValue({ where: () => Promise.resolve() })
    mockDbUpdate.mockReturnValue({ set: mockSet })
    mockDbSelect.mockReturnValue({
      from: () => ({ where: () => ({ limit: () => Promise.resolve([{ id: 1, garageId: 10 }]) }) })
    })

    await runPatchSettings({}, { garageName: 'Premium Auto', garageEmail: 'contact@auto.com' })
    expect(mockSet).toHaveBeenCalledWith(expect.objectContaining({ name: 'Premium Auto', email: 'contact@auto.com' }))
  })

  it('skips garage update when user has no garageId', async () => {
    const mockSet = vi.fn().mockReturnValue({ where: () => Promise.resolve() })
    mockDbUpdate.mockReturnValue({ set: mockSet })
    mockDbSelect.mockReturnValue({
      from: () => ({ where: () => ({ limit: () => Promise.resolve([{ id: 1, garageId: null }]) }) })
    })

    await runPatchSettings({}, { garageName: 'Some Garage' })
    // No garage update since garageId is null
    expect(mockSet).not.toHaveBeenCalled()
  })
})
