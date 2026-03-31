import { requireUser } from '~~/server/utils/auth'
import { useDb } from '~~/server/db'
import { parts } from '~~/server/db/schema'
import { ilike, or } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  await requireUser(event)
  const query = getQuery(event)
  const db = useDb()

  if (query.search) {
    const s = `%${query.search}%`
    return db.select().from(parts).where(
      or(ilike(parts.name, s), ilike(parts.brand, s), ilike(parts.partNo, s))
    ).limit(20)
  }
  return db.select().from(parts).limit(50)
})
