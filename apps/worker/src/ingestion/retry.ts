export function isTransientError(error: unknown): boolean {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : '';

  const normalized = message.toLowerCase();

  return (
    normalized.includes('timeout') ||
    normalized.includes('temporar') ||
    normalized.includes('rate limit') ||
    normalized.includes('429') ||
    normalized.includes('502') ||
    normalized.includes('503') ||
    normalized.includes('504') ||
    normalized.includes('econnreset') ||
    normalized.includes('etimedout') ||
    normalized.includes('network')
  );
}

export function computeBackoffMs(attemptCount: number): number {
  const base = 1000;
  const maxMs = 60_000;
  const raw = base * Math.pow(2, Math.max(0, attemptCount - 1));
  return Math.min(raw, maxMs);
}
