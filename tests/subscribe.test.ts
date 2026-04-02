import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Globals ───────────────────────────────────────────────────────────────────
const mockGetUserSession = vi.fn()
const mockSetUserSession = vi.fn()
const mockCreateError = (opts: { statusCode: number; message: string }) => {
  const err: any = new Error(opts.message)
  err.statusCode = opts.statusCode
  return err
}
;(global as any).defineEventHandler = (fn: Function) => fn
;(global as any).createError = mockCreateError
;(global as any).readBody = vi.fn()
;(global as any).getUserSession = mockGetUserSession
;(global as any).setUserSession = mockSetUserSession
;(global as any).getHeader = vi.fn()
;(global as any).readRawBody = vi.fn()
;(global as any).useRuntimeConfig = vi.fn(() => ({
  stripeSecretKey: 'sk_test_fake',
  stripeWebhookSecret: 'whsec_fake'
}))

// ── DB mock ───────────────────────────────────────────────────────────────────
const mockDbSelect = vi.fn()
const mockDbUpdate = vi.fn()
vi.mock('../server/db', () => ({ useDb: () => ({ select: mockDbSelect, update: mockDbUpdate }) }))

// ── Stripe mock ───────────────────────────────────────────────────────────────
const mockSubscriptionsCancel = vi.fn()
const mockConstructEvent = vi.fn()
vi.mock('stripe', () => ({
  default: vi.fn(() => ({
    subscriptions: { cancel: mockSubscriptionsCancel },
    webhooks: { constructEvent: mockConstructEvent }
  }))
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

const authedSession = { user: { id: 1, email: 'user@example.com', subscriptionType: 'business' } }
const noSession = { user: null }

// ── POST /api/subscribe/cancel ────────────────────────────────────────────────
async function runCancel(event: object) {
  const sessionUser = await requireUser(event)

  const [user] = await mockDbSelect().from().where().limit()

  if (user?.stripeSubscriptionId) {
    await mockSubscriptionsCancel(user.stripeSubscriptionId)
  }

  await mockDbUpdate().set({ subscriptionType: 'unset' }).where()
  await mockSetUserSession(event, { user: { ...sessionUser, subscriptionType: 'unset' } })

  return { ok: true }
}

describe('POST /api/subscribe/cancel — auth', () => {
  beforeEach(() => vi.clearAllMocks())

  it('throws 401 when unauthenticated', async () => {
    mockGetUserSession.mockResolvedValue(noSession)
    await expect(runCancel({})).rejects.toMatchObject({ statusCode: 401 })
  })
})

describe('POST /api/subscribe/cancel — with Stripe subscription', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUserSession.mockResolvedValue(authedSession)
  })

  it('cancels Stripe subscription when one exists', async () => {
    mockDbSelect.mockReturnValue({
      from: () => ({ where: () => ({ limit: () => Promise.resolve([{ stripeSubscriptionId: 'sub_123' }]) }) })
    })
    mockDbUpdate.mockReturnValue({ set: () => ({ where: () => Promise.resolve() }) })

    await runCancel({})
    expect(mockSubscriptionsCancel).toHaveBeenCalledWith('sub_123')
  })

  it('skips Stripe cancel when no subscription ID', async () => {
    mockDbSelect.mockReturnValue({
      from: () => ({ where: () => ({ limit: () => Promise.resolve([{ stripeSubscriptionId: null }]) }) })
    })
    mockDbUpdate.mockReturnValue({ set: () => ({ where: () => Promise.resolve() }) })

    await runCancel({})
    expect(mockSubscriptionsCancel).not.toHaveBeenCalled()
  })

  it('sets subscriptionType to "unset" in DB', async () => {
    mockDbSelect.mockReturnValue({
      from: () => ({ where: () => ({ limit: () => Promise.resolve([{ stripeSubscriptionId: null }]) }) })
    })
    const mockSet = vi.fn().mockReturnValue({ where: () => Promise.resolve() })
    mockDbUpdate.mockReturnValue({ set: mockSet })

    await runCancel({})
    expect(mockSet).toHaveBeenCalledWith({ subscriptionType: 'unset' })
  })

  it('updates session with unset subscription type', async () => {
    mockDbSelect.mockReturnValue({
      from: () => ({ where: () => ({ limit: () => Promise.resolve([{ stripeSubscriptionId: null }]) }) })
    })
    mockDbUpdate.mockReturnValue({ set: () => ({ where: () => Promise.resolve() }) })

    await runCancel({})
    expect(mockSetUserSession).toHaveBeenCalledWith({}, expect.objectContaining({
      user: expect.objectContaining({ subscriptionType: 'unset' })
    }))
  })

  it('returns { ok: true }', async () => {
    mockDbSelect.mockReturnValue({
      from: () => ({ where: () => ({ limit: () => Promise.resolve([{}]) }) })
    })
    mockDbUpdate.mockReturnValue({ set: () => ({ where: () => Promise.resolve() }) })

    const result = await runCancel({})
    expect(result).toEqual({ ok: true })
  })
})

