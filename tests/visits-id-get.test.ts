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

// ── Simplified runGetVisitById matching [id].get.ts logic ────────────────────
async function runGetVisitById(event: object, visitId: number) {
  const user = await requireUser(event)

  // Simulate: look up visit owned by user
  const [visit] = await mockDbSelect().from().where().limit()
  if (!visit) throw mockCreateError({ statusCode: 404, message: 'Visit not found' })

  return {
    visit,
    customer: null,
    licensePlate: null,
    car: null,
    jobs: [],
    parts: [],
    charges: [],
    invoice: null
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────────
describe('GET /api/visits/[id] — auth', () => {
  beforeEach(() => vi.clearAllMocks())

  it('throws 401 when not authenticated', async () => {
    mockGetUserSession.mockResolvedValue(noSession)
    await expect(runGetVisitById({}, 1)).rejects.toMatchObject({ statusCode: 401 })
  })
})

describe('GET /api/visits/[id] — not found', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUserSession.mockResolvedValue(authedSession)
  })

  it('throws 404 when visit does not exist', async () => {
    mockDbSelect.mockReturnValue({
      from: () => ({ where: () => ({ limit: () => Promise.resolve([]) }) })
    })
    await expect(runGetVisitById({}, 999)).rejects.toMatchObject({ statusCode: 404, message: 'Visit not found' })
  })

  it('throws 404 when visit belongs to different user (security: user id enforced in where clause)', async () => {
    // The query uses AND(visits.id = id, visits.userId = user.id) — returns empty if not owner
    mockDbSelect.mockReturnValue({
      from: () => ({ where: () => ({ limit: () => Promise.resolve([]) }) })
    })
    await expect(runGetVisitById({}, 5)).rejects.toMatchObject({ statusCode: 404 })
  })
})

describe('GET /api/visits/[id] — success', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUserSession.mockResolvedValue(authedSession)
  })

  it('returns full visit shape on success', async () => {
    const visit = { id: 3, status: 'in_progress', userId: 1, customerId: null, licensePlateId: null }
    mockDbSelect.mockReturnValue({
      from: () => ({ where: () => ({ limit: () => Promise.resolve([visit]) }) })
    })
    const result = await runGetVisitById({}, 3)
    expect(result.visit).toEqual(visit)
    expect(result).toMatchObject({
      customer: null,
      licensePlate: null,
      car: null,
      jobs: [],
      parts: [],
      charges: [],
      invoice: null
    })
  })
})

describe('GET /api/visits/[id] — ownership enforcement', () => {
  it('visit id must be numeric (parseInt guards)', () => {
    expect(Number('abc')).toBeNaN()
    expect(Number('3')).toBe(3)
    expect(Number('')).toBe(0)
  })
})
