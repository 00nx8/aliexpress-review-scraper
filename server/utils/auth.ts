import type { H3Event } from 'h3'

declare module '#auth-utils' {
  interface User {
    id: number
    email: string
    subscriptionType: string | null
    garageId: number | null
    billingCountry?: string | null
  }
}

export async function requireUser(event: H3Event) {
  const session = await getUserSession(event)
  if (!session?.user?.id) {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }
  return session.user as { id: number; email: string; subscriptionType: string | null; garageId: number | null }
}
