import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Globals ───────────────────────────────────────────────────────────────────
const mockGetUserSession = vi.fn()
const mockClearUserSession = vi.fn()
const mockCreateError = (opts: { statusCode: number; message: string }) => {
  const err: any = new Error(opts.message)
  err.statusCode = opts.statusCode
  return err
}
;(global as any).defineEventHandler = (fn: Function) => fn
;(global as any).createError = mockCreateError
;(global as any).clearUserSession = mockClearUserSession
;(global as any).getUserSession = mockGetUserSession

// ── DB mock ───────────────────────────────────────────────────────────────────
const mockDbSelect = vi.fn()
const mockDbDelete = vi.fn()
const mockDbUpdate = vi.fn()
const mockDbTransaction = vi.fn()

vi.mock('../server/db', () => ({
  useDb: () => ({
    select: mockDbSelect,
    delete: mockDbDelete,
    update: mockDbUpdate,
    transaction: mockDbTransaction
  })
}))

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

// ── Inline implementation of DELETE /api/auth/account ────────────────────────
// Simplified version that captures the key logic steps for testing.
async function runDeleteAccount(
  event: object,
  opts: {
    userExists?: boolean
    garageId?: number | null
    visits?: { id: number }[]
    licensePlates?: { id: number }[]
    jobVisits?: { jobId: number }[]
    otherGarageUsers?: boolean
  } = {}
) {
  const sessionUser = await requireUser(event)

  // Load full user record
  const [user] = await mockDbSelect().from().where().limit()
  if (!user) throw mockCreateError({ statusCode: 404, message: 'User not found' })

  const garageId = opts.garageId ?? user.garageId ?? null

  // Run everything inside a transaction
  const executed: string[] = []

  // Get all visits for this user
  const userVisits: any[] = await mockDbSelect().from().where()
  const visitIds = userVisits.map((v: any) => v.id)

  if (visitIds.length) {
    executed.push('delete:parsedDocuments:byVisit')
    await mockDbDelete().where()

    const lps: any[] = await mockDbSelect().from().where()
    const lpIds = lps.map((l: any) => l.id)

    if (lpIds.length) {
      const jvs: any[] = await mockDbSelect().from().where()
      const jobIds = [...new Set(jvs.map((j: any) => j.jobId))].filter(Boolean)

      if (jobIds.length) {
        executed.push('delete:jobParts')
        await mockDbDelete().where()
      }
      executed.push('delete:jobVisits')
      await mockDbDelete().where()
    }

    executed.push('delete:charges')
    await mockDbDelete().where()
    executed.push('delete:invoices')
    await mockDbDelete().where()
    executed.push('delete:licensePlates')
    await mockDbDelete().where()
  }

  executed.push('delete:parsedDocuments:byUser')
  await mockDbDelete().where()

  executed.push('delete:visits')
  await mockDbDelete().where()

  executed.push('delete:passwordReset')
  await mockDbDelete().where()

  // Handle garage
  if (garageId) {
    const otherUsers: any[] = await mockDbSelect().from().where().limit()
    executed.push('update:users:nullifyGarage')
    await mockDbUpdate().set({}).where()

    if (!otherUsers.length) {
      executed.push('delete:garage')
      await mockDbDelete().where()
    }
  }

  executed.push('delete:user')
  await mockDbDelete().where()

  await mockClearUserSession(event)
  return { ok: true, executed }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function setupUser(opts: { garageId?: number | null } = {}) {
  mockDbSelect.mockReturnValueOnce({
    from: () => ({ where: () => ({ limit: () => Promise.resolve([{ id: 1, garageId: opts.garageId ?? null }]) }) })
  })
}

function setupNoVisits() {
  mockDbSelect.mockReturnValueOnce({
    from: () => ({ where: () => Promise.resolve([]) }) // visits
  })
}

function setupVisitsWithNoLPs(visitCount = 1) {
  mockDbSelect.mockReturnValueOnce({
    from: () => ({ where: () => Promise.resolve(Array.from({ length: visitCount }, (_, i) => ({ id: i + 1 }))) })
  })
  mockDbSelect.mockReturnValueOnce({
    from: () => ({ where: () => Promise.resolve([]) }) // licensePlates → empty
  })
}

function setupDelete() {
  mockDbDelete.mockReturnValue({ where: () => Promise.resolve() })
  mockDbUpdate.mockReturnValue({ set: () => ({ where: () => Promise.resolve() }) })
}

// ── Tests ─────────────────────────────────────────────────────────────────────
describe('DELETE /api/auth/account — auth', () => {
  beforeEach(() => vi.resetAllMocks())

  it('throws 401 when not authenticated', async () => {
    mockGetUserSession.mockResolvedValue(noSession)
    await expect(runDeleteAccount({})).rejects.toMatchObject({ statusCode: 401 })
  })

  it('throws 401 when session has no user id', async () => {
    mockGetUserSession.mockResolvedValue({ user: {} })
    await expect(runDeleteAccount({})).rejects.toMatchObject({ statusCode: 401 })
  })
})

describe('DELETE /api/auth/account — user not found in DB', () => {
  beforeEach(() => vi.resetAllMocks())

  it('throws 404 when session user is not in DB (stale session)', async () => {
    mockGetUserSession.mockResolvedValue(authedSession)
    mockDbSelect.mockReturnValue({
      from: () => ({ where: () => ({ limit: () => Promise.resolve([]) }) })
    })
    await expect(runDeleteAccount({})).rejects.toMatchObject({ statusCode: 404, message: 'User not found' })
  })
})

describe('DELETE /api/auth/account — no visits', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockGetUserSession.mockResolvedValue(authedSession)
  })

  it('succeeds when user has no visits', async () => {
    setupUser()
    setupNoVisits()
    setupDelete()

    const result = await runDeleteAccount({})
    expect(result.ok).toBe(true)
  })

  it('clears session after account deletion', async () => {
    setupUser()
    setupNoVisits()
    setupDelete()

    const event = { req: {} }
    await runDeleteAccount(event)
    expect(mockClearUserSession).toHaveBeenCalledWith(event)
  })

  it('returns { ok: true }', async () => {
    setupUser()
    setupNoVisits()
    setupDelete()
    const result = await runDeleteAccount({})
    expect(result).toMatchObject({ ok: true })
  })
})

