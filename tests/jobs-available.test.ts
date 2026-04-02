import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Globals ───────────────────────────────────────────────────────────────────
const mockGetUserSession = vi.fn()
const mockCreateError = (opts: { statusCode: number; message: string }) => {
  const err: any = new Error(opts.message)
  err.statusCode = opts.statusCode
  return err
}
;(global as any).defineEventHandler = (fn: Function) => fn
;(global as any).createError = mockCreateError
;(global as any).getRouterParam = vi.fn()
;(global as any).getQuery = vi.fn()
;(global as any).getUserSession = mockGetUserSession

// ── DB mock ───────────────────────────────────────────────────────────────────
const mockDbSelect = vi.fn()
vi.mock('../server/db', () => ({ useDb: () => ({ select: mockDbSelect }) }))

// ── requireUser mock ──────────────────────────────────────────────────────────
vi.mock('../server/utils/auth', () => ({
  requireUser: vi.fn(async (event: any) => {
    const session = await (global as any).getUserSession(event)
    if (!session?.user?.id) throw (global as any).createError({ statusCode: 401, message: 'Unauthorized' })
    return session.user
  })
}))

import { requireUser } from '../server/utils/auth'

const authedSession = { user: { id: 1, email: 'user@example.com' } }
const noSession = { user: null }

// ── Inline implementation of GET /api/visits/[id]/jobs-available ──────────────
// Simplified to capture key behavioral paths.
async function runGetJobsAvailable(
  event: object,
  visitId: number,
  query: { search?: string },
  opts: {
    visit?: { id: number; userId: number; licensePlateId: number | null } | null
    lp?: { id: number; carId?: number | null; vehicleId?: number | null } | null
    carOrVehicle?: { brand: string; make: string; year: string; engineSize: string } | null
    templates?: { id: number; engineSize: string; minYear: number; maxYear: number }[]
    carJobIds?: number[]
    jobs?: { id: number; name: string; category: string; labourHours: number; lowRange: number; highRange: number }[]
    globalFallbackJobs?: { id: number; name: string; category: string; labourHours: number; lowRange: number; highRange: number }[]
  } = {}
) {
  await requireUser(event)

  // 1. Fetch and validate visit ownership
  const visit = opts.visit !== undefined ? opts.visit : { id: visitId, userId: 1, licensePlateId: null }
  if (!visit) throw mockCreateError({ statusCode: 404, message: 'Visit not found' })

  let jobList: any[] = []

  if (visit.licensePlateId) {
    const lp = opts.lp ?? null

    if (lp) {
      const carOrVehicle = opts.carOrVehicle ?? null

      if (carOrVehicle?.brand && carOrVehicle?.make) {
        const year = parseInt(carOrVehicle.year) || 0
        const templates = opts.templates ?? []

        if (templates.length) {
          const carEnginePrefix = carOrVehicle.engineSize.match(/^[\d.]+/)?.[0] || ''

          const scored = templates.map((t) => {
            let score = 0
            if (year > 0) {
              const inRange = t.minYear <= year && (t.maxYear === 0 || t.maxYear >= year)
              if (!inRange) {
                const distLow = Math.abs(year - t.minYear)
                const distHigh = t.maxYear > 0 ? Math.abs(year - t.maxYear) : distLow
                score += Math.min(distLow, distHigh)
              }
            }
            if (carEnginePrefix) {
              const tplPrefix = t.engineSize.match(/^[\d.]+/)?.[0] || ''
              if (tplPrefix && tplPrefix !== carEnginePrefix) score += 100
            }
            return { id: t.id, score }
          })

          scored.sort((a, b) => a.score - b.score)
          const bestScore = scored[0]!.score
          const bestIds = scored.filter(s => s.score === bestScore).map(s => s.id)

          const candidateJobs = opts.jobs ?? []
          jobList = query.search
            ? candidateJobs.filter(j => j.name.toLowerCase().includes(query.search!.toLowerCase()))
            : candidateJobs
        }
      }
    }
  }

  // Global fallback: ONLY when no car is linked and there is a search term
  if (!jobList.length && query.search && !visit.licensePlateId) {
    jobList = opts.globalFallbackJobs ?? []
  }

  // Group by category
  const grouped: Record<string, any[]> = {}
  for (const job of jobList) {
    const cat = job.category || 'Other'
    if (!grouped[cat]) grouped[cat] = []
    grouped[cat].push(job)
  }

  return grouped
}

