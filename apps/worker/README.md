# Masar Worker (Copilot Ingestion)

This worker runs document ingestion for Legal Copilot:
- Polls `case_documents` queue via `dequeue_case_documents` RPC.
- Extracts text from PDF/DOCX/text.
- Falls back to OCR for scanned PDFs/images.
- Chunks, embeds, writes to `document_chunks`.
- Rebuilds `case_briefs`.

## Required Environment Variables

- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENAI_API_KEY`

## Optional Environment Variables

- `OPENAI_MODEL_EMBEDDING` (default: `text-embedding-3-small`)
- `OPENAI_MODEL_MID` (default: `gpt-4.1-mini`)
- `COPILOT_DOCS_BUCKET` (default: `documents`)
- `COPILOT_WORKER_CONCURRENCY` (default: `3`)
- `COPILOT_WORKER_POLL_INTERVAL_MS` (default: `3000`)
- `COPILOT_WORKER_DEQUEUE_BATCH_SIZE` (default: `10`)
- `COPILOT_WORKER_MAX_RETRIES` (default: `5`)
- `COPILOT_CHUNK_TOKENS` (default: `500`)
- `COPILOT_CHUNK_OVERLAP_TOKENS` (default: `80`)
- `COPILOT_MAX_CHUNKS_PER_DOCUMENT` (default: `1200`)
- `COPILOT_PDF_TEXT_DENSITY_THRESHOLD` (default: `160`)
- `COPILOT_TEMP_DIR` (default: OS temp path)

## Local Run

```bash
npm install
npm run dev:ingestion --workspace @sijil/worker
```

## Build + Start

```bash
npm run build --workspace @sijil/worker
npm run start:ingestion --workspace @sijil/worker
```

## OCR Dependencies

Required binaries:
- `poppler-utils` (`pdftotext`, `pdfinfo`, `pdftoppm`)
- `tesseract-ocr`
- `tesseract-ocr-ara`
- `tesseract-ocr-eng`

## Smoke Tests

```bash
COPILOT_TEST_PDF_PATH=/abs/path/sample.pdf \
node --test dist/ingestion/tests/extract-smoke.test.js

COPILOT_TEST_IMAGE_PATH=/abs/path/sample.png \
node --test dist/ingestion/tests/ocr-smoke.test.js
```
