import { requireUser } from '~~/server/utils/auth'
import { useDb } from '~~/server/db'
import { visits, jobVisits } from '~~/server/db/schema'
import { eq, and } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const visitId = Number(getRouterParam(event, 'id'))
  const body = await readBody(event)
  const { jobId } = body

  if (!jobId) throw createError({ statusCode: 400, message: 'jobId required' })

  const db = useDb()
  const [visit] = await db.select().from(visits)
    .where(and(eq(visits.id, visitId), eq(visits.userId, user.id))).limit(1)
  if (!visit) throw createError({ statusCode: 404, message: 'Visit not found' })
  if (!visit.licensePlateId) throw createError({ statusCode: 400, message: 'Add a car first' })

  const [jv] = await db.insert(jobVisits).values({
    licensePlateId: visit.licensePlateId,
    jobId
  }).returning()

  return jv
})
