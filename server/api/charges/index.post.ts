import { requireUser } from '~~/server/utils/auth'
import { useDb } from '~~/server/db'
import { chargeTemplates } from '~~/server/db/schema'

export default defineEventHandler(async (event) => {
  await requireUser(event)
  const body = await readBody(event)
  const { name, price, description } = body
  if (!name) throw createError({ statusCode: 400, message: 'Name required' })

  const db = useDb()
  const [ct] = await db.insert(chargeTemplates).values({ name, price: String(price || 0), description: description || '' }).returning()
  return ct
})
