import type { SupabaseClient } from '@supabase/supabase-js';
import type { DequeuedCaseDocument } from '../types';
import { downloadDocumentToTemp } from '../storage';

export async function runDownloadStage(
  supabase: SupabaseClient,
  doc: DequeuedCaseDocument,
  tempRoot: string,
) {
  return downloadDocumentToTemp(supabase, doc, tempRoot);
}
