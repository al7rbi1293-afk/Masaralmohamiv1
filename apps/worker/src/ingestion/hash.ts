import crypto from 'node:crypto';
import { createReadStream } from 'node:fs';

export async function sha256File(filePath: string): Promise<string> {
  const hash = crypto.createHash('sha256');

  await new Promise<void>((resolve, reject) => {
    const stream = createReadStream(filePath);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolve());
  });

  return hash.digest('hex');
}

export function sha256Text(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

export function toPgVector(values: number[]): string {
  const normalized = values.map((v) => Number(v.toFixed(8)));
  return `[${normalized.join(',')}]`;
}
