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

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN?.trim();

if (dsn) {
  Sentry.init({
    dsn,
    sendDefaultPii: false,
    tracesSampleRate: 0,
    beforeSend: scrubEvent,
  });
}
