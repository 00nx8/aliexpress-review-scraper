import { requireUser } from '~~/server/utils/auth'
import { useDb } from '~~/server/db'
import {
  users, garages, visits, licensePlates, jobVisits, jobParts,
  charges, invoices, parsedDocuments, passwordReset
} from '~~/server/db/schema'
import { eq, and, inArray, ne } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const sessionUser = await requireUser(event)
  const db = useDb()

  // Load full user record (need garageId)
  const [user] = await db.select({ id: users.id, garageId: users.garageId })
    .from(users).where(eq(users.id, sessionUser.id)).limit(1)
  if (!user) throw createError({ statusCode: 404, message: 'User not found' })

  await db.transaction(async (tx) => {
    // Get all visits for this user
    const userVisits = await tx.select({ id: visits.id })
      .from(visits).where(eq(visits.userId, user.id))

    const visitIds = userVisits.map(v => v.id)

    if (visitIds.length) {
      // Delete parsedDocuments for all visits
      await tx.delete(parsedDocuments).where(inArray(parsedDocuments.visitId, visitIds))

      // Get all licensePlates created by these visits
      const lps = await tx.select({ id: licensePlates.id })
        .from(licensePlates)
        .where(inArray(licensePlates.visitId, visitIds))
      const lpIds = lps.map(l => l.id)

      if (lpIds.length) {
        // Get jobVisits for those license plates
        const jvs = await tx.select({ jobId: jobVisits.jobId })
          .from(jobVisits)
          .where(inArray(jobVisits.licensePlateId, lpIds))
        const jobIds = [...new Set(jvs.map(j => j.jobId))].filter(Boolean) as number[]

        if (jobIds.length) {
          await tx.delete(jobParts).where(inArray(jobParts.jobId, jobIds))
        }
        await tx.delete(jobVisits).where(inArray(jobVisits.licensePlateId, lpIds))
      }

      // Delete charges, invoices, licensePlates for these visits
      await tx.delete(charges).where(inArray(charges.visitId, visitIds))
      await tx.delete(invoices).where(inArray(invoices.visitId, visitIds))
      await tx.delete(licensePlates).where(inArray(licensePlates.visitId, visitIds))
    }

    // Delete any remaining parsedDocuments by userId
    await tx.delete(parsedDocuments).where(eq(parsedDocuments.userId, user.id))

    // Delete all visits
    await tx.delete(visits).where(eq(visits.userId, user.id))

    // Delete passwordReset records
    await tx.delete(passwordReset).where(eq(passwordReset.userId, user.id))

    // Handle garage: nullify garageId, delete garage if no other users share it
    if (user.garageId) {
      const otherUsers = await tx.select({ id: users.id })
        .from(users)
        .where(and(eq(users.garageId, user.garageId), ne(users.id, user.id)))
        .limit(1)

      await tx.update(users).set({ garageId: null }).where(eq(users.id, user.id))

      if (!otherUsers.length) {
        await tx.delete(garages).where(eq(garages.id, user.garageId))
      }
    }

    // Delete the user
    await tx.delete(users).where(eq(users.id, user.id))
  })

  await clearUserSession(event)
  return { ok: true }
})
