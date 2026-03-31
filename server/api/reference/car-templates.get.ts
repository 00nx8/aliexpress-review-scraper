import { requireUser } from '~~/server/utils/auth'
import { useDb } from '~~/server/db'
import { carTemplates } from '~~/server/db/schema'
import { ilike, or } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  await requireUser(event)
  const query = getQuery(event)
  const db = useDb()

  if (query.search) {
    const s = `%${query.search}%`
    return db.select().from(carTemplates).where(
      or(ilike(carTemplates.brand, s), ilike(carTemplates.make, s))
    ).limit(50)
  }
  return db.select().from(carTemplates).limit(100)
})
