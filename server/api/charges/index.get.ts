import { requireUser } from '~~/server/utils/auth'
import { useDb } from '~~/server/db'
import { chargeTemplates } from '~~/server/db/schema'
import { ilike } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  await requireUser(event)
  const query = getQuery(event)
  const db = useDb()

  if (query.search) {
    return db.select().from(chargeTemplates).where(ilike(chargeTemplates.name, `%${query.search}%`)).limit(20)
  }
  return db.select().from(chargeTemplates).limit(50)
})
