import { requireUser } from '~~/server/utils/auth'
import { useDb } from '~~/server/db'
import { invoices, visits } from '~~/server/db/schema'
import { eq, and } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const visitId = Number(getRouterParam(event, 'id'))
  const db = useDb()

  await db.update(invoices).set({ status: 'paid', paidAt: new Date() })
    .where(eq(invoices.visitId, visitId))

  await db.update(visits).set({ status: 'complete' })
    .where(and(eq(visits.id, visitId), eq(visits.userId, user.id)))

  return { ok: true }
})
