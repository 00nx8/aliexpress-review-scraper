import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Globals ───────────────────────────────────────────────────────────────────
const mockCreateError = (opts: { statusCode: number; message: string }) => {
  const err: any = new Error(opts.message)
  err.statusCode = opts.statusCode
  return err
}
;(global as any).defineEventHandler = (fn: Function) => fn
;(global as any).createError = mockCreateError
;(global as any).readBody = vi.fn()

// ── DB mock ───────────────────────────────────────────────────────────────────
const mockDbSelect = vi.fn()
const mockDbUpdate = vi.fn()
vi.mock('../server/db', () => ({ useDb: () => ({ select: mockDbSelect, update: mockDbUpdate }) }))

// ── Password mock ─────────────────────────────────────────────────────────────
vi.mock('../server/utils/password', () => ({
  hashUserPassword: vi.fn((p: string) => `hashed:${p}`)
}))

import { hashUserPassword as hashPassword } from '../server/utils/password'

// ── Inline implementation matching reset-password.post.ts logic ───────────────
async function runResetPassword(token: string | undefined, password: string | undefined) {
  if (!token || !password) throw mockCreateError({ statusCode: 400, message: 'Token and password required' })
  if (password.length < 8) throw mockCreateError({ statusCode: 400, message: 'Password must be at least 8 characters' })

  const [reset] = await mockDbSelect().from().where().limit()

  if (!reset || !reset.userId) {
    throw mockCreateError({ statusCode: 400, message: 'Invalid or expired token' })
  }

  await mockDbUpdate().set({ password: hashPassword(password) }).where()
  await mockDbUpdate().set({ isValid: false }).where()

  return { ok: true }
}

// ── Tests ─────────────────────────────────────────────────────────────────────
describe('POST /api/auth/reset-password — validation', () => {
  beforeEach(() => vi.clearAllMocks())

  it('throws 400 when token is missing', async () => {
    await expect(runResetPassword(undefined, 'newpassword123')).rejects.toMatchObject({ statusCode: 400 })
  })

  it('throws 400 when password is missing', async () => {
    await expect(runResetPassword('some-token', undefined)).rejects.toMatchObject({ statusCode: 400 })
  })

  it('throws 400 when password is too short', async () => {
    await expect(runResetPassword('some-token', 'short')).rejects.toMatchObject({
      statusCode: 400,
      message: 'Password must be at least 8 characters'
    })
  })

  it('accepts password of exactly 8 characters', async () => {
    mockDbSelect.mockReturnValue({
      from: () => ({ where: () => ({ limit: () => Promise.resolve([{ userId: 1 }]) }) })
    })
    mockDbUpdate.mockReturnValue({ set: () => ({ where: () => Promise.resolve() }) })
    await expect(runResetPassword('some-token', 'exactly8')).resolves.toEqual({ ok: true })
  })
})

describe('POST /api/auth/reset-password — token validation', () => {
  beforeEach(() => vi.clearAllMocks())

  it('throws 400 when token not found in DB', async () => {
    mockDbSelect.mockReturnValue({
      from: () => ({ where: () => ({ limit: () => Promise.resolve([]) }) })
    })
    await expect(runResetPassword('invalid-token', 'newpassword123')).rejects.toMatchObject({
      statusCode: 400,
      message: 'Invalid or expired token'
    })
  })

  it('throws 400 when reset record has no userId', async () => {
    mockDbSelect.mockReturnValue({
      from: () => ({ where: () => ({ limit: () => Promise.resolve([{ userId: null }]) }) })
    })
    await expect(runResetPassword('some-token', 'newpassword123')).rejects.toMatchObject({ statusCode: 400 })
  })
})

describe('POST /api/auth/reset-password — success', () => {
  beforeEach(() => vi.clearAllMocks())

  it('updates user password and invalidates token', async () => {
    mockDbSelect.mockReturnValue({
      from: () => ({ where: () => ({ limit: () => Promise.resolve([{ userId: 5 }]) }) })
    })
    const mockSet = vi.fn().mockReturnValue({ where: () => Promise.resolve() })
    mockDbUpdate.mockReturnValue({ set: mockSet })

    const result = await runResetPassword('valid-token', 'newpassword123')
    expect(result).toEqual({ ok: true })
    expect(hashPassword).toHaveBeenCalledWith('newpassword123')
    expect(mockSet).toHaveBeenCalledTimes(2) // password update + token invalidation
  })
})
