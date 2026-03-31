import { useDb } from '~~/server/db'
import { users, passwordReset } from '~~/server/db/schema'
import { generateToken } from '~~/server/utils/password'
import { sendPasswordResetEmail } from '~~/server/utils/mailer'
import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { email } = body

  if (!email) throw createError({ statusCode: 400, message: 'Email required' })

  const db = useDb()
  const config = useRuntimeConfig()

  const [user] = await db.select({ id: users.id, email: users.email })
    .from(users)
    .where(eq(users.email, email.toLowerCase()))
    .limit(1)

  // Always return success to avoid user enumeration
  if (!user) return { ok: true }

  const token = generateToken()

  await db.insert(passwordReset).values({
    userId: user.id,
    passwordResetKey: token,
    isValid: true
  })

  const resetUrl = `${config.siteUrl}/reset-password?token=${token}`
  await sendPasswordResetEmail(user.email, resetUrl)

  return { ok: true }
})
