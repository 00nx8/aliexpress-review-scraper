import { requireUser } from '~~/server/utils/auth'
import { useDb } from '~~/server/db'
import { parts } from '~~/server/db/schema'

export default defineEventHandler(async (event) => {
  await requireUser(event)
  const body = await readBody(event)
  const { name, partNo, brand } = body
  if (!name) throw createError({ statusCode: 400, message: 'Name required' })
  const db = useDb()
  const [part] = await db.insert(parts).values({ name, partNo: partNo || '', brand: brand || '' }).returning()
  return part
})
