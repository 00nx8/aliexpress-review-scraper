import { requireUser } from '~~/server/utils/auth'
import { useDb } from '~~/server/db'
import { cars, vehicles, licensePlates, visits, customers, carTemplates } from '~~/server/db/schema'
import { eq, and, ilike, gte, lte, or } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const body = await readBody(event)
  const { plate, country } = body

  if (!plate) throw createError({ statusCode: 400, message: 'Plate required' })

  const config = useRuntimeConfig()
  const db = useDb()
  const normalizedPlate = plate.toUpperCase().replace(/\s/g, '')

  // Check if plate exists from a previous visit
  const existingLp = await db.select({
    id: licensePlates.id,
    licensePlate: licensePlates.licensePlate,
    carId: licensePlates.carId,
    vehicleId: licensePlates.vehicleId,
    visitId: licensePlates.visitId
  }).from(licensePlates)
    .where(eq(licensePlates.licensePlate, normalizedPlate))
    .limit(1)

  const [firstLp] = existingLp
  if (firstLp && (firstLp.carId || firstLp.vehicleId)) {
    let vehicleData = null
    if (firstLp.carId) {
      const [c] = await db.select().from(cars).where(eq(cars.id, firstLp.carId)).limit(1)
      vehicleData = c ? { source: 'nl', data: c } : null
    } else if (firstLp.vehicleId) {
      const [v] = await db.select().from(vehicles).where(eq(vehicles.id, firstLp.vehicleId)).limit(1)
      vehicleData = v ? { source: 'uk', data: v } : null
    }
    // Check if previous visit had a customer
    let previousCustomer = null
    if (firstLp.visitId) {
      const [prevVisit] = await db.select({ customerId: visits.customerId }).from(visits).where(eq(visits.id, firstLp.visitId)).limit(1)
      if (prevVisit?.customerId) {
        const [c] = await db.select().from(customers).where(eq(customers.id, prevVisit.customerId)).limit(1)
        previousCustomer = c || null
      }
    }
    if (vehicleData) {
      return { type: 'existing', licensePlateId: firstLp.id, vehicle: vehicleData, previousCustomer }
    }
  }

  // Country-specific lookup
  const countryCode = (country || 'uk').toLowerCase()

  if (countryCode === 'nl') {
    // RDW API
    const res = await $fetch<any[]>(`${config.public.carDetailsNl}?kenteken=${normalizedPlate}&$limit=1`)

    if (!res || !res.length) {
      throw createError({ statusCode: 404, message: 'Vehicle not found' })
    }
    const raw = res[0]
    return {
      type: 'nl_new',
      raw,
      preview: {
        brand: raw.merk || '',
        make: raw.handelsbenaming || '',
        year: raw.datum_eerste_toelating ? raw.datum_eerste_toelating.substring(0, 4) : '',
        engineSize: raw.cilinderinhoud ? `${(raw.cilinderinhoud / 1000).toFixed(1)}L` : '',
        fuelType: raw.brandstof_omschrijving || '',
        color: raw.eerste_kleur || ''
      }
    }
  } else {
    // DVLA API (UK/IE)
    try {
      const res = await $fetch<any>(config.public.carDetailsUk as string, {
        method: 'POST',
        headers: { 'x-api-key': config.carDetailsUkKey as string },
        body: { registrationNumber: normalizedPlate }
      })

      const make = res.make || ''
      const year = res.yearOfManufacture || 0
      const engineCc = res.engineCapacity || 0
      const fuelType = res.fuelType || ''

      // Match car templates: ±0.1L engine size
      const engineL = engineCc > 0 ? Math.round(engineCc / 100) / 10 : null
      let templates: any[] = []

      if (make && engineL) {
        templates = await db.select().from(carTemplates).where(
          and(
            ilike(carTemplates.brand, `%${make}%`),
            year ? and(lte(carTemplates.minYear, year), or(eq(carTemplates.maxYear, 0), gte(carTemplates.maxYear, year))) : undefined,
            lte(carTemplates.engineSize, `${(engineL + 0.1).toFixed(1)}`)
          )
        ).limit(20)
      }

      return {
        type: 'uk_new',
        raw: res,
        preview: { brand: make, make: '', year: String(year), engineCc, engineL, fuelType },
        templates
      }
    } catch {
      throw createError({ statusCode: 404, message: 'Vehicle not found' })
    }
  }
})
