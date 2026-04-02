import Stripe from 'stripe'
import { useDb } from '~~/server/db'
import { users } from '~~/server/db/schema'
import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const stripe = new Stripe(config.stripeSecretKey as string)
  const sig = getHeader(event, 'stripe-signature')
  const rawBody = await readRawBody(event)

  let stripeEvent: Stripe.Event
  try {
    stripeEvent = stripe.webhooks.constructEvent(rawBody!, sig!, config.stripeWebhookSecret)
  } catch {
    throw createError({ statusCode: 400, message: 'Webhook signature verification failed' })
  }

  const db = useDb()
  console.log('webhook runs no problem')
  console.log(stripeEvent.type)

  if (stripeEvent.type === 'checkout.session.completed') {
    const session = stripeEvent.data.object as Stripe.Checkout.Session
    const userId = Number(session.metadata?.userId)
    const plan = session.metadata?.plan as 'freelance' | 'business'
    if (userId && plan) {
      const newSubscriptionId = session.subscription as string
      const [existingUser] = await db.select({ stripeSubscriptionId: users.stripeSubscriptionId })
        .from(users).where(eq(users.id, userId)).limit(1)
      if (existingUser?.stripeSubscriptionId && existingUser.stripeSubscriptionId !== newSubscriptionId) {
        try {
          await stripe.subscriptions.cancel(existingUser.stripeSubscriptionId)
        } catch (e) {
          console.error('Failed to cancel old subscription:', e)
        }
      }
      await db.update(users).set({
        subscriptionType: plan,
        subscriptionStartDate: Date.now(),
        stripeCustomerId: session.customer as string,
        stripeSubscriptionId: newSubscriptionId
      }).where(eq(users.id, userId))
    }
  }

  if (stripeEvent.type === 'customer.subscription.deleted') {
    const sub = stripeEvent.data.object as Stripe.Subscription
    await db.update(users).set({
      subscriptionType: 'unset'
    }).where(eq(users.stripeSubscriptionId, sub.id))
  }

  return { received: true }
})
