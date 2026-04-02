import { requireUser } from '~~/server/utils/auth'
import { useDb } from '~~/server/db'
import { carTemplates } from '~~/server/db/schema'
import { ilike, or, and } from 'drizzle-orm'

// Known brand aliases for accent-insensitive and shorthand matching
const BRAND_ALIASES: Record<string, string> = {
  'skoda': 'Škoda',
  'vw': 'Volkswagen',
  'mercedes': 'Mercedes-Benz',
}

export default defineEventHandler(async (event) => {
  await requireUser(event)
  const query = getQuery(event)
  const db = useDb()

  if (query.search) {
    const terms = (query.search as string).trim().split(/\s+/)
    const termConditions = terms.map(term => {
      const s = `%${term}%`
      const alias = BRAND_ALIASES[term.toLowerCase()]
      if (alias) {
        const aliasS = `%${alias}%`
        return or(
          ilike(carTemplates.brand, s),
          ilike(carTemplates.make, s),
          ilike(carTemplates.brand, aliasS),
          ilike(carTemplates.make, aliasS)
        )
      }
      return or(ilike(carTemplates.brand, s), ilike(carTemplates.make, s))
    })
    return db.select().from(carTemplates)
      .where(termConditions.length === 1 ? termConditions[0]! : and(...termConditions))
      .limit(50)
  }
  return db.select().from(carTemplates).limit(100)
})
