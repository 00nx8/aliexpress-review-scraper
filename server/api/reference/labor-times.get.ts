import { requireUser } from '~~/server/utils/auth'
import { useDb } from '~~/server/db'
import { jobs, carJobs, categories } from '~~/server/db/schema'
import { eq, ilike, inArray, and } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  await requireUser(event)
  const query = getQuery(event)
  const db = useDb()

  let jobIds: number[] | null = null

  if (query.templateId) {
    const cjs = await db.select({ jobId: carJobs.jobId })
      .from(carJobs)
      .where(eq(carJobs.carId, Number(query.templateId)))
    jobIds = cjs.map(c => c.jobId).filter(Boolean) as number[]
  }

  const conditions = []
  if (jobIds) conditions.push(inArray(jobs.id, jobIds))
  if (query.search) {
    const terms = (query.search as string).trim().split(/\s+/)
    const termConditions = terms.map(term => ilike(jobs.name, `%${term}%`))
    conditions.push(termConditions.length === 1 ? termConditions[0]! : and(...termConditions))
  }

  const list = await db.select({
    id: jobs.id,
    name: jobs.name,
    category: jobs.category,
    labourHours: jobs.labourHours,
    lowRange: jobs.lowRange,
    highRange: jobs.highRange
  }).from(jobs)
    .where(conditions.length ? and(...conditions) : undefined)
    .limit(100)

  // Group by category
  const grouped: Record<string, any[]> = {}
  for (const j of list) {
    const cat = j.category || 'Other'
    if (!grouped[cat]) grouped[cat] = []
    grouped[cat].push(j)
  }
  return grouped
})
