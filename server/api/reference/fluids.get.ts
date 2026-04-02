import { requireUser } from '~~/server/utils/auth'
import { useDb } from '~~/server/db'
import { fluids, carTemplateFluids } from '~~/server/db/schema'
import { eq, ilike, inArray, and, or } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  await requireUser(event)
  const query = getQuery(event)
  const db = useDb()

  let fluidIds: number[] | null = null

  if (query.templateId) {
    const ctf = await db.select({ fluidId: carTemplateFluids.fluidId })
      .from(carTemplateFluids)
      .where(eq(carTemplateFluids.carId, Number(query.templateId)))
    fluidIds = ctf.map(f => f.fluidId).filter(Boolean) as number[]
  }

  const conditions = []
  if (fluidIds) conditions.push(inArray(fluids.id, fluidIds))
  if (query.search) {
    const terms = (query.search as string).trim().split(/\s+/)
    const termConditions = terms.map(term => {
      const s = `%${term}%`
      return or(ilike(fluids.systemName, s), ilike(fluids.type, s), ilike(fluids.spec, s))
    })
    conditions.push(and(...termConditions))
  }

  return db.select().from(fluids)
    .where(conditions.length ? and(...conditions) : undefined)
    .limit(100)
})
