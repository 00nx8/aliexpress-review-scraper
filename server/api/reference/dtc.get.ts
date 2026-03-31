import { requireUser } from '~~/server/utils/auth'
import { useDb } from '~~/server/db'
import { dtcCodes, carTemplateDtcCodes } from '~~/server/db/schema'
import { ilike, or, and, inArray, eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  await requireUser(event)
  const query = getQuery(event)
  const db = useDb()

  const conditions = []
  if (query.search) {
    const s = `%${query.search}%`
    conditions.push(or(ilike(dtcCodes.code, s), ilike(dtcCodes.shortDescription, s), ilike(dtcCodes.categoryName, s)))
  }
  if (query.category) conditions.push(ilike(dtcCodes.category, query.category as string))

  // If templateId provided, filter to just codes for that car template
  if (query.templateId) {
    const rows = await db.select({ dtcCodeId: carTemplateDtcCodes.dtcCodeId })
      .from(carTemplateDtcCodes)
      .where(eq(carTemplateDtcCodes.carId, Number(query.templateId)))
    const ids = rows.map(r => r.dtcCodeId).filter(Boolean) as number[]
    if (!ids.length) return []
    conditions.push(inArray(dtcCodes.id, ids))
  }

  // Don't return anything if no search and no template (avoid dumping 1277 codes)
  if (!query.search && !query.templateId) return []

  return db.select({
    id: dtcCodes.id,
    code: dtcCodes.code,
    category: dtcCodes.category,
    categoryName: dtcCodes.categoryName,
    shortDescription: dtcCodes.shortDescription,
    severity: dtcCodes.severity
  }).from(dtcCodes)
    .where(conditions.length ? and(...conditions) : undefined)
    .limit(200)
})
