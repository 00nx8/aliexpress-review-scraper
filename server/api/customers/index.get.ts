import { requireUser } from '~~/server/utils/auth'
import { useDb } from '~~/server/db'
import { customers, visits } from '~~/server/db/schema'
import { ilike, eq, and, inArray, isNotNull } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const query = getQuery(event)
  const db = useDb()

  // Only return customers who appeared in a visit owned by this user
  const allowed = await db.selectDistinct({ id: visits.customerId })
    .from(visits)
    .where(and(eq(visits.userId, user.id), isNotNull(visits.customerId)))
  const ids = allowed.map(r => r.id).filter(Boolean) as number[]
  if (!ids.length) return []

  if (query.search) {
    return db.select().from(customers)
      .where(and(ilike(customers.name, `%${query.search}%`), inArray(customers.id, ids)))
      .limit(10)
  }

  return db.select().from(customers).where(inArray(customers.id, ids)).limit(50)
})