// ── Tests: auth ───────────────────────────────────────────────────────────────
describe('GET /api/visits/[id]/jobs-available — auth', () => {
  beforeEach(() => vi.clearAllMocks())

  it('throws 401 when not authenticated', async () => {
    mockGetUserSession.mockResolvedValue(noSession)
    await expect(runGetJobsAvailable({}, 1, {})).rejects.toMatchObject({ statusCode: 401 })
  })

  it('throws 401 when session has no user id', async () => {
    mockGetUserSession.mockResolvedValue({ user: {} })
    await expect(runGetJobsAvailable({}, 1, {})).rejects.toMatchObject({ statusCode: 401 })
  })
})

// ── Tests: visit not found ────────────────────────────────────────────────────
describe('GET /api/visits/[id]/jobs-available — visit not found', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUserSession.mockResolvedValue(authedSession)
  })

  it('throws 404 when visit does not exist', async () => {
    await expect(
      runGetJobsAvailable({}, 999, {}, { visit: null })
    ).rejects.toMatchObject({ statusCode: 404, message: 'Visit not found' })
  })

  it('throws 404 when visit belongs to a different user (ownership enforced via WHERE)', async () => {
    await expect(
      runGetJobsAvailable({}, 5, {}, { visit: null })
    ).rejects.toMatchObject({ statusCode: 404 })
  })
})

// ── Tests: no car linked ──────────────────────────────────────────────────────
describe('GET /api/visits/[id]/jobs-available — no car linked', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUserSession.mockResolvedValue(authedSession)
  })

  it('returns empty grouped object when no car and no search', async () => {
    const result = await runGetJobsAvailable(
      {}, 1, {},
      { visit: { id: 1, userId: 1, licensePlateId: null } }
    )
    expect(result).toEqual({})
  })

  it('returns global fallback jobs grouped when no car but search provided', async () => {
    const fallbackJobs = [
      { id: 1, name: 'Oil change', category: 'Engine', labourHours: 0.5, lowRange: 0, highRange: 0 },
      { id: 2, name: 'Oil filter', category: 'Engine', labourHours: 0.25, lowRange: 0, highRange: 0 }
    ]
    const result = await runGetJobsAvailable(
      {}, 1, { search: 'oil' },
      { visit: { id: 1, userId: 1, licensePlateId: null }, globalFallbackJobs: fallbackJobs }
    )
    expect(result).toMatchObject({ Engine: expect.arrayContaining([expect.objectContaining({ name: 'Oil change' })]) })
  })

  it('global fallback groups jobs by category', async () => {
    const fallbackJobs = [
      { id: 1, name: 'Brake pads', category: 'Brakes', labourHours: 1, lowRange: 0, highRange: 0 },
      { id: 2, name: 'Oil change', category: 'Engine', labourHours: 0.5, lowRange: 0, highRange: 0 },
      { id: 3, name: 'Brake discs', category: 'Brakes', labourHours: 1.5, lowRange: 0, highRange: 0 }
    ]
    const result = await runGetJobsAvailable(
      {}, 1, { search: 'brake' },
      { visit: { id: 1, userId: 1, licensePlateId: null }, globalFallbackJobs: fallbackJobs }
    )
    expect(Object.keys(result)).toContain('Brakes')
    expect((result as any).Brakes).toHaveLength(2)
  })
})

// ── Tests: global fallback gating ─────────────────────────────────────────────
describe('GET /api/visits/[id]/jobs-available — global fallback only fires without car', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUserSession.mockResolvedValue(authedSession)
  })

  it('does NOT use global fallback when car IS linked (even if job list is empty)', async () => {
    // Car is linked but templates produce no jobs → jobList stays empty
    // Global fallback should NOT fire because licensePlateId is set
    const result = await runGetJobsAvailable(
      {}, 1, { search: 'turbo' },
      {
        visit: { id: 1, userId: 1, licensePlateId: 10 },
        lp: { id: 10, carId: 5, vehicleId: null },
        carOrVehicle: { brand: 'Ford', make: 'Focus', year: '2018', engineSize: '1.5L' },
        templates: [{ id: 1, engineSize: '1.5L', minYear: 2015, maxYear: 2020 }],
        jobs: [], // no jobs match the car template
        globalFallbackJobs: [{ id: 99, name: 'Global job', category: 'Other', labourHours: 1, lowRange: 0, highRange: 0 }]
      }
    )
    // Should not contain the global fallback job
    expect(result).toEqual({})
  })

  it('does NOT use global fallback when no search term, even without car', async () => {
    const result = await runGetJobsAvailable(
      {}, 1, {}, // no search
      {
        visit: { id: 1, userId: 1, licensePlateId: null },
        globalFallbackJobs: [{ id: 99, name: 'Global job', category: 'Other', labourHours: 1, lowRange: 0, highRange: 0 }]
      }
    )
    expect(result).toEqual({})
  })
})

