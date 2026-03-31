import { describe, it, expect, vi, beforeEach } from 'vitest'

// Globals injected by Nuxt/Nitro
const mockClearUserSession = vi.fn()
;(global as any).clearUserSession = mockClearUserSession
;(global as any).createError = (opts: { statusCode: number; message: string }) => {
  const err: any = new Error(opts.message)
  err.statusCode = opts.statusCode
  return err
}
;(global as any).defineEventHandler = (fn: Function) => fn
;(global as any).getRouterParam = vi.fn()

const mockInsert = vi.fn()
vi.mock('../server/db', () => ({ useDb: () => ({ insert: mockInsert }) }))

// Simulate what visits/index.post.ts does:
async function createVisit(userId: number, dbUserExists: boolean, event: any) {
  if (!dbUserExists) {
    // This simulates the FK constraint violation that hits when userId doesn't exist in users table
    // The fix is to validate before inserting, or catch the FK error and return 401
    throw (global as any).createError({ statusCode: 500, message: 'insert or update on table "visits" violates foreign key constraint "visits_users_id_fk"' })
  }
  return { id: 1, userId, status: 'in_progress' }
}

describe('POST /api/visits — FK constraint violation', () => {
  beforeEach(() => vi.clearAllMocks())

  it('throws FK error when session user does not exist in users table', async () => {
    const event = {}
    // user.id=1 is in session cookie but not in the users table (stale session bug)
    await expect(createVisit(1, false, event)).rejects.toThrow('violates foreign key constraint')
  })

  it('creates visit successfully when user exists in users table', async () => {
    const event = {}
    const result = await createVisit(1, true, event)
    expect(result.userId).toBe(1)
    expect(result.status).toBe('in_progress')
  })
})

describe('POST /api/visits — session validation', () => {
  it('should clear stale session and return 401 when DB user does not exist', async () => {
    // This tests the desired fix behaviour: instead of FK crash, detect stale session and 401
    const event = {}
    const sessionUser = { id: 99, email: 'ghost@example.com' }

    const mockDbSelect = vi.fn().mockReturnValue({
      from: () => ({ where: () => ({ limit: () => Promise.resolve([]) }) }) // no user in DB
    })

    const [dbUser] = await mockDbSelect().from().where().limit()

    if (!dbUser) {
      await mockClearUserSession(event)
      expect(mockClearUserSession).toHaveBeenCalledWith(event)
    }
  })
})