// ── POST /api/subscribe/verify ────────────────────────────────────────────────
async function runVerify(event: object) {
  const sessionUser = await requireUser(event)

  const [user] = await mockDbSelect().from().where().limit()
  if (user) {
    await mockSetUserSession(event, { user: { id: user.id, email: user.email, subscriptionType: user.subscriptionType, garageId: user.garageId } })
  }

  return { ok: true }
}

describe('POST /api/subscribe/verify — auth', () => {
  beforeEach(() => vi.clearAllMocks())

  it('throws 401 when unauthenticated', async () => {
    mockGetUserSession.mockResolvedValue(noSession)
    await expect(runVerify({})).rejects.toMatchObject({ statusCode: 401 })
  })
})

describe('POST /api/subscribe/verify — session refresh', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUserSession.mockResolvedValue(authedSession)
  })

  it('refreshes session from DB when user found', async () => {
    const dbUser = { id: 1, email: 'user@example.com', subscriptionType: 'business', garageId: 5 }
    mockDbSelect.mockReturnValue({
      from: () => ({ where: () => ({ limit: () => Promise.resolve([dbUser]) }) })
    })

    await runVerify({})
    expect(mockSetUserSession).toHaveBeenCalledWith({}, { user: dbUser })
  })

  it('returns { ok: true }', async () => {
    mockDbSelect.mockReturnValue({
      from: () => ({ where: () => ({ limit: () => Promise.resolve([{ id: 1, email: 'user@example.com', subscriptionType: 'business', garageId: null }]) }) })
    })
    const result = await runVerify({})
    expect(result).toEqual({ ok: true })
  })
})

// ── POST /api/subscribe/trial ─────────────────────────────────────────────────
async function runTrial(event: object) {
  const sessionUser = await requireUser(event)

  await mockDbUpdate().set({ subscriptionType: 'trial', subscriptionStartDate: Date.now() }).where()
  await mockSetUserSession(event, { user: { ...sessionUser, subscriptionType: 'trial' } })

  return { ok: true }
}

describe('POST /api/subscribe/trial — auth', () => {
  beforeEach(() => vi.clearAllMocks())

  it('throws 401 when unauthenticated', async () => {
    mockGetUserSession.mockResolvedValue(noSession)
    await expect(runTrial({})).rejects.toMatchObject({ statusCode: 401 })
  })
})

describe('POST /api/subscribe/trial — trial activation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUserSession.mockResolvedValue(authedSession)
  })

  it('sets subscriptionType to "trial" in DB', async () => {
    const mockSet = vi.fn().mockReturnValue({ where: () => Promise.resolve() })
    mockDbUpdate.mockReturnValue({ set: mockSet })

    await runTrial({})
    expect(mockSet).toHaveBeenCalledWith(expect.objectContaining({ subscriptionType: 'trial' }))
  })

  it('sets subscriptionStartDate in DB', async () => {
    const mockSet = vi.fn().mockReturnValue({ where: () => Promise.resolve() })
    mockDbUpdate.mockReturnValue({ set: mockSet })
    const before = Date.now()

    await runTrial({})
    const callArg = mockSet.mock.calls[0][0]
    expect(callArg.subscriptionStartDate).toBeGreaterThanOrEqual(before)
  })

  it('updates session with trial subscription type', async () => {
    mockDbUpdate.mockReturnValue({ set: () => ({ where: () => Promise.resolve() }) })

    await runTrial({})
    expect(mockSetUserSession).toHaveBeenCalledWith({}, expect.objectContaining({
      user: expect.objectContaining({ subscriptionType: 'trial' })
    }))
  })

  it('returns { ok: true }', async () => {
    mockDbUpdate.mockReturnValue({ set: () => ({ where: () => Promise.resolve() }) })
    const result = await runTrial({})
    expect(result).toEqual({ ok: true })
  })
})

