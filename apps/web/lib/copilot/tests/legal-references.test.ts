import test from 'node:test';
import assert from 'node:assert/strict';
import { selectBuiltInLegalReferences } from '../legal-references';

test('commercial queries prioritize commercial legal references', () => {
  const references = selectBuiltInLegalReferences({
    query: 'أريد صياغة لائحة دعوى تجارية مع دفوع واختصاص المحكمة التجارية',
    caseType: 'commercial',
    limit: 6,
  });

  assert.ok(references.length > 0);
  assert.ok(references.some((ref) => /المحاكم التجارية|تجارية/.test(ref.label)));
});

test('personal status case gets personal status references', () => {
  const references = selectBuiltInLegalReferences({
    query: 'نزاع حضانة ونفقة مع طلبات مستعجلة',
    caseType: 'personal_status',
    limit: 5,
  });

  assert.ok(references.length > 0);
  assert.ok(references.some((ref) => ref.label.includes('الأحوال الشخصية')));
});

test('fallback still returns base legal references for broad questions', () => {
  const references = selectBuiltInLegalReferences({
    query: 'كيف أبدأ في بناء ملف قضية بشكل مهني؟',
    caseType: null,
    limit: 4,
  });

  assert.ok(references.length >= 3);
});
