import * as Sentry from '@sentry/nextjs';

function scrubEvent(event: any) {
  if (event?.request?.url) {
    event.request.url = String(event.request.url).split('?')[0] ?? event.request.url;
  }

  if (event?.request) {
    delete event.request.cookies;
    delete event.request.headers;
    delete event.request.data;
    delete event.request.query_string;
  }

  delete event.user;
  return event;
}

export function register() {
  const dsn =
    process.env.SENTRY_DSN?.trim() ||
    process.env.NEXT_PUBLIC_SENTRY_DSN?.trim();

  if (!dsn) return;

  Sentry.init({
    dsn,
    sendDefaultPii: false,
    tracesSampleRate: 0,
    beforeSend: scrubEvent,
  });
}

// Next.js will call this on unhandled request errors.
// We keep it loose-typed to avoid coupling to SDK types.
export const onRequestError = (Sentry as any).captureRequestError;

