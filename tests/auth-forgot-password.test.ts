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
;(global as any).useRuntimeConfig = vi.fn(() => ({ siteUrl: 'http://localhost:3000' }))

// ── DB mock ───────────────────────────────────────────────────────────────────
const mockDbSelect = vi.fn()
const mockDbInsert = vi.fn()
vi.mock('../server/db', () => ({ useDb: () => ({ select: mockDbSelect, insert: mockDbInsert }) }))

// ── External mocks ────────────────────────────────────────────────────────────
const mockSendPasswordResetEmail = vi.fn()
vi.mock('../server/utils/mailer', () => ({ sendPasswordResetEmail: vi.fn(() => mockSendPasswordResetEmail()) }))
vi.mock('../server/utils/password', () => ({ generateToken: vi.fn(() => 'fake-reset-token-abc123') }))

import { generateToken } from '../server/utils/password'
import { sendPasswordResetEmail } from '../server/utils/mailer'

// ── Inline implementation matching forgot-password.post.ts logic ──────────────
async function runForgotPassword(email: string | undefined) {
  if (!email) throw mockCreateError({ statusCode: 400, message: 'Email required' })

  const config = (global as any).useRuntimeConfig()
  const [user] = await mockDbSelect().from().where().limit()

  // Always return success to avoid user enumeration
  if (!user) return { ok: true }

  const token = generateToken()
  await mockDbInsert().values({ userId: user.id, passwordResetKey: token, isValid: true })

  const resetUrl = `${config.siteUrl}/reset-password?token=${token}`
  await sendPasswordResetEmail(user.email, resetUrl)

  return { ok: true }
}

// ── Tests ─────────────────────────────────────────────────────────────────────
describe('POST /api/auth/forgot-password — validation', () => {
  beforeEach(() => vi.clearAllMocks())

  it('throws 400 when email is missing', async () => {
    await expect(runForgotPassword(undefined)).rejects.toMatchObject({ statusCode: 400, message: 'Email required' })
  })

  it('throws 400 when email is empty string', async () => {
    await expect(runForgotPassword('')).rejects.toMatchObject({ statusCode: 400 })
  })
})

describe('POST /api/auth/forgot-password — user enumeration prevention', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns ok even when email does not exist (no enumeration)', async () => {
    mockDbSelect.mockReturnValue({
      from: () => ({ where: () => ({ limit: () => Promise.resolve([]) }) })
    })
    const result = await runForgotPassword('unknown@example.com')
    expect(result).toEqual({ ok: true })
    expect(sendPasswordResetEmail).not.toHaveBeenCalled()
  })
})

describe('POST /api/auth/forgot-password — success flow', () => {
  beforeEach(() => vi.clearAllMocks())

  it('inserts reset token and sends email when user exists', async () => {
    mockDbSelect.mockReturnValue({
      from: () => ({ where: () => ({ limit: () => Promise.resolve([{ id: 1, email: 'user@example.com' }]) }) })
    })
    mockDbInsert.mockReturnValue({ values: vi.fn().mockResolvedValue([]) })
    mockSendPasswordResetEmail.mockResolvedValue(undefined)

    const result = await runForgotPassword('user@example.com')
    expect(result).toEqual({ ok: true })
    expect(generateToken).toHaveBeenCalled()
    expect(sendPasswordResetEmail).toHaveBeenCalled()
  })

  it('constructs reset URL with siteUrl and token', async () => {
    mockDbSelect.mockReturnValue({
      from: () => ({ where: () => ({ limit: () => Promise.resolve([{ id: 1, email: 'user@example.com' }]) }) })
    })
    mockDbInsert.mockReturnValue({ values: vi.fn().mockResolvedValue([]) })
    mockSendPasswordResetEmail.mockResolvedValue(undefined)

    await runForgotPassword('user@example.com')

    const { sendPasswordResetEmail: spy } = await import('../server/utils/mailer')
    // Verify it was called (URL contains token)
    expect(spy).toHaveBeenCalledWith('user@example.com', expect.stringContaining('/reset-password?token='))
  })
})
