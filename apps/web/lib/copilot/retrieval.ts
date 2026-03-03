import type { SupabaseClient } from '@supabase/supabase-js';
import type { CopilotSource } from './schema';
import { selectBuiltInLegalReferences } from './legal-references';

export function normalizeCopilotQuery(input: string): string {
  return input.replace(/\s+/g, ' ').trim();
}

export function extractQuotedTerms(input: string): string[] {
  const terms: string[] = [];
  const patterns = [
    /"([^"]{2,120})"/g,
    /'([^']{2,120})'/g,
    /“([^”]{2,120})”/g,
    /«([^»]{2,120})»/g,
  ];

  for (const pattern of patterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(input)) !== null) {
      terms.push(match[1].trim());
    }
  }

  return Array.from(new Set(terms)).slice(0, 8);
}

export async function retrieveSources(params: {
  supabase: SupabaseClient;
  orgId: string;
  caseId: string;
  query: string;
  caseType?: string | null;
  embedding: number[];
  caseTopK: number;
  kbTopK: number;
  builtInKbTopK?: number;
  minSimilarity?: number;
  keywordTerms?: string[];
}): Promise<{ sources: CopilotSource[]; caseBrief: string | null }> {
  const embeddingVector = toPgVector(params.embedding);
  const keywordTerms = params.keywordTerms?.length ? params.keywordTerms : null;

  const [caseRes, kbRes, briefRes] = await Promise.all([
    params.supabase.rpc('match_case_chunks', {
      p_org_id: params.orgId,
      p_case_id: params.caseId,
      p_query_embedding: embeddingVector,
      p_match_count: params.caseTopK,
      p_min_similarity: params.minSimilarity ?? null,
      p_keyword_terms: keywordTerms,
    }),
    params.supabase.rpc('match_kb_chunks', {
      p_org_id: params.orgId,
      p_query_embedding: embeddingVector,
      p_match_count: params.kbTopK,
      p_min_similarity: params.minSimilarity ?? null,
      p_keyword_terms: keywordTerms,
    }),
    params.supabase
      .from('case_briefs')
      .select('brief_markdown')
      .eq('org_id', params.orgId)
      .eq('case_id', params.caseId)
      .maybeSingle(),
  ]);

  if (caseRes.error) throw caseRes.error;
  if (kbRes.error) throw kbRes.error;
  if (briefRes.error) throw briefRes.error;

  const caseSources = ((caseRes.data as any[]) ?? []).map((row) => mapRowToSource(row, 'case'));
  const kbSources = ((kbRes.data as any[]) ?? []).map((row) => mapRowToSource(row, 'kb'));
  const builtInKbSources = selectBuiltInLegalReferences({
    query: params.query,
    caseType: params.caseType ?? null,
    limit: params.builtInKbTopK ?? Math.max(4, Math.min(8, params.kbTopK)),
  });

  const briefMarkdown = (briefRes.data as any)?.brief_markdown
    ? String((briefRes.data as any).brief_markdown)
    : null;

  const briefSource: CopilotSource[] = briefMarkdown
    ? [
        {
          chunkId: deterministicBriefChunkId(params.caseId),
          label: 'Case brief',
          content: briefMarkdown,
          pageNo: null,
          similarity: 0.7,
          pool: 'brief',
        },
      ]
    : [];

  return {
    sources: mergeSources([...caseSources, ...kbSources, ...builtInKbSources, ...briefSource])
      .filter((source) => source.content.trim().length > 0)
      .sort((a, b) => b.similarity - a.similarity),
    caseBrief: briefMarkdown,
  };
}

function mapRowToSource(row: any, pool: 'case' | 'kb'): CopilotSource {
  return {
    chunkId: String(row.chunk_id),
    label: String(row.source_label ?? (pool === 'case' ? 'Case document' : 'Legal KB')),
    content: String(row.content ?? ''),
    pageNo: row.page_no == null ? null : Number(row.page_no),
    similarity: Number(row.similarity ?? 0),
    pool,
  };
}

function toPgVector(values: number[]): string {
  return `[${values.map((value) => Number(value.toFixed(8))).join(',')}]`;
}

function deterministicBriefChunkId(caseId: string): string {
  // A fixed synthetic UUID namespace segment for case briefs.
  const suffix = caseId.replace(/-/g, '').slice(0, 12).padEnd(12, '0');
  return `00000000-0000-0000-0000-${suffix}`;
}

function mergeSources(sources: CopilotSource[]): CopilotSource[] {
  const map = new Map<string, CopilotSource>();
  for (const source of sources) {
    const existing = map.get(source.chunkId);
    if (!existing || source.similarity > existing.similarity) {
      map.set(source.chunkId, source);
    }
  }
  return Array.from(map.values());
}
