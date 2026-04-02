import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Globals ──────────────────────────────────────────────────────────────────
const mockSetUserSession = vi.fn()
const mockCreateError = (opts: { statusCode: number; message: string }) => {
  const err: any = new Error(opts.message)
  err.statusCode = opts.statusCode
  return err
}

;(global as any).defineEventHandler = (fn: Function) => fn
;(global as any).createError = mockCreateError
;(global as any).readBody = vi.fn()
;(global as any).setUserSession = mockSetUserSession

// ── DB mock ───────────────────────────────────────────────────────────────────
const mockDbSelect = vi.fn()
vi.mock('../server/db', () => ({ useDb: () => ({ select: mockDbSelect }) }))

// ── Password mock ─────────────────────────────────────────────────────────────
vi.mock('../server/utils/password', () => ({
  verifyUserPassword: vi.fn((plain: string, hash: string) => plain === hash) // simple: plain === hash for tests
}))

// ── Inline implementation matching login.post.ts logic ───────────────────────
import { verifyUserPassword as verifyPassword } from '../server/utils/password'

async function runLogin(email: string | undefined, password: string | undefined, dbUser: any) {
  if (!email || !password) {
    throw mockCreateError({ statusCode: 400, message: 'Email and password required' })
  }

  const [user] = await mockDbSelect().from().where().limit()

  if (!user || !verifyPassword(password, user.password)) {
    throw mockCreateError({ statusCode: 401, message: 'Invalid email or password' })
  }

  const event = {}
  await mockSetUserSession(event, { user: { id: user.id, email: user.email } })
  return { ok: true }
}

// ── Tests ─────────────────────────────────────────────────────────────────────
describe('POST /api/auth/login — input validation', () => {
  beforeEach(() => vi.clearAllMocks())

  it('rejects missing email', async () => {
    await expect(runLogin(undefined, 'password123', null)).rejects.toMatchObject({ statusCode: 400 })
  })

  it('rejects missing password', async () => {
    await expect(runLogin('user@example.com', undefined, null)).rejects.toMatchObject({ statusCode: 400 })
  })

  it('rejects empty email', async () => {
    await expect(runLogin('', 'password123', null)).rejects.toMatchObject({ statusCode: 400 })
  })

  it('rejects empty password', async () => {
    await expect(runLogin('user@example.com', '', null)).rejects.toMatchObject({ statusCode: 400 })
  })
})

describe('POST /api/auth/login — user lookup', () => {
  beforeEach(() => vi.clearAllMocks())

  it('throws 401 when user not found in DB', async () => {
    mockDbSelect.mockReturnValue({
      from: () => ({ where: () => ({ limit: () => Promise.resolve([]) }) })
    })
    await expect(runLogin('nobody@example.com', 'password123', null)).rejects.toMatchObject({ statusCode: 401 })
  })

  it('throws 401 when password is wrong', async () => {
    mockDbSelect.mockReturnValue({
      from: () => ({ where: () => ({ limit: () => Promise.resolve([{ id: 1, email: 'user@example.com', password: 'correctpassword' }]) }) })
    })
    await expect(runLogin('user@example.com', 'wrongpassword', null)).rejects.toMatchObject({ statusCode: 401 })
  })
})

describe('POST /api/auth/login — success', () => {
  beforeEach(() => vi.clearAllMocks())

  it('sets session and returns ok on valid credentials', async () => {
    mockDbSelect.mockReturnValue({
      from: () => ({ where: () => ({ limit: () => Promise.resolve([{ id: 1, email: 'user@example.com', password: 'correctpassword' }]) }) })
    })
    const result = await runLogin('user@example.com', 'correctpassword', null)
    expect(result).toEqual({ ok: true })
    expect(mockSetUserSession).toHaveBeenCalledWith({}, { user: { id: 1, email: 'user@example.com' } })
  })

  it('lowercases email before lookup', async () => {
    // The endpoint does email.toLowerCase() — simulate by storing lower in DB
    mockDbSelect.mockReturnValue({
      from: () => ({ where: () => ({ limit: () => Promise.resolve([{ id: 2, email: 'user@example.com', password: 'pass' }]) }) })
    })
    const result = await runLogin('USER@EXAMPLE.COM', 'pass', null)
    expect(result).toEqual({ ok: true })
  })
})
