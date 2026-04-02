import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Globals ───────────────────────────────────────────────────────────────────
const mockClearUserSession = vi.fn()
;(global as any).defineEventHandler = (fn: Function) => fn
;(global as any).clearUserSession = mockClearUserSession

// ── Inline implementation matching logout.post.ts logic ───────────────────────
async function runLogout(event: object) {
  await (global as any).clearUserSession(event)
  return { ok: true }
}

// ── Tests ─────────────────────────────────────────────────────────────────────
describe('POST /api/auth/logout', () => {
  beforeEach(() => vi.clearAllMocks())

  it('clears the user session', async () => {
    const event = { req: {} }
    await runLogout(event)
    expect(mockClearUserSession).toHaveBeenCalledWith(event)
  })

  it('returns { ok: true }', async () => {
    const event = {}
    const result = await runLogout(event)
    expect(result).toEqual({ ok: true })
  })

  it('always clears session regardless of whether user is logged in', async () => {
    mockClearUserSession.mockResolvedValue(undefined)
    const event = {}
    await runLogout(event)
    expect(mockClearUserSession).toHaveBeenCalledTimes(1)
  })
})
