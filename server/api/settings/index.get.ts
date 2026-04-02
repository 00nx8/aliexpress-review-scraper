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
    phoneNo: users.phoneNo,
    hourlyRate: users.hourlyRate,
    partsMarkup: users.partsMarkup,
    vatRate: users.vatRate,
    garageId: users.garageId,
    subscriptionType: users.subscriptionType
  }).from(users).where(eq(users.id, sessionUser.id)).limit(1)

  let garage = null
  if (user?.garageId) {
    const [g] = await db.select().from(garages).where(eq(garages.id, user.garageId)).limit(1)
    garage = g || null
  }

  return { user, garage }
})
