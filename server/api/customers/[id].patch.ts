import { requireUser } from '~~/server/utils/auth'
import { useDb } from '~~/server/db'
import { customers, visits } from '~~/server/db/schema'
import { eq, and } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const customerId = Number(getRouterParam(event, 'id'))
  const body = await readBody(event)
  const { name, email, phoneNo } = body

  const db = useDb()

  // Verify this customer appears in at least one visit owned by the user
  const [ownerVisit] = await db.select({ id: visits.id })
    .from(visits)
    .where(and(eq(visits.userId, user.id), eq(visits.customerId, customerId)))
    .limit(1)
  if (!ownerVisit) throw createError({ statusCode: 403, message: 'Customer not found' })

  const update: Record<string, string> = {}
  if (name !== undefined) update.name = name
  if (email !== undefined) update.email = email
  if (phoneNo !== undefined) update.phoneNo = phoneNo

  const [updated] = await db.update(customers)
    .set(update)
    .where(eq(customers.id, customerId))
    .returning()

  return updated
})
