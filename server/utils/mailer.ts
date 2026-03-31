import nodemailer from 'nodemailer'

export function createTransport() {
  const config = useRuntimeConfig()
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: config.smtpUser,
      pass: config.smtpPass
    }
  })
}

export async function sendPasswordResetEmail(to: string, resetUrl: string) {
  const config = useRuntimeConfig()
  const transporter = createTransport()
  await transporter.sendMail({
    from: `"Torq" <${config.smtpUser}>`,
    to,
    subject: 'Reset your Torq password',
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2>Reset your password</h2>
        <p>Click the button below to reset your password. This link expires in 1 hour.</p>
        <a href="${resetUrl}" style="display:inline-block;padding:12px 24px;background:#22c55e;color:#fff;text-decoration:none;border-radius:6px;font-weight:bold;">
          Reset Password
        </a>
        <p style="color:#666;font-size:14px;margin-top:16px;">If you didn't request this, you can safely ignore this email.</p>
      </div>
    `
  })
}
