export type DequeuedCaseDocument = {
  id: string;
  org_id: string;
  case_id: string;
  source_document_id: string | null;
  file_name: string;
  mime_type: string | null;
  storage_bucket: string;
  storage_path: string;
  sha256: string;
  attempt_count: number;
  next_retry_at: string;
  extraction_meta: Record<string, unknown> | null;
  created_at: string;
};

export type StageLogStatus = 'started' | 'completed' | 'failed';

export type ExtractedText = {
  text: string;
  pageCount: number;
  textDensity: number;
  extractionMethod: 'pdf_text' | 'docx' | 'plain_text' | 'image' | 'unknown';
  needsOcr: boolean;
};

export type ChunkRecord = {
  chunkIndex: number;
  pageNo: number | null;
  content: string;
  tokenCount: number;
  metadata?: Record<string, unknown>;
};

export type EmbeddedChunkRecord = ChunkRecord & {
  embedding: number[];
};

export type CaseSummaryContext = {
  matter: {
    id: string;
    title: string;
    summary: string | null;
    claims: string | null;
    case_type: string | null;
  };
  events: Array<{
    type: string;
    note: string | null;
    event_date: string | null;
    created_at: string;
  }>;
  topChunks: Array<{
    id: string;
    content: string;
    page_no: number | null;
  }>;
};
