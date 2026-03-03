import type { SupabaseClient } from '@supabase/supabase-js';
import type { DequeuedCaseDocument, EmbeddedChunkRecord } from '../types';
import { replaceDocumentChunks } from '../db';

export async function runWriteStage(
  supabase: SupabaseClient,
  doc: DequeuedCaseDocument,
  chunks: EmbeddedChunkRecord[],
) {
  await replaceDocumentChunks(supabase, doc, chunks);
}
