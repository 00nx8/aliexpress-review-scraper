import { requireUser } from '~~/server/utils/auth'
import { useDb } from '~~/server/db'
import { parts, jobParts, jobVisits, visits, parsedDocuments } from '~~/server/db/schema'
import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const body = await readBody(event)
  const { visitId, parsedParts, docId } = body

  if (!visitId || !parsedParts?.length) {
    throw createError({ statusCode: 400, message: 'visitId and parsedParts required' })
  }

  const db = useDb()
  const [visit] = await db.select().from(visits)
    .where(eq(visits.id, visitId)).limit(1)
  if (!visit) throw createError({ statusCode: 404, message: 'Visit not found' })

  // Get first job for the visit
  let targetJobId: number | null = null
  if (visit.licensePlateId) {
    const [jv] = await db.select().from(jobVisits)
      .where(eq(jobVisits.licensePlateId, visit.licensePlateId)).limit(1)
    targetJobId = jv?.jobId ?? null
  }

  for (const p of parsedParts) {
    const [part] = await db.insert(parts).values({
      name: p.name,
      partNo: p.partNo || '',
      brand: p.brand || ''
    }).returning()

    if (targetJobId) {
      await db.insert(jobParts).values({
        jobId: targetJobId,
        partId: part!.id,
        quantity: p.quantity || 1,
        unitCost: String(p.unitCost || 0),
        source: p.source || 'manual'
      })
    }
  }

  if (docId) {
    await db.update(parsedDocuments).set({ status: 'processed' }).where(eq(parsedDocuments.id, docId))
  }

  return { ok: true }
})
