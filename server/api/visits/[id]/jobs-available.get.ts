import { requireUser } from '~~/server/utils/auth'
import { useDb } from '~~/server/db'
import { visits, licensePlates, cars, vehicles, carJobs, jobs, carTemplates } from '~~/server/db/schema'
import { eq, and, ilike, inArray } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const visitId = Number(getRouterParam(event, 'id'))
  const query = getQuery(event)
  const db = useDb()

  const [visit] = await db.select().from(visits)
    .where(and(eq(visits.id, visitId), eq(visits.userId, user.id))).limit(1)
  if (!visit) throw createError({ statusCode: 404, message: 'Visit not found' })

  let jobList: any[] = []

  if (visit.licensePlateId) {
    const [lp] = await db.select().from(licensePlates)
      .where(eq(licensePlates.id, visit.licensePlateId)).limit(1)

    if (lp) {
      let brand = '', make = '', yearStr = '', engineSize = ''

      if (lp.carId) {
        const [c] = await db.select({ brand: cars.brand, make: cars.make, year: cars.year, engineSize: cars.engineSize })
          .from(cars).where(eq(cars.id, lp.carId)).limit(1)
        if (c) { brand = c.brand || ''; make = c.make || ''; yearStr = c.year || ''; engineSize = c.engineSize || '' }
      } else if (lp.vehicleId) {
        const [v] = await db.select({ brand: vehicles.brand, make: vehicles.make, year: vehicles.year, engineSize: vehicles.engineSize })
          .from(vehicles).where(eq(vehicles.id, lp.vehicleId)).limit(1)
        if (v) { brand = v.brand || ''; make = v.make || ''; yearStr = v.year || ''; engineSize = v.engineSize || '' }
      }

      if (brand && make) {
        const year = parseInt(yearStr) || 0

        // Get all templates matching brand + make
        const candidates = await db.select({
          id: carTemplates.id,
          engineSize: carTemplates.engineSize,
          minYear: carTemplates.minYear,
          maxYear: carTemplates.maxYear
        }).from(carTemplates)
          .where(and(
            ilike(carTemplates.brand, `%${brand}%`),
            ilike(carTemplates.make, `%${make}%`)
          ))

        if (candidates.length) {
          // Score each template: lower = better match
          const carEnginePrefix = engineSize.match(/^[\d.]+/)?.[0] || ''

          const scored = candidates.map((t) => {
            let score = 0

            // Year scoring
            if (year > 0) {
              const inRange = t.minYear <= year && (t.maxYear === 0 || t.maxYear >= year)
              if (!inRange) {
                const distLow = Math.abs(year - t.minYear)
                const distHigh = t.maxYear > 0 ? Math.abs(year - t.maxYear) : distLow
                score += Math.min(distLow, distHigh)
              }
            }

            // Engine size scoring: penalise if prefix doesn't match
            if (carEnginePrefix) {
              const tplPrefix = t.engineSize.match(/^[\d.]+/)?.[0] || ''
              if (tplPrefix && tplPrefix !== carEnginePrefix) score += 100
            }

            return { id: t.id, score }
          })

          // Sort by score ascending, take best
          scored.sort((a, b) => a.score - b.score)
          const bestScore = scored[0]!.score
          const bestIds = scored.filter(s => s.score === bestScore).map(s => s.id)

          // Get job IDs for best matching template(s)
          const cjs = await db.select({ jobId: carJobs.jobId })
            .from(carJobs)
            .where(inArray(carJobs.carId, bestIds))
          const jobIds = [...new Set(cjs.map(c => c.jobId))].filter(Boolean) as number[]

          if (jobIds.length) {
            jobList = await db.select({
              id: jobs.id,
              name: jobs.name,
              category: jobs.category,
              labourHours: jobs.labourHours,
              lowRange: jobs.lowRange,
              highRange: jobs.highRange
            }).from(jobs)
              .where(
                query.search
                  ? and(inArray(jobs.id, jobIds), ilike(jobs.name, `%${query.search}%`))
                  : inArray(jobs.id, jobIds)
              )
              .limit(200)
          }

          // If search found nothing within the best template, try next score tier
          if (!jobList.length && query.search && scored.length > bestIds.length) {
            const nextScore = scored.find(s => s.score !== bestScore)?.score
            if (nextScore !== undefined) {
              const nextIds = scored.filter(s => s.score === nextScore).map(s => s.id)
              const cjs2 = await db.select({ jobId: carJobs.jobId })
                .from(carJobs).where(inArray(carJobs.carId, nextIds))
              const jobIds2 = [...new Set(cjs2.map(c => c.jobId))].filter(Boolean) as number[]
              if (jobIds2.length) {
                jobList = await db.select({
                  id: jobs.id, name: jobs.name, category: jobs.category,
                  labourHours: jobs.labourHours, lowRange: jobs.lowRange, highRange: jobs.highRange
                }).from(jobs)
                  .where(and(inArray(jobs.id, jobIds2), ilike(jobs.name, `%${query.search}%`)))
                  .limit(200)
              }
            }
          }
        }
      }
    }
  }

  // Global fallback: only when NO car is linked and there's a search term
  if (!jobList.length && query.search && !visit.licensePlateId) {
    jobList = await db.select({
      id: jobs.id,
      name: jobs.name,
      category: jobs.category,
      labourHours: jobs.labourHours,
      lowRange: jobs.lowRange,
      highRange: jobs.highRange
    }).from(jobs)
      .where(ilike(jobs.name, `%${query.search}%`))
      .limit(100)
  }

  // Group by category
  const grouped: Record<string, any[]> = {}
  for (const job of jobList) {
    const cat = job.category || 'Other'
    if (!grouped[cat]) grouped[cat] = []
    grouped[cat].push(job)
  }

  return grouped
})
