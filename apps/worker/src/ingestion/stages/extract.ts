import { promises as fs } from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import mammoth from 'mammoth';
import type { DequeuedCaseDocument, ExtractedText } from '../types';
import { normalizeText } from '../tokenize';

const execFileAsync = promisify(execFile);

export async function runExtractStage(
  doc: DequeuedCaseDocument,
  filePath: string,
  textDensityThreshold: number,
): Promise<ExtractedText> {
  const lower = doc.file_name.toLowerCase();
  const mime = (doc.mime_type || '').toLowerCase();

  if (lower.endsWith('.pdf') || mime === 'application/pdf') {
    return extractPdf(filePath, textDensityThreshold);
  }

  if (
    lower.endsWith('.docx') ||
    mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ) {
    const result = await mammoth.extractRawText({ path: filePath });
    const text = normalizeText(result.value || '');
    return {
      text,
      pageCount: 1,
      textDensity: text.length,
      extractionMethod: 'docx',
      needsOcr: text.length < 80,
    };
  }

  if (mime.startsWith('text/') || lower.endsWith('.txt') || lower.endsWith('.md')) {
    const text = normalizeText(await fs.readFile(filePath, 'utf8'));
    return {
      text,
      pageCount: 1,
      textDensity: text.length,
      extractionMethod: 'plain_text',
      needsOcr: false,
    };
  }

  if (mime.startsWith('image/') || isImageByExtension(lower)) {
    return {
      text: '',
      pageCount: 1,
      textDensity: 0,
      extractionMethod: 'image',
      needsOcr: true,
    };
  }

  const fallbackText = normalizeText(await fs.readFile(filePath, 'utf8').catch(() => ''));
  return {
    text: fallbackText,
    pageCount: 1,
    textDensity: fallbackText.length,
    extractionMethod: 'unknown',
    needsOcr: fallbackText.length < 120,
  };
}

async function extractPdf(filePath: string, threshold: number): Promise<ExtractedText> {
  const { stdout: textStdout } = await execFileAsync('pdftotext', ['-layout', '-enc', 'UTF-8', filePath, '-']);
  const text = normalizeText(textStdout || '');

  const { stdout: infoStdout } = await execFileAsync('pdfinfo', [filePath]);
  const pageCount = extractPageCount(infoStdout);
  const textDensity = pageCount > 0 ? text.length / pageCount : text.length;

  return {
    text,
    pageCount,
    textDensity,
    extractionMethod: 'pdf_text',
    needsOcr: textDensity < threshold,
  };
}

function extractPageCount(pdfInfoOutput: string): number {
  const line = pdfInfoOutput
    .split('\n')
    .map((value) => value.trim())
    .find((value) => value.toLowerCase().startsWith('pages:'));

  if (!line) return 1;
  const match = line.match(/pages:\s*(\d+)/i);
  if (!match) return 1;
  return Math.max(1, Number(match[1]));
}

function isImageByExtension(fileName: string) {
  const ext = path.extname(fileName).toLowerCase();
  return ext === '.png' || ext === '.jpg' || ext === '.jpeg' || ext === '.tif' || ext === '.tiff' || ext === '.webp';
}
