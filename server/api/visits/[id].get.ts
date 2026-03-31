import { requireUser } from '~~/server/utils/auth'
import { useDb } from '~~/server/db'
import { visits, customers, licensePlates, cars, vehicles, jobVisits, jobs, jobParts, parts, charges, chargeTemplates, invoices } from '~~/server/db/schema'
import { eq, and, inArray } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const id = Number(getRouterParam(event, 'id'))
  const db = useDb()

  const [visit] = await db.select().from(visits)
    .where(and(eq(visits.id, id), eq(visits.userId, user.id)))
    .limit(1)

  if (!visit) throw createError({ statusCode: 404, message: 'Visit not found' })

  const [customerData, lpData, invoiceData] = await Promise.all([
    visit.customerId
      ? db.select().from(customers).where(eq(customers.id, visit.customerId)).limit(1)
      : [],
    visit.licensePlateId
      ? db.select().from(licensePlates).where(eq(licensePlates.id, visit.licensePlateId)).limit(1)
      : []
    ,
    db.select().from(invoices).where(eq(invoices.visitId, visit.id)).limit(1)
  ])

  const lp = lpData[0] || null
  let carData = null
  if (lp?.carId) {
    const [c] = await db.select().from(cars).where(eq(cars.id, lp.carId)).limit(1)
    carData = c || null
  } else if (lp?.vehicleId) {
    const [v] = await db.select().from(vehicles).where(eq(vehicles.id, lp.vehicleId)).limit(1)
    carData = v || null
  }

  // Get jobs for this visit via license plate
  const visitJobList = lp
    ? await db.select({
        id: jobVisits.id,
        jobId: jobs.id,
        name: jobs.name,
        category: jobs.category,
        labourHours: jobs.labourHours,
        lowRange: jobs.lowRange,
        highRange: jobs.highRange
      }).from(jobVisits)
        .innerJoin(jobs, eq(jobVisits.jobId, jobs.id))
        .where(eq(jobVisits.licensePlateId, lp.id))
    : []

  // Get parts for these jobs
  const jobIds = visitJobList.map(j => j.jobId)
  const partsList = jobIds.length
    ? await db.select({
        id: jobParts.id,
        jobId: jobParts.jobId,
        partId: parts.id,
        name: parts.name,
        partNo: parts.partNo,
        brand: parts.brand,
        quantity: jobParts.quantity,
        unitCost: jobParts.unitCost,
        source: jobParts.source
      }).from(jobParts)
        .innerJoin(parts, eq(jobParts.partId, parts.id))
        .where(inArray(jobParts.jobId, jobIds))
    : []

  // Get charges for this visit directly
  const chargesList = await db.select({
    id: charges.id,
    name: charges.name,
    price: charges.price,
    description: charges.description,
    visitId: charges.visitId,
    chargeTemplateId: charges.chargeTemplateId
  }).from(charges)
    .where(eq(charges.visitId, visit.id))

  return {
    visit,
    customer: customerData[0] || null,
    licensePlate: lp?.licensePlate || null,
    car: carData ? {
      brand: (carData as any).brand,
      make: (carData as any).make,
      engineSize: (carData as any).engineSize,
      year: (carData as any).year,
      fuelType: (carData as any).fuelType
    } : null,
    jobs: visitJobList,
    parts: partsList,
    charges: chargesList,
    invoice: invoiceData[0] || null
  }
})
