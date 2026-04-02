# Parts Ingestion Pipeline

Automated extraction of parts data from supplier emails and photos into Wrenko.

---

## Overview

Two entry points feed into the same extraction pipeline:

```
Email (@wrenko.com)  ──►  Text extraction  ──►  LLM  ──►  Structured parts
Photo (upload)       ──►  OCR              ──╯
```

The LLM always receives plain text. Whether that text came from a PDF, an email body, or an OCR scan of a photo does not matter to it.

---

## 1. Email Ingestion

Incoming mail to `*@wrenko.com` is routed to the inbound handler via an MX record pointing at the server (or a relay service like Postfix, Mailgun Inbound, or Postal).

**Handler receives:**
- Sender, subject, plain-text body, HTML body
- Attachments (PDF, PNG, JPG, TIFF, etc.)

**Steps:**
1. Strip quoted reply text and signatures from the email body.
2. Pass the clean body text directly to the extraction stage.
3. For each attachment, determine type and branch:
   - `.pdf` → PDF text extraction (see §2)
   - image (`png`, `jpg`, `tiff`, `webp`) → OCR (see §3)
   - anything else → skip, log as unsupported

All extracted text segments (body + each attachment) are concatenated into a single input document before being sent to the LLM.

---

## 2. PDF Text Extraction

Most supplier invoices and order confirmations are machine-readable PDFs. Try text extraction first; fall back to OCR only if the PDF yields no usable text.

```
PDF
 │
 ├─► pdftotext (or pdf-parse / pdfjs)
 │       │
 │       ├─ text found ──► pass to LLM input
 │       │
 │       └─ no text (scanned) ──► rasterise pages ──► OCR (§3) ──► pass to LLM input
```

**Implementation notes:**
- Use `pdftotext` (poppler) or the `pdf-parse` npm package for extraction.
- If extracted text length < 50 chars per page, treat as scanned and rasterise with `pdftoppm` or `sharp`, then OCR each page image.
- Preserve page order when concatenating multi-page text.

---

## 3. OCR (Images and Scanned PDFs)

Used for photo uploads from the app and for scanned PDF pages.

**Recommended engine:** Tesseract (local, no external API needed)

```
Image / rasterised PDF page
 │
 ├─► Pre-process: greyscale, deskew, upscale if < 300dpi
 ├─► Tesseract OCR  →  raw text
 └─► Light cleanup: collapse whitespace, remove lone characters
         │
         └──► pass to LLM input
```

**Implementation notes:**
- Run `tesseract` via a Node child process or the `tesseract.js` npm package.
- For multi-language supplier documents, configure the `--lang` flag (e.g. `nld+eng`).
- Photos taken of paper invoices often have perspective distortion — consider OpenCV-based deskew before OCR.

---

## 4. LLM Extraction

A locally hosted small LLM (e.g. Llama 3.2 3B, Phi-3 Mini, or Mistral 7B via Ollama) receives the combined text and returns structured parts data.

### Prompt structure

```
System:
You are a parts extraction assistant. Given supplier document text, extract every part
mentioned. Return ONLY a JSON array. Each element must have these fields:
  - name        (string)  part description
  - partNo      (string)  article number or part number, empty string if not found
  - brand       (string)  manufacturer or brand, empty string if not found
  - quantity    (number)  quantity ordered, default 1
  - unitCost    (number)  unit price excluding VAT, 0 if not found
If you cannot find any parts, return an empty array [].

User:
<extracted text>
```

### Expected output

```json
[
  {
    "name": "Oil Filter",
    "partNo": "OC1163",
    "brand": "Mahle",
    "quantity": 2,
    "unitCost": 8.45
  },
  {
    "name": "Air Filter",
    "partNo": "LX3877",
    "brand": "Mahle",
    "quantity": 1,
    "unitCost": 14.20
  }
]
```

### Implementation notes

- Call Ollama's REST API: `POST http://localhost:11434/api/generate`
- Set `"format": "json"` to constrain the output format.
- Validate the response against the schema before returning to the client — retry once with a stricter prompt if validation fails.
- Use a low temperature (0.1–0.2) to reduce hallucination on structured extraction tasks.

---

## 5. Integration with the App

### Email path (`POST /api/parts/parse-email`)

```
Client sends:  { rawEmail: string }  or  { body: string, attachmentUrls: string[] }
Server:
  1. Extract body text
  2. Fetch and process each attachment (§2 / §3)
  3. Concatenate all text
  4. Send to LLM (§4)
  5. Return parsed parts array
Client:
  - Shows parts in the "Email" tab of Add Parts modal
  - User selects parts to add to the visit
```

### Photo path (`POST /api/parts/parse-photo`)

```
Client sends:  multipart/form-data with image file(s)
Server:
  1. Save image(s) temporarily
  2. Run OCR (§3) on each image
  3. Concatenate OCR output
  4. Send to LLM (§4)  ← same step as email path
  5. Return parsed parts array
  6. Delete temp files
Client:
  - Same UI flow as email path from this point
```

---

## 6. Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                        Wrenko Server                        │
│                                                             │
│  Inbound email ──► /api/inbound/mail                        │
│       │                   │                                 │
│       │            body text ──────────────────┐            │
│       │                   │                    │            │
│       └─ attachments                           │            │
│               │                                │            │
│          ┌────┴─────┐                          │            │
│          │   PDF?   │──── pdf-parse ────────► concat        │
│          │  Image?  │──── Tesseract OCR ────► buffer        │
│          └──────────┘                          │            │
│                                                ▼            │
│  Photo upload ──► /api/parts/parse-photo                    │
│       │                   │                                 │
│       └──── Tesseract ────┘                                 │
│                           │                                 │
│                     combined text                           │
│                           │                                 │
│                           ▼                                 │
│                  Ollama (local LLM)                         │
│                           │                                 │
│                     JSON parts[]                            │
│                           │                                 │
│                           ▼                                 │
│                   API response to client                    │
└─────────────────────────────────────────────────────────────┘
```

---

## 7. Dependencies

| Component | Package / Tool | Notes |
|---|---|---|
| Email ingestion | Postfix + custom handler, or Mailgun Inbound | MX record required |
| PDF text extraction | `pdf-parse` (npm) | Falls back to OCR if < 50 chars/page |
| PDF rasterisation | `pdftoppm` (poppler-utils) | For scanned PDFs |
| OCR | `tesseract.js` or system `tesseract` | `nld+eng` language pack |
| LLM runtime | Ollama | Runs locally, no API key |
| LLM model | `llama3.2:3b` or `phi3:mini` | Small models are fast enough for this task |
| Schema validation | `zod` | Validate LLM JSON output before returning |

---

## 8. Error Handling

| Failure | Behaviour |
|---|---|
| Email attachment unreadable | Skip attachment, proceed with body text only |
| PDF yields no text and OCR also fails | Return `{ parts: [], warning: "Could not extract text" }` |
| LLM returns invalid JSON | Retry once with stricter prompt; if still invalid, return empty array with error flag |
| LLM times out | Return error, let user retry manually |
| Photo too blurry for OCR (confidence < 40%) | Return `{ parts: [], warning: "Image quality too low" }` |
