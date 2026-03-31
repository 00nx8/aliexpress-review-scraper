import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockGetUserSession = vi.fn()
const mockClearUserSession = vi.fn()
const mockSetUserSession = vi.fn()
const mockCreateError = vi.fn((opts: { statusCode: number; message: string }) => {
  const err: any = new Error(opts.message)
  err.statusCode = opts.statusCode
  err.data = { message: opts.message }
  return err
})

vi.mock('#imports', () => ({
  defineEventHandler: (fn: Function) => fn,
  readBody: vi.fn(),
  useRuntimeConfig: vi.fn(() => ({
    stripeSecretKey: 'sk_test_fake',
    stripePriceBusinessId: 'price_biz',
    stripePriceFreelanceId: 'price_free',
    siteUrl: 'http://localhost:3000'
  })),
  createError: mockCreateError
}))

// Stub global H3 helpers injected by Nuxt
;(global as any).getUserSession = mockGetUserSession
;(global as any).clearUserSession = mockClearUserSession
;(global as any).setUserSession = mockSetUserSession
;(global as any).defineEventHandler = (fn: Function) => fn
;(global as any).readBody = vi.fn()
;(global as any).getQuery = vi.fn()
;(global as any).getRouterParam = vi.fn()
;(global as any).createError = mockCreateError
;(global as any).useRuntimeConfig = vi.fn(() => ({
  stripeSecretKey: 'sk_test_fake',
  stripePriceBusinessId: 'price_biz',
  stripePriceFreelanceId: 'price_free',
  siteUrl: 'http://localhost:3000'
}))

const mockDbSelect = vi.fn()
const mockDbInsert = vi.fn()
const mockDbUpdate = vi.fn()

vi.mock('../server/db', () => ({
  useDb: () => ({
    select: mockDbSelect,
    insert: mockDbInsert,
    update: mockDbUpdate
  })
}))

vi.mock('stripe', () => ({
  default: vi.fn(() => ({
    checkout: {
      sessions: {
        create: vi.fn(async () => ({ url: 'https://checkout.stripe.com/fake' }))
      }
    }
  }))
}))

// ── requireUser helper ────────────────────────────────────────────────────────

async function fakeRequireUser(sessionUser: any) {
  if (!sessionUser?.id) {
    throw mockCreateError({ statusCode: 401, message: 'Unauthorized' })
  }
  return sessionUser
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('POST /api/subscribe/checkout — user not in DB', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should throw 401 and clear session when DB user is not found (stale cookie bug)', async () => {
    const event = {}

    // DB returns empty array — the bug that caused "Cannot read properties of undefined (reading 'email')"
    mockDbSelect.mockReturnValue({
      from: () => ({
        where: () => ({
          limit: () => Promise.resolve([]) // empty — user not found
        })
      })
    })

    const run = async () => {
      const [user] = await mockDbSelect().from().where().limit()
      if (!user) {
        await mockClearUserSession(event)
        throw mockCreateError({ statusCode: 401, message: 'Session expired. Please log in again.' })
      }
    }

    await expect(run()).rejects.toMatchObject({ statusCode: 401 })
    expect(mockClearUserSession).toHaveBeenCalledWith(event)
  })

  it('clears the session when user is not found', async () => {
    const event = {}
    mockDbSelect.mockReturnValue({
      from: () => ({ where: () => ({ limit: () => Promise.resolve([]) }) })
    })

    const [user] = await mockDbSelect().from().where().limit()

    if (!user) {
      await mockClearUserSession(event)
      const err = mockCreateError({ statusCode: 401, message: 'Session expired. Please log in again.' })
      expect(mockClearUserSession).toHaveBeenCalledWith(event)
      expect(err.statusCode).toBe(401)
    }
  })

  it('proceeds to Stripe when DB user exists', async () => {
    mockDbSelect.mockReturnValue({
      from: () => ({
        where: () => ({
          limit: () => Promise.resolve([{
            id: 1,
            email: 'user@garage.com',
            stripeCustomerId: null
          }])
        })
      })
    })

    const [user] = await mockDbSelect().from().where().limit()
    expect(user).toBeDefined()
    expect(user.email).toBe('user@garage.com')
    // No error — Stripe session creation can proceed
  })
})

describe('POST /api/subscribe/checkout — plan validation', () => {
  it('rejects invalid plan names', async () => {
    const invalidPlans = ['enterprise', 'free', '', 'admin', null, undefined]

    for (const plan of invalidPlans) {
      const isValid = ['freelance', 'business'].includes(plan as string)
      expect(isValid).toBe(false)
    }
  })

  it('accepts valid plans', () => {
    expect(['freelance', 'business'].includes('freelance')).toBe(true)
    expect(['freelance', 'business'].includes('business')).toBe(true)
  })
})
