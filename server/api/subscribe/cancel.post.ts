import { requireUser } from '~~/server/utils/auth'
import { useDb } from '~~/server/db'
import { users } from '~~/server/db/schema'
import { eq } from 'drizzle-orm'
import Stripe from 'stripe'

export default defineEventHandler(async (event) => {
  const sessionUser = await requireUser(event)
  const db = useDb()

  const [user] = await db.select({
    stripeSubscriptionId: users.stripeSubscriptionId
  }).from(users).where(eq(users.id, sessionUser.id)).limit(1)

  if (user?.stripeSubscriptionId) {
    const config = useRuntimeConfig()
    const stripe = new Stripe(config.stripeSecretKey as string)
    await stripe.subscriptions.cancel(user.stripeSubscriptionId)
  }

  await db.update(users).set({
    subscriptionType: 'unset'
  }).where(eq(users.id, sessionUser.id))

  await setUserSession(event, {
    user: { ...sessionUser, subscriptionType: 'unset' }
  })

  return { ok: true }
})
