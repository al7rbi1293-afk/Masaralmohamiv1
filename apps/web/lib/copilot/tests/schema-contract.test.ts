import test from 'node:test';
import assert from 'node:assert/strict';
import { copilotResponseSchema } from '../schema';

test('copilot response schema validates strict contract', () => {
  const sample = {
    answer_markdown: 'Test answer',
    action_items: ['Action 1'],
    missing_info_questions: ['Question 1'],
    drafts: [{ title: 'Draft 1', content_markdown: 'Draft body' }],
    citations: [
      {
        label: 'Doc',
        chunkId: '11111111-1111-1111-1111-111111111111',
        quote: 'Quoted text',
      },
    ],
    confidence: 'medium',
    meta: {
      model: 'gpt-5-nano',
      latency_ms: 120,
      cached: false,
    },
  };

  const result = copilotResponseSchema.safeParse(sample);
  assert.equal(result.success, true);
});
