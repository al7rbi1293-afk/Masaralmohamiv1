import test from 'node:test';
import assert from 'node:assert/strict';
import { access } from 'node:fs/promises';
import { constants } from 'node:fs';
import { runOcrStage } from '../stages/ocr';

const SAMPLE_IMAGE = process.env.COPILOT_TEST_IMAGE_PATH?.trim() || '';

test('ocr fallback smoke', async (t) => {
  if (!SAMPLE_IMAGE) {
    t.skip('COPILOT_TEST_IMAGE_PATH is not set.');
    return;
  }

  await access(SAMPLE_IMAGE, constants.R_OK);

  const result = await runOcrStage(SAMPLE_IMAGE, 'image/png');

  assert.ok(result.pageCount >= 1);
  assert.ok(typeof result.text === 'string');
});
