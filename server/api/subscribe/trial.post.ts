import { requireUser } from '~~/server/utils/auth'
import { useDb } from '~~/server/db'
import { users } from '~~/server/db/schema'
import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const sessionUser = await requireUser(event)
  const db = useDb()

  const trialStart = Date.now()
  const trialEnd = trialStart + 14 * 24 * 60 * 60 * 1000 // 14 days

  await db.update(users).set({
    subscriptionType: 'trial',
    subscriptionStartDate: trialStart
  }).where(eq(users.id, sessionUser.id))

  await setUserSession(event, {
    user: {
      ...sessionUser,
      subscriptionType: 'trial'
    }
  })

  return { ok: true }
})
