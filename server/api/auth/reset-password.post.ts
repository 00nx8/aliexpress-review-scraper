import { useDb } from '~~/server/db'
import { users, passwordReset } from '~~/server/db/schema'
import { hashUserPassword as hashPassword } from '~~/server/utils/password'
import { eq, and } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { token, password } = body

  if (!token || !password) throw createError({ statusCode: 400, message: 'Token and password required' })
  if (password.length < 8) throw createError({ statusCode: 400, message: 'Password must be at least 8 characters' })

  const db = useDb()

  const [reset] = await db.select()
    .from(passwordReset)
    .where(and(eq(passwordReset.passwordResetKey, token), eq(passwordReset.isValid, true)))
    .limit(1)

  if (!reset || !reset.userId) {
    throw createError({ statusCode: 400, message: 'Invalid or expired token' })
  }

  await db.update(users)
    .set({ password: hashPassword(password) })
    .where(eq(users.id, reset.userId))

  await db.update(passwordReset)
    .set({ isValid: false })
    .where(eq(passwordReset.passwordResetKey, token))

  return { ok: true }
})
