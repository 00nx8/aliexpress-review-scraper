import { requireUser } from '~~/server/utils/auth'
import { useDb } from '~~/server/db'
import { visits, jobVisits } from '~~/server/db/schema'
import { eq, and } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const visitId = Number(getRouterParam(event, 'id'))
  const jobVisitId = Number(getRouterParam(event, 'jobVisitId'))
  const db = useDb()

  const [visit] = await db.select().from(visits)
    .where(and(eq(visits.id, visitId), eq(visits.userId, user.id))).limit(1)
  if (!visit) throw createError({ statusCode: 404, message: 'Visit not found' })

  await db.delete(jobVisits).where(eq(jobVisits.id, jobVisitId))
  return { ok: true }
})
