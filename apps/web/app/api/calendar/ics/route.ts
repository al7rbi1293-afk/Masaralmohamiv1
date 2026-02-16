import { NextResponse } from 'next/server';

/**
 * Deprecated public ICS endpoint.
 * Use the authenticated endpoint: /app/api/calendar/ics
 */
export async function GET() {
  return NextResponse.json(
    {
      error: 'هذا المسار غير متاح. استخدم التصدير من داخل المنصة بعد تسجيل الدخول.',
    },
    { status: 410 },
  );
}
