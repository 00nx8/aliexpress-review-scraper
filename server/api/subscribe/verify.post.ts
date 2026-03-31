import { requireUser } from '~~/server/utils/auth'
import { useDb } from '~~/server/db'
import { users } from '~~/server/db/schema'
import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const sessionUser = await requireUser(event)
  const db = useDb()

  const [user] = await db.select({
    id: users.id,
    email: users.email,
    subscriptionType: users.subscriptionType,
    garageId: users.garageId
  }).from(users).where(eq(users.id, sessionUser.id)).limit(1)

  if (user) {
    await setUserSession(event, {
      user: {
        id: user.id,
        email: user.email,
        subscriptionType: user.subscriptionType,
        garageId: user.garageId
      }
    })
  }

  return { ok: true }
})
