# Action Plan — Parts Ingestion Pipeline

Current state: both `/api/parts/parse-email` and `/api/parts/parse-photo` call Anthropic Claude Haiku directly.
Target state: local Ollama LLM for text extraction, local Tesseract OCR for images and scanned PDFs, full inbound email handler, PDF attachment support.

---

## 1. Install runtime dependencies

```bash
npm install pdf-parse tesseract.js sharp zod
npm install -D @types/pdf-parse
```

System packages needed on the server (not npm — must be installed on host):
- `poppler-utils` — provides `pdftotext` and `pdftoppm`
- `tesseract-ocr` + `tesseract-ocr-nld` language pack

Add to your server setup script / Dockerfile:
```
apt-get install -y poppler-utils tesseract-ocr tesseract-ocr-nld
```

Add to `.env`:
```
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=llama3.2:3b
```

---

## 2. Create OCR utility (`server/utils/ocr.ts`)

Wraps `tesseract.js` with image pre-processing via `sharp`.

```ts
import { createWorker } from 'tesseract.js'
import sharp from 'sharp'

export async function ocrBuffer(imageBuffer: Buffer): Promise<string> {
  const processed = await sharp(imageBuffer)
    .greyscale()
    .normalise()
    .toBuffer()

  const worker = await createWorker('nld+eng')
  const { data } = await worker.recognize(processed)
  await worker.terminate()

  // Check confidence; if too low, warn caller
  const avgConf = data.words.reduce((s, w) => s + w.confidence, 0) / (data.words.length || 1)
  if (avgConf < 40) throw Object.assign(new Error('Image quality too low'), { warning: true })

  return data.text.replace(/\s{3,}/g, '\n').trim()
}
```

---

## 3. Create PDF extraction utility (`server/utils/pdfExtract.ts`)

Try `pdf-parse` first; fall back to pdftoppm + OCR for scanned PDFs.

```ts
import pdfParse from 'pdf-parse'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { writeFile, readFile, readdir, unlink, mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { ocrBuffer } from './ocr'

const execFileAsync = promisify(execFile)

export async function extractPdfText(pdfBuffer: Buffer): Promise<string> {
  const data = await pdfParse(pdfBuffer)
  const pageCount = data.numpages || 1

  if (data.text.length / pageCount >= 50) {
    return data.text.trim()
  }

  // Scanned PDF: rasterise then OCR
  const tmpDir = await mkdtemp(join(tmpdir(), 'wrenko-pdf-'))
  const inputPath = join(tmpDir, 'input.pdf')
  const outputPrefix = join(tmpDir, 'page')

  try {
    await writeFile(inputPath, pdfBuffer)
    await execFileAsync('pdftoppm', ['-r', '300', '-png', inputPath, outputPrefix])

    const files = (await readdir(tmpDir))
      .filter(f => f.startsWith('page') && f.endsWith('.png'))
      .sort()

    const texts: string[] = []
    for (const file of files) {
      const buf = await readFile(join(tmpDir, file))
      try { texts.push(await ocrBuffer(buf)) } catch { /* low quality page — skip */ }
    }
    return texts.join('\n')
  } finally {
    // Cleanup temp files
    const all = await readdir(tmpDir)
    await Promise.all(all.map(f => unlink(join(tmpDir, f)).catch(() => {})))
  }
}
```

---

## 4. Create Ollama LLM utility (`server/utils/ollama.ts`)

Replaces Anthropic SDK calls. Calls local Ollama REST API with Zod validation on the response.

```ts
import { z } from 'zod'

const PartSchema = z.object({
  name: z.string(),
  partNo: z.string().default(''),
  brand: z.string().default(''),
  quantity: z.number().default(1),
  unitCost: z.number().default(0)
})

const PartsArraySchema = z.array(PartSchema)

const SYSTEM_PROMPT = `You are a parts extraction assistant. Given supplier document text, extract every part mentioned.
Return ONLY a JSON array. Each element must have:
  - name (string) part description
  - partNo (string) article/part number, empty string if not found
  - brand (string) manufacturer or brand, empty string if not found
  - quantity (number) quantity ordered, default 1
  - unitCost (number) unit price excluding VAT, 0 if not found
