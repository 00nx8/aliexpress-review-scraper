import { useDb } from '~~/server/db'
import { users } from '~~/server/db/schema'
import { verifyUserPassword as verifyPassword } from '~~/server/utils/password'
import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { email, password } = body

  if (!email || !password) {
    throw createError({ statusCode: 400, message: 'Email and password required' })
  }

  const db = useDb()
  const [user] = await db.select().from(users).where(eq(users.email, email.toLowerCase())).limit(1)

  if (!user || !verifyPassword(password, user.password)) {
    throw createError({ statusCode: 401, message: 'Invalid email or password' })
  }

  await setUserSession(event, {
    user: {
      id: user.id,
      email: user.email,
      subscriptionType: user.subscriptionType,
      garageId: user.garageId,
      billingCountry: user.billingCountry
    }
  })

  return { ok: true }
})
