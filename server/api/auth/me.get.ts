import { requireUser } from '~~/server/utils/auth'
import { useDb } from '~~/server/db'
import { users, garages } from '~~/server/db/schema'
import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const sessionUser = await requireUser(event)
  const db = useDb()
  const [user] = await db.select({
    id: users.id,
    email: users.email,
    subscriptionType: users.subscriptionType,
    subscriptionStartDate: users.subscriptionStartDate,
    hourlyRate: users.hourlyRate,
    partsMarkup: users.partsMarkup,
    vatRate: users.vatRate,
    garageId: users.garageId
  }).from(users).where(eq(users.id, sessionUser.id)).limit(1)

  if (!user) {
    await clearUserSession(event)
    throw createError({ statusCode: 401, message: 'Session expired. Please log in again.' })
  }

  let garage = null
  if (user.garageId) {
    const [g] = await db.select().from(garages).where(eq(garages.id, user.garageId)).limit(1)
    garage = g || null
  }

  return { user, garage }
})
