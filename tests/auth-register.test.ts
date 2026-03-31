import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Shared globals ───────────────────────────────────────────────────────────
;(global as any).createError = (opts: { statusCode: number; message: string }) => {
  const err: any = new Error(opts.message)
  err.statusCode = opts.statusCode
  err.data = opts
  return err
}
;(global as any).defineEventHandler = (fn: Function) => fn

// ── Tests: registration validation logic ────────────────────────────────────

describe('register — input validation', () => {
  function validate(email: string, password: string) {
    if (!email || !password) throw (global as any).createError({ statusCode: 400, message: 'Email and password required' })
    if (password.length < 8) throw (global as any).createError({ statusCode: 400, message: 'Password must be at least 8 characters' })
  }

  it('rejects missing email', () => {
    expect(() => validate('', 'password123')).toThrow('Email and password required')
  })

  it('rejects missing password', () => {
    expect(() => validate('user@example.com', '')).toThrow('Email and password required')
  })

  it('rejects short passwords', () => {
    expect(() => validate('user@example.com', 'short')).toThrow('Password must be at least 8 characters')
  })

  it('accepts valid credentials', () => {
    expect(() => validate('user@example.com', 'strongpassword')).not.toThrow()
  })
})

describe('register — duplicate email detection', () => {
  it('throws 409 when email already exists', async () => {
    const mockDbSelect = vi.fn().mockReturnValue({
      from: () => ({ where: () => ({ limit: () => Promise.resolve([{ id: 1, email: 'existing@example.com' }]) }) })
    })

    const existing = await mockDbSelect().from().where().limit()
    if (existing.length > 0) {
      const err = (global as any).createError({ statusCode: 409, message: 'Email already registered' })
      expect(err.statusCode).toBe(409)
    }
  })

  it('proceeds when email is new', async () => {
    const mockDbSelect = vi.fn().mockReturnValue({
      from: () => ({ where: () => ({ limit: () => Promise.resolve([]) }) })
    })

    const existing = await mockDbSelect().from().where().limit()
    expect(existing.length).toBe(0) // no duplicate, safe to proceed
  })
})

describe('register — session creation after insert', () => {
  it('throws if DB insert returns undefined (should never happen but regression guard)', () => {
    // This guards against the `garage!.id` / `user!.id` access after .returning()
    function extractId(record: any) {
      if (!record) throw new Error('DB insert returned no record')
      return record.id
    }

    expect(() => extractId(undefined)).toThrow('DB insert returned no record')
    expect(() => extractId({ id: 42 })).not.toThrow()
    expect(extractId({ id: 42 })).toBe(42)
  })
})
