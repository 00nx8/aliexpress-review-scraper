import { requireUser } from '~~/server/utils/auth'
import { useDb } from '~~/server/db'
import { parsedDocuments } from '~~/server/db/schema'
import Anthropic from '@anthropic-ai/sdk'

const EXTRACTION_PROMPT = `Extract all parts/products from this order confirmation email or document.
Return ONLY a valid JSON array with no extra text:
[{"name": "string", "partNo": "string", "brand": "string", "unitCost": number, "quantity": number}]
Only include physical parts/products. Exclude shipping fees, taxes, and service charges.
If no parts found, return [].`

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const body = await readBody(event)
  const { rawContent } = body

  if (!rawContent) throw createError({ statusCode: 400, message: 'rawContent required' })

  const config = useRuntimeConfig()
  const db = useDb()

  const client = new Anthropic({ apiKey: config.anthropicApiKey as string })

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    messages: [{
      role: 'user',
      content: `${EXTRACTION_PROMPT}\n\n---\n${rawContent}`
    }]
  })

  let parsed: any[] = []
  try {
    const block = response.content[0]
    const text = block && block.type === 'text' ? block.text : '[]'
    const match = text.match(/\[[\s\S]*\]/)
    parsed = match ? JSON.parse(match[0]) : []
  } catch {
    parsed = []
  }

  // Store in db
  const [doc] = await db.insert(parsedDocuments).values({
    userId: user.id,
    sourceType: 'email',
    rawContent,
    parsedContent: parsed,
    status: 'pending'
  }).returning()

  return { id: doc!.id, parts: parsed }
})
