import { requireUser } from '~~/server/utils/auth'
import { useDb } from '~~/server/db'
import { cars, vehicles, licensePlates, visits } from '~~/server/db/schema'
import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const body = await readBody(event)
  const { visitId, plate, source, raw, templateId, existingLicensePlateId, linkCustomerId } = body

  if (!visitId || !plate) throw createError({ statusCode: 400, message: 'visitId and plate required' })

  const db = useDb()
  const normalizedPlate = plate.toUpperCase().replace(/\s/g, '')

  // Re-use existing license plate record
  if (source === 'existing' && existingLicensePlateId) {
    const updates: Record<string, any> = { licensePlateId: existingLicensePlateId }
    if (linkCustomerId) updates.customerId = linkCustomerId
    await db.update(visits).set(updates).where(eq(visits.id, visitId))
    return { ok: true, licensePlateId: existingLicensePlateId }
  }

  let carId: number | null = null
  let vehicleId: number | null = null

  if (source === 'nl') {
    const r = raw
    const [car] = await db.insert(cars).values({
      brand: r.merk || '',
      make: r.handelsbenaming || '',
      year: r.datum_eerste_toelating ? r.datum_eerste_toelating.substring(0, 4) : null,
      fuelType: r.brandstof_omschrijving || '',
      engineDisplacement: r.cilinderinhoud ? Number(r.cilinderinhoud) : null,
      engineSize: r.cilinderinhoud ? `${(r.cilinderinhoud / 1000).toFixed(1)}L` : '',
      primaryColor: r.eerste_kleur || null
    }).returning()
    carId = car!.id
  } else {
    // UK/IE
    const r = raw
    const [vehicle] = await db.insert(vehicles).values({
      brand: r.make || '',
      make: r.make || '',
      year: String(r.yearOfManufacture || ''),
      fuelType: r.fuelType || '',
      engineDisplacement: r.engineCapacity ? Number(r.engineCapacity) : null,
      engineSize: r.engineCapacity ? `${(r.engineCapacity / 1000).toFixed(1)}L` : ''
    }).returning()
    vehicleId = vehicle!.id
  }

  // Create license plate record
  const [lp] = await db.insert(licensePlates).values({
    licensePlate: normalizedPlate,
    carId,
    vehicleId,
    visitId
  }).returning()

  // Link to visit
  await db.update(visits).set({ licensePlateId: lp!.id }).where(eq(visits.id, visitId))

  return { ok: true, licensePlateId: lp!.id }
})
