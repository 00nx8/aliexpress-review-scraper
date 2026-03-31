import { requireUser } from '~~/server/utils/auth'
import { useDb } from '~~/server/db'
import { users, garages } from '~~/server/db/schema'
import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const sessionUser = await requireUser(event)
  const body = await readBody(event)
  const db = useDb()

  const userUpdates: Record<string, any> = {}
  if (body.phoneNo !== undefined) userUpdates.phoneNo = body.phoneNo
  if (body.hourlyRate !== undefined) userUpdates.hourlyRate = String(body.hourlyRate)
  if (body.partsMarkup !== undefined) userUpdates.partsMarkup = String(body.partsMarkup)
  if (body.vatRate !== undefined) userUpdates.vatRate = String(body.vatRate)

  if (Object.keys(userUpdates).length) {
    await db.update(users).set(userUpdates).where(eq(users.id, sessionUser.id))
  }

  const [user] = await db.select().from(users).where(eq(users.id, sessionUser.id)).limit(1)

  if (user && user.garageId && (body.garageName !== undefined || body.garageEmail !== undefined || body.garagePhone !== undefined || body.garageAddress !== undefined)) {
    const garageUpdates: Record<string, any> = {}
    if (body.garageName !== undefined) garageUpdates.name = body.garageName
    if (body.garageEmail !== undefined) garageUpdates.email = body.garageEmail
    if (body.garagePhone !== undefined) garageUpdates.phoneNo = body.garagePhone
    if (body.garageAddress !== undefined) garageUpdates.address = body.garageAddress
    await db.update(garages).set(garageUpdates).where(eq(garages.id, user.garageId))
  }

  return { ok: true }
})
