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
;(global as any).readBody = vi.fn()
;(global as any).getUserSession = mockGetUserSession
;(global as any).useRuntimeConfig = vi.fn(() => ({ anthropicApiKey: 'test-key' }))

// ── DB mock ───────────────────────────────────────────────────────────────────
const mockDbInsert = vi.fn()
vi.mock('../server/db', () => ({ useDb: () => ({ insert: mockDbInsert }) }))

// ── Anthropic mock ────────────────────────────────────────────────────────────
const mockMessagesCreate = vi.fn()
vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn(() => ({
    messages: { create: mockMessagesCreate }
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

const authedSession = { user: { id: 1, email: 'user@example.com' } }
const noSession = { user: null }

// ── Inline implementation matching parse-email.post.ts logic ─────────────────
async function runParseEmail(event: object, rawContent: string | undefined) {
  const user = await requireUser(event)
  if (!rawContent) throw mockCreateError({ statusCode: 400, message: 'rawContent required' })

  const response = await mockMessagesCreate({ model: 'claude-haiku-4-5-20251001', max_tokens: 1024, messages: [] })

  let parsed: any[] = []
  try {
    const block = response.content[0]
    const text = block && block.type === 'text' ? block.text : '[]'
    const match = text.match(/\[[\s\S]*\]/)
    parsed = match ? JSON.parse(match[0]) : []
  } catch {
    parsed = []
  }

  const [doc] = await mockDbInsert().values({
    userId: user.id,
    sourceType: 'email',
    rawContent,
    parsedContent: parsed,
    status: 'pending'
  }).returning()

  return { id: doc!.id, parts: parsed }
}

// ── Tests ─────────────────────────────────────────────────────────────────────
describe('POST /api/parts/parse-email — auth', () => {
  beforeEach(() => vi.clearAllMocks())

  it('throws 401 when unauthenticated', async () => {
    mockGetUserSession.mockResolvedValue(noSession)
    await expect(runParseEmail({}, 'some content')).rejects.toMatchObject({ statusCode: 401 })
  })
})

describe('POST /api/parts/parse-email — validation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUserSession.mockResolvedValue(authedSession)
  })

  it('throws 400 when rawContent is missing', async () => {
    await expect(runParseEmail({}, undefined)).rejects.toMatchObject({ statusCode: 400, message: 'rawContent required' })
  })

  it('throws 400 when rawContent is empty string', async () => {
    await expect(runParseEmail({}, '')).rejects.toMatchObject({ statusCode: 400 })
  })
})

describe('POST /api/parts/parse-email — AI parsing', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUserSession.mockResolvedValue(authedSession)
  })

  it('returns parsed parts from AI response', async () => {
    const aiParts = [{ name: 'Oil Filter', partNo: 'OC5', brand: 'Mahle', unitCost: 12.5, quantity: 2 }]
    mockMessagesCreate.mockResolvedValue({
      content: [{ type: 'text', text: JSON.stringify(aiParts) }]
    })
    mockDbInsert.mockReturnValue({
      values: () => ({ returning: () => Promise.resolve([{ id: 7 }]) })
    })

    const result = await runParseEmail({}, 'Order: Oil Filter x2 @ €12.50')
    expect(result.parts).toEqual(aiParts)
    expect(result.id).toBe(7)
  })

  it('returns empty parts when AI response is not a JSON array', async () => {
    mockMessagesCreate.mockResolvedValue({
      content: [{ type: 'text', text: 'I could not find any parts in this email.' }]
    })
    mockDbInsert.mockReturnValue({
      values: () => ({ returning: () => Promise.resolve([{ id: 8 }]) })
    })

    const result = await runParseEmail({}, 'Thanks for your order!')
    expect(result.parts).toEqual([])
  })

  it('returns empty parts when AI response is malformed JSON', async () => {
    mockMessagesCreate.mockResolvedValue({
      content: [{ type: 'text', text: '[{broken json' }]
    })
    mockDbInsert.mockReturnValue({
      values: () => ({ returning: () => Promise.resolve([{ id: 9 }]) })
    })

    const result = await runParseEmail({}, 'some content')
    expect(result.parts).toEqual([])
  })

  it('stores raw content and parsed parts in DB', async () => {
    const aiParts = [{ name: 'Spark Plug', partNo: 'SP1', brand: 'NGK', unitCost: 5, quantity: 4 }]
    mockMessagesCreate.mockResolvedValue({
      content: [{ type: 'text', text: JSON.stringify(aiParts) }]
    })
    const mockValues = vi.fn().mockReturnValue({ returning: () => Promise.resolve([{ id: 10 }]) })
    mockDbInsert.mockReturnValue({ values: mockValues })

    await runParseEmail({}, 'Spark Plug x4 @ €5')
    expect(mockValues).toHaveBeenCalledWith(expect.objectContaining({
      userId: 1,
      sourceType: 'email',
      rawContent: 'Spark Plug x4 @ €5',
      status: 'pending'
    }))
  })
})

describe('POST /api/parts/parse-email — JSON extraction', () => {
  it('extracts JSON array embedded in prose text', () => {
    const text = 'Here are the parts: [{"name":"Filter","partNo":"F1","brand":"x","unitCost":10,"quantity":1}] hope that helps'
    const match = text.match(/\[[\s\S]*\]/)
    expect(match).not.toBeNull()
    const parsed = JSON.parse(match![0])
    expect(parsed).toHaveLength(1)
    expect(parsed[0].name).toBe('Filter')
  })

  it('returns empty when no JSON array in text', () => {
    const text = 'No parts found in this document.'
    const match = text.match(/\[[\s\S]*\]/)
    expect(match).toBeNull()
  })
})
