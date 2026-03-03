import { promises as fs } from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { normalizeText } from '../tokenize';

const execFileAsync = promisify(execFile);

export async function runOcrStage(filePath: string, mimeType: string | null): Promise<{ text: string; pageCount: number }> {
  const lower = filePath.toLowerCase();
  const mime = (mimeType || '').toLowerCase();

  if (lower.endsWith('.pdf') || mime === 'application/pdf') {
    return ocrPdf(filePath);
  }

  const text = await runTesseract(filePath);
  return {
    text,
    pageCount: 1,
  };
}

async function ocrPdf(filePath: string): Promise<{ text: string; pageCount: number }> {
  const tmpDir = await fs.mkdtemp(path.join(path.dirname(filePath), 'ocr-'));
  const prefix = path.join(tmpDir, 'page');
  try {
    await execFileAsync('pdftoppm', ['-png', '-r', '200', filePath, prefix]);
    const files = (await fs.readdir(tmpDir))
      .filter((name) => name.endsWith('.png'))
      .sort((a, b) => a.localeCompare(b));

    const pages: string[] = [];
    for (const name of files) {
      const pagePath = path.join(tmpDir, name);
      pages.push(await runTesseract(pagePath));
    }

    return {
      text: normalizeText(pages.join('\n\n')),
      pageCount: Math.max(1, files.length),
    };
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => undefined);
  }
}

async function runTesseract(filePath: string): Promise<string> {
  const { stdout } = await execFileAsync('tesseract', [filePath, 'stdout', '-l', 'ara+eng', '--oem', '1', '--psm', '6']);
  return normalizeText(stdout || '');
}
