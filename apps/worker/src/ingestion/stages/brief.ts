import type OpenAI from 'openai';
import type { SupabaseClient } from '@supabase/supabase-js';
import { generateCaseBrief } from '../openai';
import { getCaseSummaryContext, upsertCaseBrief } from '../db';

const FACTS_JSON_RE = /```json\s*([\s\S]*?)```/i;

export async function runBriefStage(
  supabase: SupabaseClient,
  openai: OpenAI,
  model: string,
  params: {
    orgId: string;
    caseId: string;
    userId?: string | null;
  },
) {
  const context = await getCaseSummaryContext(supabase, params.orgId, params.caseId);

  const prompt = [
    'ألّف ملخصًا عربيًا موجزًا للقضية اعتمادًا على البيانات التالية فقط دون اختراع أي حقائق.',
    'أعد الناتج بصيغة:',
    '1) فقرة موجزة markdown.',
    '2) كتلة JSON بين ```json ... ``` تحتوي:',
    '{"facts": string[], "timeline": {"date": string, "event": string}[]}',
    '',
    `عنوان القضية: ${context.matter.title}`,
    `نوع القضية: ${context.matter.case_type ?? 'غير محدد'}`,
    `ملخص موجود: ${context.matter.summary ?? 'لا يوجد'}`,
    `مطالبات: ${context.matter.claims ?? 'لا يوجد'}`,
    '',
    'الأحداث:',
    ...context.events.map((event) => `- [${event.event_date ?? event.created_at}] ${event.type}: ${event.note ?? ''}`),
    '',
    'مقتطفات مستندات القضية:',
    ...context.topChunks.slice(0, 12).map((chunk) => `- (chunk:${chunk.id}${chunk.page_no ? `, page:${chunk.page_no}` : ''}) ${chunk.content.slice(0, 800)}`),
  ].join('\n');

  let briefMarkdown = '';
  let facts: string[] = [];
  let timeline: Array<{ date: string; event: string }> = [];

  try {
    const raw = await generateCaseBrief(openai, model, prompt);
    briefMarkdown = extractBriefMarkdown(raw);
    const parsed = extractFactsAndTimeline(raw);
    facts = parsed.facts;
    timeline = parsed.timeline;
  } catch {
    briefMarkdown = fallbackBrief(context);
    facts = context.events
      .slice(0, 10)
      .map((event) => `${event.type}: ${event.note ?? 'حدث بدون تفاصيل'}`);
    timeline = context.events.slice(0, 10).map((event) => ({
      date: event.event_date ?? event.created_at.slice(0, 10),
      event: `${event.type}${event.note ? ` - ${event.note}` : ''}`,
    }));
  }

  await upsertCaseBrief(supabase, {
    orgId: params.orgId,
    caseId: params.caseId,
    userId: params.userId ?? null,
    briefMarkdown,
    facts,
    timeline,
    sourceChunkIds: context.topChunks.map((chunk) => chunk.id),
  });
}

function extractBriefMarkdown(raw: string): string {
  const jsonMatch = raw.match(FACTS_JSON_RE);
  if (!jsonMatch) {
    return raw.trim();
  }

  const briefPart = raw.slice(0, jsonMatch.index).trim();
  return briefPart || raw.trim();
}

function extractFactsAndTimeline(raw: string): {
  facts: string[];
  timeline: Array<{ date: string; event: string }>;
} {
  const match = raw.match(FACTS_JSON_RE);
  if (!match) {
    return { facts: [], timeline: [] };
  }

  try {
    const json = JSON.parse(match[1]);
    const facts = Array.isArray(json.facts)
      ? json.facts.filter((item: unknown) => typeof item === 'string').slice(0, 40)
      : [];

    const timeline = Array.isArray(json.timeline)
      ? json.timeline
          .map((item: unknown) => {
            const record = item as { date?: unknown; event?: unknown } | null;
            return {
              date: typeof record?.date === 'string' ? record.date : '',
              event: typeof record?.event === 'string' ? record.event : '',
            };
          })
          .filter((item: { date: string; event: string }) => item.date && item.event)
          .slice(0, 60)
      : [];

    return { facts, timeline };
  } catch {
    return { facts: [], timeline: [] };
  }
}

function fallbackBrief(context: {
  matter: { title: string; summary: string | null; claims: string | null };
  events: Array<{ type: string; note: string | null; event_date: string | null; created_at: string }>;
}) {
  const eventPreview = context.events
    .slice(0, 6)
    .map((event) => `- ${event.event_date ?? event.created_at.slice(0, 10)}: ${event.type}${event.note ? ` (${event.note})` : ''}`)
    .join('\n');

  return [
    `## ملخص القضية: ${context.matter.title}`,
    '',
    context.matter.summary ?? 'لا يوجد ملخص مسجّل سابقًا.',
    '',
    context.matter.claims ? `### المطالبات\n${context.matter.claims}` : '',
    '',
    eventPreview ? `### أبرز الأحداث\n${eventPreview}` : 'لا توجد أحداث مسجّلة حتى الآن.',
  ]
    .filter(Boolean)
    .join('\n');
}
