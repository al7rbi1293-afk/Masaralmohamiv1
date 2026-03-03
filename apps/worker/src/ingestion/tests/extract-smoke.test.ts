import test from 'node:test';
import assert from 'node:assert/strict';
import { access } from 'node:fs/promises';
import { constants } from 'node:fs';
import { runExtractStage } from '../stages/extract';

const SAMPLE_PDF = process.env.COPILOT_TEST_PDF_PATH?.trim() || '';

test('pdf extraction smoke', async (t) => {
  if (!SAMPLE_PDF) {
    t.skip('COPILOT_TEST_PDF_PATH is not set.');
    return;
  }

  await access(SAMPLE_PDF, constants.R_OK);

  const result = await runExtractStage(
    {
      id: 'test',
      org_id: 'org',
      case_id: 'case',
      source_document_id: null,
      file_name: 'sample.pdf',
      mime_type: 'application/pdf',
      storage_bucket: 'documents',
      storage_path: 'unused',
      sha256: '',
      attempt_count: 0,
      next_retry_at: new Date().toISOString(),
      extraction_meta: {},
      created_at: new Date().toISOString(),
    },
    SAMPLE_PDF,
    100,
  );

  assert.equal(result.extractionMethod, 'pdf_text');
  assert.ok(result.pageCount >= 1);
  assert.ok(typeof result.text === 'string');
});
