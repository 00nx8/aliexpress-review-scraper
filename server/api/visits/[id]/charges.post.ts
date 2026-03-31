import { requireUser } from '~~/server/utils/auth'
import { useDb } from '~~/server/db'
import { visits, charges } from '~~/server/db/schema'
import { eq, and } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const visitId = Number(getRouterParam(event, 'id'))
  const body = await readBody(event)
  const { chargeTemplateId, name, price, description } = body

  const db = useDb()
  const [visit] = await db.select().from(visits)
    .where(and(eq(visits.id, visitId), eq(visits.userId, user.id))).limit(1)
  if (!visit) throw createError({ statusCode: 404, message: 'Visit not found' })

  const [charge] = await db.insert(charges).values({
    name: name || 'Misc charge',
    price: String(price || 0),
    description: description || '',
    chargeTemplateId: chargeTemplateId || null,
    visitId: visitId
  }).returning()

  return charge
})
