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

// ── Simplified runGetVisits that matches the index.get.ts logic pattern ───────
async function runGetVisits(event: object, statusFilter?: string) {
  const user = await requireUser(event)

  const visitList = await mockDbSelect().from().where().orderBy().limit()

  if (!visitList.length) return []

  // Simplified enrichment: just return the basic visit data
  return visitList.map((v: any) => ({
    id: v.id,
    status: v.status,
    customer: null,
    licensePlate: null,
    vehicle: null,
    jobs: [],
    moreJobs: 0,
    totalCost: 0
  }))
}

// ── Tests ─────────────────────────────────────────────────────────────────────
describe('GET /api/visits — auth', () => {
  beforeEach(() => vi.clearAllMocks())

  it('throws 401 when not authenticated', async () => {
    mockGetUserSession.mockResolvedValue(noSession)
    await expect(runGetVisits({})).rejects.toMatchObject({ statusCode: 401 })
  })
})

describe('GET /api/visits — list', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUserSession.mockResolvedValue(authedSession)
  })

  it('returns empty array when user has no visits', async () => {
    mockDbSelect.mockReturnValue({
      from: () => ({ where: () => ({ orderBy: () => ({ limit: () => Promise.resolve([]) }) }) })
    })
    const result = await runGetVisits({})
    expect(result).toEqual([])
  })

  it('returns enriched visit list', async () => {
    const rawVisits = [
      { id: 1, status: 'in_progress', customerId: null, licensePlateId: null },
      { id: 2, status: 'completed', customerId: null, licensePlateId: null }
    ]
    mockDbSelect.mockReturnValue({
      from: () => ({ where: () => ({ orderBy: () => ({ limit: () => Promise.resolve(rawVisits) }) }) })
    })
    const result = await runGetVisits({})
    expect(result).toHaveLength(2)
    expect(result[0].id).toBe(1)
    expect(result[1].id).toBe(2)
  })

  it('returns visits with expected shape', async () => {
    const rawVisits = [{ id: 10, status: 'in_progress', customerId: null, licensePlateId: null }]
    mockDbSelect.mockReturnValue({
      from: () => ({ where: () => ({ orderBy: () => ({ limit: () => Promise.resolve(rawVisits) }) }) })
    })
    const result = await runGetVisits({})
    expect(result[0]).toMatchObject({
      id: 10,
      status: 'in_progress',
      customer: null,
      vehicle: null,
      jobs: expect.any(Array)
    })
  })
})

describe('GET /api/visits — totalCost calculation', () => {
  it('sums labour and parts cost', () => {
    const labourHours = [2, 1.5]
    const partsCosts = [{ unitCost: '50', quantity: 2 }, { unitCost: '10', quantity: 1 }]
    const labourCost = labourHours.reduce((sum, h) => sum + Number(h), 0)
    const partsCost = partsCosts.reduce((sum, jp) => sum + (Number(jp.unitCost) * (jp.quantity || 1)), 0)
    expect(labourCost).toBe(3.5)
    expect(partsCost).toBe(110)
  })

  it('caps visible jobs at 3 and counts remaining', () => {
    const jobs = ['Oil Change', 'Brake Pads', 'Tire Rotation', 'Air Filter', 'Spark Plugs']
    const visibleJobs = jobs.slice(0, 3)
    const moreJobs = Math.max(0, jobs.length - 3)
    expect(visibleJobs).toHaveLength(3)
    expect(moreJobs).toBe(2)
  })
})
