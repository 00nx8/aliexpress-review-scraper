import { requireUser } from '~~/server/utils/auth'
import { useDb } from '~~/server/db'
import { dtcCodes } from '~~/server/db/schema'
import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  await requireUser(event)
  const id = Number(getRouterParam(event, 'id'))
  const db = useDb()

  const [code] = await db.select().from(dtcCodes).where(eq(dtcCodes.id, id)).limit(1)
  if (!code) throw createError({ statusCode: 404, message: 'DTC code not found' })

  return code
})
