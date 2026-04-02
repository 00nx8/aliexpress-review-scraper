import { requireUser } from '~~/server/utils/auth'
import { useDb } from '~~/server/db'
import { visits, licensePlates, jobVisits, jobParts, charges, invoices, parsedDocuments } from '~~/server/db/schema'
import { eq, and, inArray } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const id = Number(getRouterParam(event, 'id'))
  const db = useDb()

  const [visit] = await db.select().from(visits)
    .where(and(eq(visits.id, id), eq(visits.userId, user.id)))
    .limit(1)
  if (!visit) throw createError({ statusCode: 404, message: 'Visit not found' })

  // 1. Delete parsedDocuments for this visit
  await db.delete(parsedDocuments).where(eq(parsedDocuments.visitId, id))

  // 2–3. Delete jobParts and jobVisits via this visit's licensePlates
  const lps = await db.select({ id: licensePlates.id })
    .from(licensePlates)
    .where(eq(licensePlates.visitId, id))
  const lpIds = lps.map(l => l.id)

  if (lpIds.length) {
    const jvs = await db.select({ jobId: jobVisits.jobId })
      .from(jobVisits)
      .where(inArray(jobVisits.licensePlateId, lpIds))
    const jobIds = [...new Set(jvs.map(j => j.jobId))].filter(Boolean) as number[]

    if (jobIds.length) {
      await db.delete(jobParts).where(inArray(jobParts.jobId, jobIds))
    }
    await db.delete(jobVisits).where(inArray(jobVisits.licensePlateId, lpIds))
  }

  // 4. Delete charges for this visit
  await db.delete(charges).where(eq(charges.visitId, id))

  // 5. Delete invoices for this visit
  await db.delete(invoices).where(eq(invoices.visitId, id))

  // 6. Delete licensePlates for this visit
  await db.delete(licensePlates).where(eq(licensePlates.visitId, id))

  // 7. Delete the visit itself
  await db.delete(visits).where(eq(visits.id, id))

  return { ok: true }
})
