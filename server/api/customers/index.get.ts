import { requireUser } from '~~/server/utils/auth'
import { useDb } from '~~/server/db'
import { customers, visits } from '~~/server/db/schema'
import { ilike, eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  await requireUser(event)
  const query = getQuery(event)
  const db = useDb()

  if (query.search) {
    return db.select().from(customers)
      .where(ilike(customers.name, `%${query.search}%`))
      .limit(10)
  }

  return db.select().from(customers).limit(50)
})
