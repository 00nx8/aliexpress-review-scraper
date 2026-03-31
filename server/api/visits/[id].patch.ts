import { requireUser } from '~~/server/utils/auth'
import { useDb } from '~~/server/db'
import { visits } from '~~/server/db/schema'
import { eq, and } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const id = Number(getRouterParam(event, 'id'))
  const body = await readBody(event)
  const db = useDb()

  const allowed = ['status', 'customerId', 'licensePlateId']
  const updates: Record<string, any> = {}
  for (const key of allowed) {
    if (body[key] !== undefined) updates[key] = body[key]
  }

  const [updated] = await db.update(visits)
    .set(updates)
    .where(and(eq(visits.id, id), eq(visits.userId, user.id)))
    .returning()

  if (!updated) throw createError({ statusCode: 404, message: 'Visit not found' })
  return updated
})