If no parts found, return [].`

async function callOllama(prompt: string, strict = false): Promise<unknown> {
  const url = `${process.env.OLLAMA_URL || 'http://localhost:11434'}/api/generate`
  const model = process.env.OLLAMA_MODEL || 'llama3.2:3b'

  const res = await $fetch<{ response: string }>(url, {
    method: 'POST',
    body: {
      model,
      system: SYSTEM_PROMPT,
      prompt: strict ? `Return ONLY a raw JSON array, no other text.\n\n${prompt}` : prompt,
      format: 'json',
      stream: false,
      options: { temperature: strict ? 0 : 0.1 }
    }
  })
  return JSON.parse(res.response)
}

export async function extractPartsFromText(text: string): Promise<z.infer<typeof PartSchema>[]> {
  let parsed: unknown
  try {
    parsed = await callOllama(text)
  } catch {
    try { parsed = await callOllama(text, true) } catch { return [] }
  }

  const result = PartsArraySchema.safeParse(Array.isArray(parsed) ? parsed : [])
  return result.success ? result.data : []
}
```

---

## 5. Rewrite `server/api/parts/parse-photo.post.ts`

Replace Anthropic vision API:

1. Read each uploaded file buffer from `readMultipartFormData`
2. If `file.type === 'application/pdf'` → `extractPdfText(buffer)` → text
3. Else → `ocrBuffer(buffer)` → text; catch `warning: true` → accumulate warning
4. Concatenate all text segments
5. `extractPartsFromText(combinedText)` → parts
6. Store in `parsedDocuments` (sourceType: `'receipt'`) + return `{ id, parts }`

Remove `import Anthropic` entirely.

---

## 6. Rewrite `server/api/parts/parse-email.post.ts`

This endpoint is for the **UI paste flow** only — user copies email body text into the textarea.

Replace Anthropic call:

1. Accept `{ rawContent: string }` (keep existing interface)
2. Strip quoted replies: remove lines starting with `>` and everything after `On .* wrote:` regex
3. `extractPartsFromText(cleanedBody)` → parts
4. Store + return `{ id, parts }`

No attachment handling here — that belongs in the inbound handler (step 7).

Remove `import Anthropic` entirely.

---

## 7. Inbound email handler (`server/api/inbound/mail.post.ts`)

New endpoint for relay webhooks (Mailgun Inbound / Postal / Postfix HTTP forward).

The server receives the **full raw email** — parsing is done entirely server-side with `mailparser`:

```bash
npm install mailparser
npm install -D @types/mailparser
```

```ts
import { simpleParser } from 'mailparser'

export default defineEventHandler(async (event) => {
  // Relay sends raw RFC 2822 email as request body (Content-Type: message/rfc822)
  // Or Mailgun sends it as the `email` field in a multipart form
  const body = await readRawBody(event)
  const mail = await simpleParser(body)

  // 1. Body text — strip quoted replies
  const bodyText = (mail.text || '').replace(/^>.*$/gm, '').replace(/On .+wrote:/s, '').trim()

  // 2. Attachments — mailparser gives you { content: Buffer, contentType, filename }
  const attachmentTexts: string[] = []
  for (const att of mail.attachments) {
    if (att.contentType === 'application/pdf') {
      attachmentTexts.push(await extractPdfText(att.content))
    } else if (att.contentType.startsWith('image/')) {
      try { attachmentTexts.push(await ocrBuffer(att.content)) } catch { /* skip low quality */ }
    }
  }

  // 3. Combine and extract
  const combined = [bodyText, ...attachmentTexts].join('\n\n')
  const parts = await extractPartsFromText(combined)

  // 4. Store (no userId — inbound emails are not user-initiated)
  await db.insert(parsedDocuments).values({
    sourceType: 'email', rawContent: combined, parsedContent: parts, status: 'pending'
  })

  return null  // Mailgun requires 200 — Nitro sends 200 with null body automatically
})
```

DNS setup (done in DNS panel — not code):
- Point `MX wrenko.com` at Mailgun's inbound MX servers
- Configure Mailgun routing rule: match `*@wrenko.com` → forward to `POST https://yourserver.com/api/inbound/mail`

---

## Implementation order

1. Install deps + system packages (step 1)
2. `server/utils/ocr.ts` (step 2) — test with a real invoice photo
3. `server/utils/ollama.ts` (step 4) — test with raw text, confirm Ollama returns valid JSON
4. Rewrite `parse-photo` (step 5) — wire ocr → ollama, test end-to-end
5. Rewrite `parse-email` (step 6) — wire ollama, test with pasted email body
6. `server/utils/pdfExtract.ts` (step 3) — add PDF support to both endpoints
7. Inbound mail handler (step 7) — requires DNS/MX to test end-to-end
