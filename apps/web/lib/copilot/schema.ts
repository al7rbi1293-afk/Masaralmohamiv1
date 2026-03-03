import { z } from 'zod';

export const copilotTemplateSchema = z.enum([
  'summarize_case',
  'draft_response',
  'extract_timeline',
  'hearing_plan',
]);

export const copilotRequestSchema = z.object({
  case_id: z.string().uuid(),
  message: z.string().trim().min(2).max(12000),
  session_id: z.string().uuid().optional(),
  template: copilotTemplateSchema.optional(),
  options: z
    .object({
      disable_answer_cache: z.boolean().optional(),
    })
    .optional(),
});

export const copilotCitationSchema = z.object({
  label: z.string().trim().min(1).max(200),
  chunkId: z.string().uuid(),
  quote: z.string().trim().min(1).max(1200),
});

export const copilotDraftSchema = z.object({
  title: z.string().trim().min(1).max(200),
  content_markdown: z.string().trim().min(1),
});

export const copilotResponseSchema = z.object({
  answer_markdown: z.string(),
  action_items: z.array(z.string()),
  missing_info_questions: z.array(z.string()),
  drafts: z.array(copilotDraftSchema),
  citations: z.array(copilotCitationSchema),
  confidence: z.enum(['low', 'medium', 'high']),
  meta: z.object({
    model: z.string(),
    latency_ms: z.number().int().nonnegative(),
    cached: z.boolean(),
  }),
});

export type CopilotRequest = z.infer<typeof copilotRequestSchema>;
export type CopilotResponse = z.infer<typeof copilotResponseSchema>;

export type CopilotSource = {
  chunkId: string;
  label: string;
  content: string;
  pageNo: number | null;
  similarity: number;
  pool: 'case' | 'kb' | 'brief';
};

export function defaultFailureResponse(params: {
  model: string;
  latencyMs: number;
  message?: string;
}): CopilotResponse {
  return {
    answer_markdown:
      params.message ||
      'تعذر إكمال الطلب بشكل آمن في الوقت الحالي. راجع المستندات المرفوعة أو أعد صياغة السؤال بشكل أدق.',
    action_items: [],
    missing_info_questions: ['هل يمكن تحديد السؤال القانوني بدقة أكبر أو تزويد مستندات إضافية؟'],
    drafts: [],
    citations: [],
    confidence: 'low',
    meta: {
      model: params.model,
      latency_ms: params.latencyMs,
      cached: false,
    },
  };
}

export function sanitizeAndValidateCitations(
  citations: CopilotResponse['citations'],
  sourceMap: Map<string, CopilotSource>,
): CopilotResponse['citations'] {
  return citations
    .filter((citation) => {
      const source = sourceMap.get(citation.chunkId);
      if (!source) return false;
      const sourceContent = normalizeForContainment(source.content);
      const quote = normalizeForContainment(citation.quote);
      return quote.length >= 4 && sourceContent.includes(quote);
    })
    .slice(0, 12);
}

export function buildFallbackCitations(
  sources: CopilotSource[],
): CopilotResponse['citations'] {
  return sources.slice(0, 5).map((source) => ({
    label: source.label,
    chunkId: source.chunkId,
    quote: source.content.slice(0, 220),
  }));
}

function normalizeForContainment(value: string) {
  return value.replace(/\s+/g, ' ').trim().toLowerCase();
}