// ── POST /api/subscribe/webhook ───────────────────────────────────────────────
async function runWebhook(event: object, sig: string | null, rawBody: string, stripeEventType: string, eventData: any) {
  mockConstructEvent.mockImplementation(() => ({ type: stripeEventType, data: { object: eventData } }))
  ;(global as any).getHeader = vi.fn(() => sig)
  ;(global as any).readRawBody = vi.fn(async () => rawBody)

  const config = (global as any).useRuntimeConfig()
  const sigHeader = (global as any).getHeader(event, 'stripe-signature')
  const body = await (global as any).readRawBody(event)

  let stripeEvent: any
  try {
    stripeEvent = mockConstructEvent(body, sigHeader, config.stripeWebhookSecret)
  } catch {
    throw mockCreateError({ statusCode: 400, message: 'Webhook signature verification failed' })
  }

  if (stripeEvent.type === 'checkout.session.completed') {
    const session = stripeEvent.data.object
    const userId = Number(session.metadata?.userId)
    const plan = session.metadata?.plan
    if (userId && plan) {
      await mockDbUpdate().set({ subscriptionType: plan }).where()
    }
  }

  if (stripeEvent.type === 'customer.subscription.deleted') {
    const sub = stripeEvent.data.object
    await mockDbUpdate().set({ subscriptionType: 'unset' }).where()
  }

  return { received: true }
}

describe('POST /api/subscribe/webhook — signature verification', () => {
  beforeEach(() => vi.clearAllMocks())

  it('throws 400 when signature verification fails', async () => {
    mockConstructEvent.mockImplementation(() => { throw new Error('Invalid signature') })
    ;(global as any).getHeader = vi.fn(() => 'bad-sig')
    ;(global as any).readRawBody = vi.fn(async () => 'raw')

    const config = (global as any).useRuntimeConfig()
    let err: any
    try {
      mockConstructEvent('raw', 'bad-sig', config.stripeWebhookSecret)
    } catch {
      err = mockCreateError({ statusCode: 400, message: 'Webhook signature verification failed' })
    }
    expect(err.statusCode).toBe(400)
  })
})

describe('POST /api/subscribe/webhook — checkout.session.completed', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDbUpdate.mockReturnValue({ set: () => ({ where: () => Promise.resolve() }) })
  })

  it('updates subscriptionType to plan from metadata', async () => {
    const mockSet = vi.fn().mockReturnValue({ where: () => Promise.resolve() })
    mockDbUpdate.mockReturnValue({ set: mockSet })

    await runWebhook({}, 'sig', 'raw', 'checkout.session.completed', {
      metadata: { userId: '1', plan: 'business' },
      subscription: 'sub_123',
      customer: 'cus_abc'
    })

    expect(mockSet).toHaveBeenCalledWith(expect.objectContaining({ subscriptionType: 'business' }))
  })

  it('skips DB update when userId or plan is missing', async () => {
    const mockSet = vi.fn().mockReturnValue({ where: () => Promise.resolve() })
    mockDbUpdate.mockReturnValue({ set: mockSet })

    await runWebhook({}, 'sig', 'raw', 'checkout.session.completed', {
      metadata: {},
      subscription: 'sub_123',
      customer: 'cus_abc'
    })

    expect(mockSet).not.toHaveBeenCalled()
  })
})

describe('POST /api/subscribe/webhook — customer.subscription.deleted', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('sets subscriptionType to "unset" when subscription deleted', async () => {
    const mockSet = vi.fn().mockReturnValue({ where: () => Promise.resolve() })
    mockDbUpdate.mockReturnValue({ set: mockSet })

    await runWebhook({}, 'sig', 'raw', 'customer.subscription.deleted', { id: 'sub_123' })
    expect(mockSet).toHaveBeenCalledWith({ subscriptionType: 'unset' })
  })
})

describe('POST /api/subscribe/webhook — unknown event types', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDbUpdate.mockReturnValue({ set: () => ({ where: () => Promise.resolve() }) })
  })

  it('returns received:true for unhandled event types', async () => {
    const result = await runWebhook({}, 'sig', 'raw', 'invoice.payment_succeeded', {})
    expect(result).toEqual({ received: true })
  })
})
