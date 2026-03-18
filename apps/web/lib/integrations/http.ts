import { logError } from '@/lib/logger';
import { ensureIntegrationError } from './domain/errors';

export function toIntegrationErrorResponse(error: unknown, event: string) {
  const normalized = ensureIntegrationError(error);
  logError(event, {
    code: normalized.code,
    status_code: normalized.statusCode,
    message: normalized.message,
    details: normalized.details,
  });

  return {
    status: normalized.statusCode,
    body: {
      error: normalized.message,
      code: normalized.code,
    },
  };
}
