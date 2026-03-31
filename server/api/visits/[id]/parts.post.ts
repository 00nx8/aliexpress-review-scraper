import { requireUser } from '~~/server/utils/auth'
import { useDb } from '~~/server/db'
import { visits, parts, jobParts, jobVisits } from '~~/server/db/schema'
import { eq, and } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const visitId = Number(getRouterParam(event, 'id'))
  const body = await readBody(event)
  const { name, partNo, brand, unitCost, quantity = 1, jobId, source = 'manual', partId: existingPartId } = body

  if (!existingPartId && (!name || !unitCost)) throw createError({ statusCode: 400, message: 'name and unitCost required' })

  const db = useDb()
  const [visit] = await db.select().from(visits)
    .where(and(eq(visits.id, visitId), eq(visits.userId, user.id))).limit(1)
  if (!visit) throw createError({ statusCode: 404, message: 'Visit not found' })

  // Get first job for this visit if no jobId provided
  let targetJobId = jobId
  if (!targetJobId && visit.licensePlateId) {
    const [firstJob] = await db.select().from(jobVisits)
      .where(eq(jobVisits.licensePlateId, visit.licensePlateId)).limit(1)
    targetJobId = firstJob?.jobId
  }

  // Use existing part or create new one
  let partId: number
  if (existingPartId) {
    partId = existingPartId
  } else {
    const [part] = await db.insert(parts).values({
      name,
      partNo: partNo || '',
      brand: brand || ''
    }).returning()
    partId = part!.id
  }

  // Link part to job
  let jp = null
  if (targetJobId) {
    const [inserted] = await db.insert(jobParts).values({
      jobId: targetJobId,
      partId,
      quantity,
      unitCost: String(unitCost),
      source
    }).returning()
    jp = inserted
  }

  return { partId, jobPart: jp }
})
