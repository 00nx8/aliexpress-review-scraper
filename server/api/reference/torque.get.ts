import { requireUser } from '~~/server/utils/auth'
import { useDb } from '~~/server/db'
import { torqueSpecs, torqueSpecJobs, carJobs } from '~~/server/db/schema'
import { eq, ilike, inArray, and, or } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  await requireUser(event)
  const query = getQuery(event)
  const db = useDb()

  let tsIds: number[] | null = null

  if (query.templateId) {
    // Get jobs for this template
    const cjs = await db.select({ jobId: carJobs.jobId }).from(carJobs)
      .where(eq(carJobs.carId, Number(query.templateId)))
    const jobIds = cjs.map(c => c.jobId).filter(Boolean) as number[]

    if (jobIds.length) {
      const tsj = await db.select({ torqueSpecId: torqueSpecJobs.torqueSpecId })
        .from(torqueSpecJobs)
        .where(inArray(torqueSpecJobs.jobId, jobIds))
      tsIds = tsj.map(t => t.torqueSpecId).filter(Boolean) as number[]
    } else {
      tsIds = []
    }
  }

  const conditions = []
  if (tsIds !== null) conditions.push(tsIds.length ? inArray(torqueSpecs.id, tsIds) : eq(torqueSpecs.id, -1))
  if (query.search) conditions.push(ilike(torqueSpecs.component, `%${query.search}%`))

  return db.select().from(torqueSpecs)
    .where(conditions.length ? and(...conditions) : undefined)
    .limit(100)
})
