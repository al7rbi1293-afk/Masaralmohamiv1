'use client';

import * as Sentry from '@sentry/nextjs';

declare global {
  // eslint-disable-next-line no-var
  var __MASAR_SENTRY_INIT__: boolean | undefined;
}

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN?.trim();

if (typeof window !== 'undefined' && dsn && !globalThis.__MASAR_SENTRY_INIT__) {
  globalThis.__MASAR_SENTRY_INIT__ = true;

  Sentry.init({
    dsn,
    enabled: true,
    sendDefaultPii: false,
    tracesSampleRate: 0,
    beforeSend(event) {
      // Avoid capturing query strings (can contain emails/tokens).
      if (event.request?.url) {
        event.request.url = event.request.url.split('?')[0] ?? event.request.url;
      }

      delete (event as any).user;
      delete (event as any).request;
      return event;
    },
  });
}

export function SentryClientInit() {
  return null;
}

