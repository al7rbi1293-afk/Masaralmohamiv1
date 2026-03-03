import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { DequeuedCaseDocument } from './types';

export async function downloadDocumentToTemp(
  supabase: SupabaseClient,
  doc: DequeuedCaseDocument,
  tempRoot: string,
): Promise<{ filePath: string; byteSize: number }> {
  const { data, error } = await supabase.storage
    .from(doc.storage_bucket || 'documents')
    .download(doc.storage_path);

  if (error || !data) {
    throw new Error(`storage_download_failed:${error?.message ?? 'empty_data'}`);
  }

  const buffer = Buffer.from(await data.arrayBuffer());
  const ext = detectExtension(doc.file_name, doc.mime_type);
  const filePath = path.join(tempRoot, `${doc.id}${ext}`);

  await fs.mkdir(tempRoot, { recursive: true });
  await fs.writeFile(filePath, buffer);

  return {
    filePath,
    byteSize: buffer.byteLength,
  };
}

function detectExtension(fileName: string, mimeType: string | null): string {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.pdf')) return '.pdf';
  if (lower.endsWith('.docx')) return '.docx';
  if (lower.endsWith('.txt')) return '.txt';
  if (lower.endsWith('.png')) return '.png';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return '.jpg';
  if (lower.endsWith('.tif') || lower.endsWith('.tiff')) return '.tiff';

  if (mimeType === 'application/pdf') return '.pdf';
  if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') return '.docx';
  if (mimeType?.startsWith('image/')) return '.png';
  if (mimeType === 'text/plain') return '.txt';

  return '.bin';
}
