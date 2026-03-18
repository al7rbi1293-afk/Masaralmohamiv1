import { logWarn } from '@/lib/logger';

type RetryOptions = {
  label: string;
  attempts?: number;
  baseDelayMs?: number;
  shouldRetry?: (error: unknown) => boolean;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function withRetry<T>(operation: () => Promise<T>, options: RetryOptions): Promise<T> {
  const attempts = Math.max(1, options.attempts ?? 3);
  const baseDelayMs = Math.max(50, options.baseDelayMs ?? 250);
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      const canRetry = attempt < attempts && (options.shouldRetry ? options.shouldRetry(error) : true);
      if (!canRetry) {
        throw error;
      }

      logWarn('integration_retry_scheduled', {
        label: options.label,
        attempt,
        max_attempts: attempts,
        message: error instanceof Error ? error.message : 'unknown',
      });

      const backoff = Math.min(4_000, baseDelayMs * Math.pow(2, attempt - 1));
      await sleep(backoff);
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Retry attempts exhausted.');
}