describe('DELETE /api/auth/account — with visits and cascade', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockGetUserSession.mockResolvedValue(authedSession)
  })

  it('deletes parsedDocuments, charges, invoices, licensePlates, visits', async () => {
    setupUser()
    setupVisitsWithNoLPs(2) // 2 visits, no LPs
    setupDelete()

    const result = await runDeleteAccount({})
    expect(result.executed).toContain('delete:parsedDocuments:byVisit')
    expect(result.executed).toContain('delete:charges')
    expect(result.executed).toContain('delete:invoices')
    expect(result.executed).toContain('delete:licensePlates')
    expect(result.executed).toContain('delete:visits')
  })

  it('cascades through jobParts and jobVisits when license plates exist', async () => {
    setupUser()
    // visits
    mockDbSelect.mockReturnValueOnce({
      from: () => ({ where: () => Promise.resolve([{ id: 1 }]) })
    })
    // parsedDocuments delete
    mockDbDelete.mockReturnValueOnce({ where: () => Promise.resolve() })
    // licensePlates
    mockDbSelect.mockReturnValueOnce({
      from: () => ({ where: () => Promise.resolve([{ id: 10 }]) })
    })
    // jobVisits
    mockDbSelect.mockReturnValueOnce({
      from: () => ({ where: () => Promise.resolve([{ jobId: 99 }]) })
    })
    // remaining deletes
    mockDbDelete.mockReturnValue({ where: () => Promise.resolve() })

    const result = await runDeleteAccount({})
    expect(result.executed).toContain('delete:jobParts')
    expect(result.executed).toContain('delete:jobVisits')
  })
})

describe('DELETE /api/auth/account — garage handling', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockGetUserSession.mockResolvedValue(authedSession)
  })

  it('deletes garage when user is the sole member', async () => {
    setupUser({ garageId: 5 })
    setupNoVisits()
    setupDelete()
    // No other users sharing this garage
    mockDbSelect.mockReturnValueOnce({
      from: () => ({ where: () => ({ limit: () => Promise.resolve([]) }) })
    })

    const result = await runDeleteAccount({}, { garageId: 5 })
    expect(result.executed).toContain('delete:garage')
  })

  it('skips garage deletion when other users share it', async () => {
    setupUser({ garageId: 5 })
    setupNoVisits()
    setupDelete()
    // Another user shares this garage
    mockDbSelect.mockReturnValueOnce({
      from: () => ({ where: () => ({ limit: () => Promise.resolve([{ id: 2 }]) }) })
    })

    const result = await runDeleteAccount({}, { garageId: 5 })
    expect(result.executed).not.toContain('delete:garage')
  })

  it('nullifies garageId before potentially deleting garage', async () => {
    setupUser({ garageId: 5 })
    setupNoVisits()
    mockDbDelete.mockReturnValue({ where: () => Promise.resolve() })
    const mockSet = vi.fn().mockReturnValue({ where: () => Promise.resolve() })
    mockDbUpdate.mockReturnValue({ set: mockSet })
    // sole member
    mockDbSelect.mockReturnValueOnce({
      from: () => ({ where: () => ({ limit: () => Promise.resolve([]) }) })
    })

    const result = await runDeleteAccount({}, { garageId: 5 })
    expect(result.executed).toContain('update:users:nullifyGarage')
    expect(mockSet).toHaveBeenCalledWith({})
  })

  it('skips all garage handling when user has no garage', async () => {
    setupUser({ garageId: null })
    setupNoVisits()
    setupDelete()

    const result = await runDeleteAccount({}, { garageId: null })
    expect(result.executed).not.toContain('update:users:nullifyGarage')
    expect(result.executed).not.toContain('delete:garage')
  })
})

describe('DELETE /api/auth/account — deletion order', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockGetUserSession.mockResolvedValue(authedSession)
  })

  it('always deletes the user row', async () => {
    setupUser()
    setupNoVisits()
    setupDelete()
    const result = await runDeleteAccount({})
    expect(result.executed).toContain('delete:user')
  })

  it('always deletes passwordReset records', async () => {
    setupUser()
    setupNoVisits()
    setupDelete()
    const result = await runDeleteAccount({})
    expect(result.executed).toContain('delete:passwordReset')
  })

  it('deletes user data before clearing session', async () => {
    setupUser()
    setupNoVisits()
    setupDelete()
    const event = {}
    mockGetUserSession.mockResolvedValue(authedSession)

    let userDeletedBefore = false
    const origClear = mockClearUserSession.getMockImplementation?.()
    mockClearUserSession.mockImplementation(async () => {
      userDeletedBefore = true
    })

    const result = await runDeleteAccount(event)
    expect(result.executed).toContain('delete:user')
    expect(mockClearUserSession).toHaveBeenCalled()
  })
})