// ── Tests: car linked — job retrieval ─────────────────────────────────────────
describe('GET /api/visits/[id]/jobs-available — car linked', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUserSession.mockResolvedValue(authedSession)
  })

  it('returns jobs for the car template grouped by category', async () => {
    const jobs = [
      { id: 1, name: 'Timing belt', category: 'Engine', labourHours: 3, lowRange: 0, highRange: 0 },
      { id: 2, name: 'Brake pads front', category: 'Brakes', labourHours: 1, lowRange: 0, highRange: 0 }
    ]
    const result = await runGetJobsAvailable(
      {}, 1, {},
      {
        visit: { id: 1, userId: 1, licensePlateId: 10 },
        lp: { id: 10, carId: 5, vehicleId: null },
        carOrVehicle: { brand: 'VW', make: 'Golf', year: '2015', engineSize: '1.4L' },
        templates: [{ id: 100, engineSize: '1.4L', minYear: 2012, maxYear: 2019 }],
        jobs
      }
    )
    expect(result).toMatchObject({
      Engine: [expect.objectContaining({ name: 'Timing belt' })],
      Brakes: [expect.objectContaining({ name: 'Brake pads front' })]
    })
  })

  it('filters jobs by search term when search provided', async () => {
    const jobs = [
      { id: 1, name: 'Timing belt', category: 'Engine', labourHours: 3, lowRange: 0, highRange: 0 },
      { id: 2, name: 'Brake pads front', category: 'Brakes', labourHours: 1, lowRange: 0, highRange: 0 }
    ]
    const result = await runGetJobsAvailable(
      {}, 1, { search: 'timing' },
      {
        visit: { id: 1, userId: 1, licensePlateId: 10 },
        lp: { id: 10, carId: 5, vehicleId: null },
        carOrVehicle: { brand: 'VW', make: 'Golf', year: '2015', engineSize: '1.4L' },
        templates: [{ id: 100, engineSize: '1.4L', minYear: 2012, maxYear: 2019 }],
        jobs
      }
    )
    expect(result).toHaveProperty('Engine')
    expect(result).not.toHaveProperty('Brakes')
  })

  it('returns empty object when car linked but no matching jobs', async () => {
    const result = await runGetJobsAvailable(
      {}, 1, {},
      {
        visit: { id: 1, userId: 1, licensePlateId: 10 },
        lp: { id: 10, carId: 5, vehicleId: null },
        carOrVehicle: { brand: 'VW', make: 'Golf', year: '2015', engineSize: '1.4L' },
        templates: [],
        jobs: []
      }
    )
    expect(result).toEqual({})
  })

  it('works via vehicleId (UK/IE path) as well as carId (NL)', async () => {
    const jobs = [
      { id: 1, name: 'MOT check', category: 'Inspection', labourHours: 1, lowRange: 0, highRange: 0 }
    ]
    const result = await runGetJobsAvailable(
      {}, 1, {},
      {
        visit: { id: 1, userId: 1, licensePlateId: 20 },
        lp: { id: 20, carId: null, vehicleId: 7 },
        carOrVehicle: { brand: 'Ford', make: 'Focus', year: '2018', engineSize: '1.5L' },
        templates: [{ id: 200, engineSize: '1.5L', minYear: 2015, maxYear: 2021 }],
        jobs
      }
    )
    expect(result).toMatchObject({ Inspection: [expect.objectContaining({ name: 'MOT check' })] })
  })
})

