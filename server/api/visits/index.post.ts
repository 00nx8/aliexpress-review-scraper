import { requireUser } from '~~/server/utils/auth'
import { useDb } from '~~/server/db'
import { visits } from '~~/server/db/schema'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const db = useDb()

  const [visit] = await db.insert(visits).values({
    userId: user.id,
    status: 'in_progress'
  }).returning()

  return visit
})
