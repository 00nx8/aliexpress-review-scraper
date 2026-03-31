import { requireUser } from '~~/server/utils/auth'
import { useDb } from '~~/server/db'
import { parsedDocuments } from '~~/server/db/schema'
import Anthropic from '@anthropic-ai/sdk'

const EXTRACTION_PROMPT = `Extract all parts/products from this invoice or receipt image.
Return ONLY a valid JSON array with no extra text:
[{"name": "string", "partNo": "string or null", "brand": "string or null", "unitCost": number, "quantity": number}]
Only include physical parts/products. Exclude shipping, taxes, and service charges.
If no parts found, return [].`

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const config = useRuntimeConfig()
  const db = useDb()

  const form = await readMultipartFormData(event)
  if (!form) throw createError({ statusCode: 400, message: 'No files uploaded' })

  const client = new Anthropic({ apiKey: config.anthropicApiKey as string })
  const allParts: any[] = []

  for (const file of form) {
    if (!file.data || !file.type) continue
    const base64 = file.data.toString('base64')
    const mediaType = (file.type as any) || 'image/jpeg'

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
          { type: 'text', text: EXTRACTION_PROMPT }
        ]
      }]
    })

    try {
      const block = response.content[0]
      const text = block && block.type === 'text' ? block.text : '[]'
      const match = text.match(/\[[\s\S]*\]/)
      const parsed = match ? JSON.parse(match[0]) : []
      allParts.push(...parsed)
    } catch { /* skip malformed responses */ }
  }

  const [doc] = await db.insert(parsedDocuments).values({
    userId: user.id,
    sourceType: 'receipt',
    rawContent: '',
    parsedContent: allParts,
    status: 'pending'
  }).returning()

  return { id: doc!.id, parts: allParts }
})
