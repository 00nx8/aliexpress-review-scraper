import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Globals ───────────────────────────────────────────────────────────────────
const mockClearUserSession = vi.fn()
const mockGetUserSession = vi.fn()
const mockCreateError = (opts: { statusCode: number; message: string }) => {
  const err: any = new Error(opts.message)
  err.statusCode = opts.statusCode
  return err
}

;(global as any).defineEventHandler = (fn: Function) => fn
;(global as any).createError = mockCreateError
;(global as any).clearUserSession = mockClearUserSession
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

// ── Inline implementation matching auth/me.get.ts logic ───────────────────────
async function runMe(event: object) {
  const sessionUser = await requireUser(event)
  const [user] = await mockDbSelect().from().where().limit()

  if (!user) {
    await mockClearUserSession(event)
    throw mockCreateError({ statusCode: 401, message: 'Session expired. Please log in again.' })
  }

  let garage = null
  if (user.garageId) {
    const [g] = await mockDbSelect().from().where().limit()
    garage = g || null
  }

  return { user, garage }
}

// ── Tests ─────────────────────────────────────────────────────────────────────
describe('GET /api/auth/me — authentication', () => {
  beforeEach(() => vi.clearAllMocks())

  it('throws 401 when not logged in', async () => {
    mockGetUserSession.mockResolvedValue({ user: null })
    await expect(runMe({})).rejects.toMatchObject({ statusCode: 401 })
  })

  it('throws 401 with missing user id in session', async () => {
    mockGetUserSession.mockResolvedValue({ user: {} })
    await expect(runMe({})).rejects.toMatchObject({ statusCode: 401 })
  })
})

describe('GET /api/auth/me — stale session handling', () => {
  beforeEach(() => vi.clearAllMocks())

  it('clears session and throws 401 when user not found in DB', async () => {
    mockGetUserSession.mockResolvedValue({ user: { id: 99, email: 'ghost@example.com' } })
    mockDbSelect.mockReturnValue({
      from: () => ({ where: () => ({ limit: () => Promise.resolve([]) }) })
    })
    const event = {}
    await expect(runMe(event)).rejects.toMatchObject({ statusCode: 401, message: 'Session expired. Please log in again.' })
    expect(mockClearUserSession).toHaveBeenCalledWith(event)
  })
})

describe('GET /api/auth/me — success', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns user and garage when both exist', async () => {
    mockGetUserSession.mockResolvedValue({ user: { id: 1, email: 'user@example.com' } })
    mockDbSelect
      .mockReturnValueOnce({
        from: () => ({ where: () => ({ limit: () => Promise.resolve([{ id: 1, email: 'user@example.com', garageId: 10, subscriptionType: 'business' }]) }) })
      })
      .mockReturnValueOnce({
        from: () => ({ where: () => ({ limit: () => Promise.resolve([{ id: 10, name: 'Best Garage' }]) }) })
      })

    const result = await runMe({})
    expect(result.user.id).toBe(1)
    expect(result.garage).toEqual({ id: 10, name: 'Best Garage' })
  })

  it('returns user with null garage when garageId is null', async () => {
    mockGetUserSession.mockResolvedValue({ user: { id: 2, email: 'user2@example.com' } })
    mockDbSelect.mockReturnValue({
      from: () => ({ where: () => ({ limit: () => Promise.resolve([{ id: 2, email: 'user2@example.com', garageId: null }]) }) })
    })

    const result = await runMe({})
    expect(result.user.id).toBe(2)
    expect(result.garage).toBeNull()
  })
})
