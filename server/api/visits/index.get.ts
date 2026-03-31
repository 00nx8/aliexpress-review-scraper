import { requireUser } from '~~/server/utils/auth'
import { useDb } from '~~/server/db'
import { visits, customers, licensePlates, cars, vehicles, jobVisits, jobs, jobParts, parts } from '~~/server/db/schema'
import { eq, and, desc, inArray } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const query = getQuery(event)
  const db = useDb()

  const whereConditions = [eq(visits.userId, user.id)]
  if (query.status && query.status !== 'all') {
    whereConditions.push(eq(visits.status, query.status as any))
  }

  const visitList = await db.select({
    id: visits.id,
    status: visits.status,
    customerId: visits.customerId,
    licensePlateId: visits.licensePlateId
  }).from(visits)
    .where(and(...whereConditions))
    .orderBy(desc(visits.id))
    .limit(50)

  if (!visitList.length) return []

  // Enrich with related data
  const visitIds = visitList.map(v => v.id)
  const customerIds = visitList.map(v => v.customerId).filter(Boolean) as number[]
  const lpIds = visitList.map(v => v.licensePlateId).filter(Boolean) as number[]

  const [customerList, lpList, jvList] = await Promise.all([
    customerIds.length
      ? db.select().from(customers).where(inArray(customers.id, customerIds))
      : [],
    lpIds.length
      ? db.select().from(licensePlates).where(inArray(licensePlates.id, lpIds))
      : [],
    db.select({ visitJobId: jobVisits.id, licensePlateId: jobVisits.licensePlateId, jobId: jobVisits.jobId, jobName: jobs.name, labourHours: jobs.labourHours })
      .from(jobVisits)
      .innerJoin(jobs, eq(jobVisits.jobId, jobs.id))
      .where(lpIds.length ? inArray(jobVisits.licensePlateId, lpIds) : eq(jobVisits.licensePlateId, -1))
  ])

  // Get car details for license plates
  const carIds = lpList.map(l => l.carId).filter(Boolean) as number[]
  const vehicleIds = lpList.map(l => l.vehicleId).filter(Boolean) as number[]

  const [carList, vehicleList, jpList] = await Promise.all([
    carIds.length ? db.select({ id: cars.id, brand: cars.brand, make: cars.make, engineSize: cars.engineSize, year: cars.year }).from(cars).where(inArray(cars.id, carIds)) : [],
    vehicleIds.length ? db.select({ id: vehicles.id, brand: vehicles.brand, make: vehicles.make, engineSize: vehicles.engineSize, year: vehicles.year }).from(vehicles).where(inArray(vehicles.id, vehicleIds)) : [],
    lpIds.length
      ? db.select({ jobId: jobParts.jobId, unitCost: jobParts.unitCost, quantity: jobParts.quantity })
          .from(jobParts)
          .innerJoin(jobVisits, eq(jobParts.jobId, jobVisits.jobId))
          .where(inArray(jobVisits.licensePlateId, lpIds))
      : []
  ])

  const customerMap = Object.fromEntries(customerList.map(c => [c.id, c]))
  const lpMap = Object.fromEntries(lpList.map(l => [l.id, l]))
  const carMap = Object.fromEntries(carList.map(c => [c.id, c]))
  const vehicleMap = Object.fromEntries(vehicleList.map(v => [v.id, v]))

  return visitList.map((v) => {
    const lp = v.licensePlateId ? lpMap[v.licensePlateId] : null
    const car = lp?.carId ? carMap[lp.carId] : null
    const vehicle = lp?.vehicleId ? vehicleMap[lp.vehicleId] : null
    const vehicleInfo = car || vehicle
    const visitJobs = jvList.filter(j => j.licensePlateId === v.licensePlateId)
    const partsCost = jpList
      .filter(jp => visitJobs.some(j => j.jobId === jp.jobId))
      .reduce((sum, jp) => sum + (Number(jp.unitCost) * (jp.quantity || 1)), 0)
    const labourCost = visitJobs.reduce((sum, j) => sum + Number(j.labourHours), 0)

    return {
      id: v.id,
      status: v.status,
      customer: v.customerId ? customerMap[v.customerId] : null,
      licensePlate: lp?.licensePlate || null,
      vehicle: vehicleInfo ? {
        brand: vehicleInfo.brand,
        make: vehicleInfo.make,
        engineSize: vehicleInfo.engineSize,
        year: vehicleInfo.year
      } : null,
      jobs: visitJobs.slice(0, 3).map(j => j.jobName),
      moreJobs: Math.max(0, visitJobs.length - 3),
      totalCost: labourCost + partsCost
    }
  })
})
