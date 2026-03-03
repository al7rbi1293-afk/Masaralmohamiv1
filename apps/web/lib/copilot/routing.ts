import type { CopilotRequest, CopilotSource } from './schema';

export type CopilotIntent = 'qna' | 'draft' | 'analyze';

export function inferIntentHeuristically(request: CopilotRequest): CopilotIntent | 'ambiguous' {
  if (request.template === 'draft_response' || request.template === 'hearing_plan') {
    return 'draft';
  }

  if (request.template === 'extract_timeline' || request.template === 'summarize_case') {
    return 'analyze';
  }

  const text = request.message.toLowerCase();

  const draftHints = [
    'draft',
    'صياغ',
    'اكتب',
    'مذكرة',
    'لائحة',
    'خطاب',
    'جواب',
    'رد',
    'سرد قانوني',
    'دفاع',
  ];

  if (draftHints.some((hint) => text.includes(hint))) {
    return 'draft';
  }

  const analysisHints = ['حلل', 'تحليل', 'مخاطر', 'فرص', 'timeline', 'جدول زمني', 'ملخص'];
  if (analysisHints.some((hint) => text.includes(hint))) {
    return 'analyze';
  }

  if (text.length <= 260) {
    return 'qna';
  }

  return 'ambiguous';
}

export function chooseModelForIntent(params: {
  intent: CopilotIntent;
  sources: CopilotSource[];
  midModel: string;
  strongModel: string;
}): string {
  const { intent, sources, midModel, strongModel } = params;

  if (intent === 'qna' && hasEnoughHighConfidenceSources(sources)) {
    return midModel;
  }

  return strongModel;
}

function hasEnoughHighConfidenceSources(sources: CopilotSource[]): boolean {
  const high = sources.filter((source) => source.similarity >= 0.72);
  return high.length >= 3;
}
