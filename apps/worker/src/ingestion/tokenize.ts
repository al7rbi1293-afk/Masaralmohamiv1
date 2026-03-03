export function normalizeText(input: string): string {
  return input
    .replace(/\u0000/g, ' ')
    .replace(/\r/g, '\n')
    .replace(/\t/g, ' ')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/ {2,}/g, ' ')
    .trim();
}

export function approximateTokenCount(input: string): number {
  const text = input.trim();
  if (!text) return 0;
  const words = text.split(/\s+/).length;
  return Math.ceil(words * 1.35);
}

export function splitIntoParagraphs(input: string): string[] {
  return input
    .split(/\n\s*\n/g)
    .map((p) => p.trim())
    .filter(Boolean);
}
