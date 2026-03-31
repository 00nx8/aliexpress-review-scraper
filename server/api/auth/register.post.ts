import { useDb } from '~~/server/db'
import { users, garages } from '~~/server/db/schema'
import { hashUserPassword as hashPassword } from '~~/server/utils/password'
import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { email, password, country } = body

  if (!email || !password) {
    throw createError({ statusCode: 400, message: 'Email and password required' })
  }
  if (password.length < 8) {
    throw createError({ statusCode: 400, message: 'Password must be at least 8 characters' })
  }

  const db = useDb()
  const existing = await db.select().from(users).where(eq(users.email, email.toLowerCase())).limit(1)
  if (existing.length > 0) {
    throw createError({ statusCode: 409, message: 'Email already registered' })
  }

  // Create garage for this user
  const [garage] = await db.insert(garages).values({
    email: email.toLowerCase()
  }).returning()

  const [user] = await db.insert(users).values({
    email: email.toLowerCase(),
    password: hashPassword(password),
    billingCountry: country || null,
    subscriptionType: 'unset',
    garageId: garage!.id
  }).returning()

  await setUserSession(event, {
    user: {
      id: user!.id,
      email: user!.email,
      subscriptionType: user!.subscriptionType,
      garageId: user!.garageId,
      billingCountry: country || null
    }
  })

  return { ok: true }
})
