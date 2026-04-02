import { requireUser } from '~~/server/utils/auth'
import { useDb } from '~~/server/db'
import { parts } from '~~/server/db/schema'
import { and, ilike } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  await requireUser(event)
  const body = await readBody(event)
  const { name, partNo, brand } = body
  if (!name) throw createError({ statusCode: 400, message: 'Name required' })
  const db = useDb()

  // Check for existing part with same name and brand to avoid duplicates
  const [existing] = await db.select().from(parts)
    .where(and(ilike(parts.name, name), ilike(parts.brand, brand || '')))
    .limit(1)
  if (existing) {
    throw createError({
      statusCode: 409,
      message: 'A part with this name and brand already exists. Use the existing part and adjust the price instead.'
    })
  }

  const [part] = await db.insert(parts).values({ name, partNo: partNo || '', brand: brand || '' }).returning()
  return part
})
