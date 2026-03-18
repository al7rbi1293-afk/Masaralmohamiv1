import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { getNajizAdminSummary } from '@/lib/integrations/admin/najiz-observability.service';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await requireAdmin();
    const summary = await getNajizAdminSummary();
    return NextResponse.json(summary, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'تعذر تحميل لوحة Najiz الإدارية.';
    const status = message === 'not_admin' ? 403 : message === 'not_authenticated' ? 401 : 500;
    return NextResponse.json(
      {
        error: message,
      },
      { status },
    );
  }
}
