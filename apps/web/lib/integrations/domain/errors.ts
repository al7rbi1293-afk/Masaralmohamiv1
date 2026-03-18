export class IntegrationError extends Error {
  readonly code: string;
  readonly statusCode: number;
  readonly retryable: boolean;
  readonly details?: Record<string, unknown>;

  constructor(params: {
    code: string;
    message: string;
    statusCode?: number;
    retryable?: boolean;
    details?: Record<string, unknown>;
  }) {
    super(params.message);
    this.name = 'IntegrationError';
    this.code = params.code;
    this.statusCode = params.statusCode ?? 400;
    this.retryable = params.retryable ?? false;
    this.details = params.details;
  }
}

export function integrationError(
  code: string,
  message: string,
  options: { statusCode?: number; retryable?: boolean; details?: Record<string, unknown> } = {},
) {
  return new IntegrationError({
    code,
    message,
    statusCode: options.statusCode,
    retryable: options.retryable,
    details: options.details,
  });
}

export function ensureIntegrationError(error: unknown, fallbackMessage = 'تعذر إكمال العملية المطلوبة.') {
  if (error instanceof IntegrationError) {
    return error;
  }

  if (error instanceof Error) {
    return integrationError('unexpected_error', error.message || fallbackMessage, {
      statusCode: 500,
    });
  }

  return integrationError('unexpected_error', fallbackMessage, { statusCode: 500 });
}