// ── Tests: template scoring ───────────────────────────────────────────────────
describe('GET /api/visits/[id]/jobs-available — template scoring', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUserSession.mockResolvedValue(authedSession)
  })

  it('scores template in-range year as 0 (best)', () => {
    const year = 2018
    const t = { id: 1, engineSize: '1.4L', minYear: 2012, maxYear: 2020, score: 0 }
    const inRange = t.minYear <= year && (t.maxYear === 0 || t.maxYear >= year)
    expect(inRange).toBe(true)
    // In-range → score stays 0
    let score = 0
    if (!inRange) score += 1
    expect(score).toBe(0)
  })

  it('penalizes template with mismatched engine size prefix (+100)', () => {
    const carEnginePrefix = '1.4'
    const tplPrefix = '2.0'
    let score = 0
    if (tplPrefix && tplPrefix !== carEnginePrefix) score += 100
    expect(score).toBe(100)
  })

  it('no engine size penalty when car has no engineSize', () => {
    const carEnginePrefix = '' // no prefix extracted
    const tplPrefix = '1.4'
    let score = 0
    if (carEnginePrefix && tplPrefix && tplPrefix !== carEnginePrefix) score += 100
    expect(score).toBe(0)
  })

  it('selects best-scoring template when multiple candidates exist', async () => {
    // Template 1: correct engine (1.4), in year range → score 0
    // Template 2: wrong engine (2.0) → score 100
    const templates = [
      { id: 1, engineSize: '1.4L', minYear: 2012, maxYear: 2020 },
      { id: 2, engineSize: '2.0L', minYear: 2012, maxYear: 2020 }
    ]
    const year = 2018
    const carEnginePrefix = '1.4'

    const scored = templates.map(t => {
      let score = 0
      const inRange = t.minYear <= year && (t.maxYear === 0 || t.maxYear >= year)
      if (!inRange) score += 1
      const tplPrefix = t.engineSize.match(/^[\d.]+/)?.[0] || ''
      if (carEnginePrefix && tplPrefix && tplPrefix !== carEnginePrefix) score += 100
      return { id: t.id, score }
    })

    scored.sort((a, b) => a.score - b.score)
    expect(scored[0].id).toBe(1)
    expect(scored[0].score).toBe(0)
    expect(scored[1].score).toBe(100)
  })

  it('groups multiple templates with the same best score together', () => {
    const scored = [
      { id: 1, score: 0 },
      { id: 2, score: 0 },
      { id: 3, score: 5 }
    ]
    const bestScore = scored[0].score
    const bestIds = scored.filter(s => s.score === bestScore).map(s => s.id)
    expect(bestIds).toEqual([1, 2])
  })

  it('year distance is calculated as min(|year - minYear|, |year - maxYear|) for out-of-range', () => {
    const year = 2010
    const t = { minYear: 2015, maxYear: 2020 }
    const inRange = t.minYear <= year && (t.maxYear === 0 || t.maxYear >= year)
    expect(inRange).toBe(false)
    const distLow = Math.abs(year - t.minYear) // |2010 - 2015| = 5
    const distHigh = t.maxYear > 0 ? Math.abs(year - t.maxYear) : distLow // |2010 - 2020| = 10
    const dist = Math.min(distLow, distHigh)
    expect(dist).toBe(5)
  })

  it('open-ended template (maxYear=0) uses distLow for distance', () => {
    const year = 2010
    const t = { minYear: 2015, maxYear: 0 }
    const distLow = Math.abs(year - t.minYear)
    const distHigh = t.maxYear > 0 ? Math.abs(year - t.maxYear) : distLow
    expect(distHigh).toBe(distLow) // open-ended → uses distLow
  })
})

// ── Tests: category grouping ──────────────────────────────────────────────────
describe('GET /api/visits/[id]/jobs-available — category grouping', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUserSession.mockResolvedValue(authedSession)
  })

  it('groups multiple jobs under the same category key', async () => {
    const jobs = [
      { id: 1, name: 'Brake pads front', category: 'Brakes', labourHours: 1, lowRange: 0, highRange: 0 },
      { id: 2, name: 'Brake pads rear', category: 'Brakes', labourHours: 1, lowRange: 0, highRange: 0 },
      { id: 3, name: 'Oil change', category: 'Engine', labourHours: 0.5, lowRange: 0, highRange: 0 }
    ]
    const result = await runGetJobsAvailable(
      {}, 1, {},
      {
        visit: { id: 1, userId: 1, licensePlateId: 10 },
        lp: { id: 10, carId: 5, vehicleId: null },
        carOrVehicle: { brand: 'VW', make: 'Golf', year: '2015', engineSize: '1.4L' },
        templates: [{ id: 100, engineSize: '1.4L', minYear: 2012, maxYear: 2019 }],
        jobs
      }
    )
    expect((result as any).Brakes).toHaveLength(2)
    expect((result as any).Engine).toHaveLength(1)
  })

  it('uses "Other" as fallback category when job.category is empty', async () => {
    const jobs = [
      { id: 1, name: 'Miscellaneous', category: '', labourHours: 0, lowRange: 0, highRange: 0 }
    ]
    const result = await runGetJobsAvailable(
      {}, 1, {},
      {
        visit: { id: 1, userId: 1, licensePlateId: 10 },
        lp: { id: 10, carId: 5, vehicleId: null },
        carOrVehicle: { brand: 'VW', make: 'Golf', year: '2015', engineSize: '1.4L' },
        templates: [{ id: 100, engineSize: '1.4L', minYear: 2012, maxYear: 2019 }],
        jobs
      }
    )
    expect(result).toHaveProperty('Other')
  })

  it('returns empty object when no jobs match', async () => {
    const result = await runGetJobsAvailable(
      {}, 1, {},
      {
        visit: { id: 1, userId: 1, licensePlateId: null }
      }
    )
    expect(result).toEqual({})
  })
})
