import { requireUser } from '~~/server/utils/auth'
import { useDb } from '~~/server/db'
import { users } from '~~/server/db/schema'
import { eq } from 'drizzle-orm'
import Stripe from 'stripe'

export default defineEventHandler(async (event) => {
  const sessionUser = await requireUser(event)
  const body = await readBody(event)
  const { plan } = body

  if (!['freelance', 'business'].includes(plan)) {
    throw createError({ statusCode: 400, message: 'Invalid plan' })
  }

  const config = useRuntimeConfig()
  const stripe = new Stripe(config.stripeSecretKey as string)

  const db = useDb()
  const [user] = await db.select().from(users).where(eq(users.id, sessionUser.id)).limit(1)

  if (!user) {
    await clearUserSession(event)
    throw createError({ statusCode: 401, message: 'Session expired. Please log in again.' })
  }

  const priceId = plan === 'business'
    ? config.stripePriceBusinessId
    : config.stripePriceFreelanceId

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [{ price: priceId as string, quantity: 1 }],
    customer_email: user.email,
    customer: user.stripeCustomerId || undefined,
    success_url: `${config.siteUrl}/subscribe/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${config.siteUrl}/subscribe`,
    metadata: { userId: String(user.id), plan }
  })

  return { url: session.url }
})
