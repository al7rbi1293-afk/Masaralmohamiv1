import test from 'node:test';
import assert from 'node:assert/strict';
import { inferIntentHeuristically, chooseModelForIntent } from '../routing';
import { fitSourcesIntoBudget, MID_MODEL_BUDGET } from '../token-budget';

test('routes drafting requests to strong model', () => {
  const intent = inferIntentHeuristically({
    case_id: '11111111-1111-1111-1111-111111111111',
    message: 'اكتب مذكرة دفاع تفصيلية',
    template: 'draft_response',
  } as any);

  assert.equal(intent, 'draft');

  const model = chooseModelForIntent({
    intent: 'draft',
    sources: [],
    midModel: 'mid',
    strongModel: 'strong',
  });

  assert.equal(model, 'strong');
});

test('fits sources into token budget', () => {
  const sources = Array.from({ length: 20 }).map((_, index) => ({
    chunkId: `00000000-0000-0000-0000-${String(index).padStart(12, '0')}`,
    label: `source-${index}`,
    content: 'word '.repeat(800),
    pageNo: null,
    similarity: 0.9 - index * 0.01,
    pool: index < 10 ? ('case' as const) : ('kb' as const),
  }));

  const selected = fitSourcesIntoBudget({
    sources,
    modelBudget: MID_MODEL_BUDGET,
    promptOverheadTokens: 500,
  });

  assert.ok(selected.length > 0);
  assert.ok(selected.length < sources.length);
});
