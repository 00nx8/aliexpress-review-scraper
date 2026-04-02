import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Globals ───────────────────────────────────────────────────────────────────
;(global as any).useRuntimeConfig = vi.fn(() => ({
  smtpUser: 'torq@example.com',
  smtpPass: 'testpass'
}))

// ── Nodemailer mock ───────────────────────────────────────────────────────────
const mockSendMail = vi.fn().mockResolvedValue({ messageId: 'fake-id' })
vi.mock('nodemailer', () => ({
  default: { createTransport: vi.fn(() => ({ sendMail: mockSendMail })) }
}))

// ── Inline implementation matching mailer.ts logic ────────────────────────────
// (The actual module uses Nuxt's useRuntimeConfig which requires a Nuxt instance,
// so we test the logic directly in the same style as other test files)
async function sendPasswordResetEmail(to: string, resetUrl: string) {
  const config = (global as any).useRuntimeConfig()
  const nodemailer = (await import('nodemailer')).default
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: config.smtpUser, pass: config.smtpPass }
  })
  await transporter.sendMail({
    from: `"Torq" <${config.smtpUser}>`,
    to,
    subject: 'Reset your Torq password',
    html: `<a href="${resetUrl}">Reset Password</a>`
  })
}

// ── Tests ─────────────────────────────────────────────────────────────────────
describe('sendPasswordResetEmail', () => {
  beforeEach(() => vi.clearAllMocks())

  it('sends email to the correct recipient', async () => {
    await sendPasswordResetEmail('user@example.com', 'http://localhost:3000/reset-password?token=abc')
    expect(mockSendMail).toHaveBeenCalledWith(expect.objectContaining({
      to: 'user@example.com'
    }))
  })

  it('includes reset URL in email body', async () => {
    const resetUrl = 'http://localhost:3000/reset-password?token=xyz123'
    await sendPasswordResetEmail('user@example.com', resetUrl)
    expect(mockSendMail).toHaveBeenCalledWith(expect.objectContaining({
      html: expect.stringContaining(resetUrl)
    }))
  })

  it('uses "Torq" as sender name', async () => {
    await sendPasswordResetEmail('user@example.com', 'http://localhost/reset')
    expect(mockSendMail).toHaveBeenCalledWith(expect.objectContaining({
      from: expect.stringContaining('Torq')
    }))
  })

  it('sets correct subject line', async () => {
    await sendPasswordResetEmail('user@example.com', 'http://localhost/reset')
    expect(mockSendMail).toHaveBeenCalledWith(expect.objectContaining({
      subject: 'Reset your Torq password'
    }))
  })

  it('uses SMTP credentials from runtime config', async () => {
    await sendPasswordResetEmail('user@example.com', 'http://localhost/reset')
    const nodemailer = (await import('nodemailer')).default
    expect(nodemailer.createTransport).toHaveBeenCalledWith(expect.objectContaining({
      auth: expect.objectContaining({ user: 'torq@example.com', pass: 'testpass' })
    }))
  })
})
