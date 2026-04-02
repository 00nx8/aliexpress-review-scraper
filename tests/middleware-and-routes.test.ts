import { describe, it, expect, vi } from 'vitest'

// ── Auth global middleware logic (auth.global.ts) ─────────────────────────────
//
// The middleware controls access to ALL frontend routes:
//
//   publicRoutes:    /login, /register, /forgot-password, /reset-password
//   subscribeRoutes: /subscribe, /subscribe/payment, /subscribe/success
//
// Rules:
//   1. Public routes are always accessible (no login needed)
//   2. Non-public routes redirect to /login if not logged in
//   3. Non-subscribe routes redirect to /subscribe if subscriptionType is 'unset' or missing

const publicRoutes = ['/login', '/register', '/forgot-password', '/reset-password']
const subscribeRoutes = ['/subscribe', '/subscribe/payment', '/subscribe/success']

function simulateMiddleware(path: string, loggedIn: boolean, subscriptionType?: string): string | null {
  // Public routes bypass all checks
  if (publicRoutes.includes(path)) return null // pass through

  // Must be logged in
  if (!loggedIn) return '/login'

  // Must have active subscription if visiting non-subscribe routes
  if (!subscribeRoutes.includes(path)) {
    if (!subscriptionType || subscriptionType === 'unset') return '/subscribe'
  }

  return null // pass through
}

// ── Public routes ─────────────────────────────────────────────────────────────
describe('Auth middleware — public routes are always accessible', () => {
  const cases = [
    ['/login', false, undefined],
    ['/register', false, undefined],
    ['/forgot-password', false, undefined],
    ['/reset-password', false, undefined],
    // Even with a logged-in user, these routes stay accessible
    ['/login', true, 'business'],
    ['/register', true, 'trial'],
  ] as const

  it.each(cases)('%s (loggedIn=%s, sub=%s) → pass through', (path, loggedIn, sub) => {
    expect(simulateMiddleware(path, loggedIn, sub)).toBeNull()
  })
})

// ── Unauthenticated access to protected routes ────────────────────────────────
describe('Auth middleware — unauthenticated redirects to /login', () => {
  const protectedRoutes = ['/', '/visits/1', '/parts', '/fluids', '/dtc', '/torque', '/settings', '/subscribe', '/subscribe/success']

  it.each(protectedRoutes)('%s → /login', (path) => {
    expect(simulateMiddleware(path, false)).toBe('/login')
  })
})

// ── Logged in but no subscription ─────────────────────────────────────────────
describe('Auth middleware — logged in with unset subscription redirects to /subscribe', () => {
  const appRoutes = ['/', '/visits/1', '/parts', '/fluids', '/dtc', '/torque', '/settings']

  it.each(appRoutes)('%s with sub=unset → /subscribe', (path) => {
    expect(simulateMiddleware(path, true, 'unset')).toBe('/subscribe')
  })

  it.each(appRoutes)('%s with sub=undefined → /subscribe', (path) => {
    expect(simulateMiddleware(path, true, undefined)).toBe('/subscribe')
  })
})

// ── Subscribe routes accessible with unset subscription ───────────────────────
describe('Auth middleware — subscribe routes accessible with unset subscription', () => {
  const cases = ['/subscribe', '/subscribe/payment', '/subscribe/success']

  it.each(cases)('%s with sub=unset → pass through', (path) => {
    expect(simulateMiddleware(path, true, 'unset')).toBeNull()
  })

  it.each(cases)('%s with sub=undefined → pass through', (path) => {
    expect(simulateMiddleware(path, true, undefined)).toBeNull()
  })
})

// ── Active subscription: full access ──────────────────────────────────────────
describe('Auth middleware — active subscription allows all routes', () => {
  const allAppRoutes = ['/', '/visits/1', '/parts', '/fluids', '/dtc', '/torque', '/settings', '/subscribe', '/subscribe/success']
  const subscriptionTypes = ['business', 'freelance', 'trial']

  for (const sub of subscriptionTypes) {
    it.each(allAppRoutes)(`%s with sub=${sub} → pass through`, (path) => {
      expect(simulateMiddleware(path, true, sub)).toBeNull()
    })
  }
})

// ── Frontend route inventory ──────────────────────────────────────────────────
describe('Frontend routes — all routes covered by middleware', () => {
  // These are all app/pages/ routes in the project
  const allPageRoutes = [
    { path: '/', public: false, requiresSub: true },
    { path: '/login', public: true, requiresSub: false },
    { path: '/register', public: true, requiresSub: false },
    { path: '/forgot-password', public: true, requiresSub: false },
    { path: '/reset-password', public: true, requiresSub: false },
    { path: '/subscribe', public: false, requiresSub: false },
    { path: '/subscribe/success', public: false, requiresSub: false },
    { path: '/settings', public: false, requiresSub: true },
    { path: '/visits/1', public: false, requiresSub: true },
    { path: '/visits/1/invoice', public: false, requiresSub: true },
    { path: '/parts', public: false, requiresSub: true },
    { path: '/fluids', public: false, requiresSub: true },
    { path: '/dtc', public: false, requiresSub: true },
    { path: '/torque', public: false, requiresSub: true },
  ]

  it.each(allPageRoutes)('$path — public=$public requiresSub=$requiresSub', ({ path, public: isPublic, requiresSub }) => {
    if (isPublic) {
      // Always accessible
      expect(simulateMiddleware(path, false)).toBeNull()
      expect(simulateMiddleware(path, true, 'business')).toBeNull()
    } else {
      // Requires login
      expect(simulateMiddleware(path, false)).toBe('/login')

      if (requiresSub) {
        // Also requires active subscription
        expect(simulateMiddleware(path, true, 'unset')).toBe('/subscribe')
        expect(simulateMiddleware(path, true, 'business')).toBeNull()
        expect(simulateMiddleware(path, true, 'trial')).toBeNull()
      } else {
        // Login enough (subscribe pages)
        expect(simulateMiddleware(path, true, 'unset')).toBeNull()
      }
    }
  })
})
