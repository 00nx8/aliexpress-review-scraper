import { requireUser } from '~~/server/utils/auth'
import { useDb } from '~~/server/db'
import { customers, visits } from '~~/server/db/schema'
import { eq, and } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const body = await readBody(event)
  const { name, email, phoneNo, visitId } = body

  if (!name) throw createError({ statusCode: 400, message: 'Name required' })

  const db = useDb()
  const { existingCustomerId } = body

  let customerId: number

  if (existingCustomerId) {
    // Link existing customer — do not insert
    customerId = existingCustomerId
  } else {
    const [customer] = await db.insert(customers).values({
      name,
      email: email || '',
      phoneNo: phoneNo || ''
    }).returning()
    customerId = customer!.id
  }

  if (visitId) {
    await db.update(visits).set({ customerId })
      .where(and(eq(visits.id, visitId), eq(visits.userId, user.id)))
  }

  return { id: customerId }
})
