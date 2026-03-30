import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { listPartnerAuditLogs } from '@/lib/partners/service';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await requireAdmin('admin.audit.read');
  } catch {
    return NextResponse.json({ error: 'غير مصرح.' }, { status: 403 });
  }

  try {
    const logs = await listPartnerAuditLogs();
    return NextResponse.json({ logs });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'تعذر جلب سجل الشركاء.' },
      { status: 500 },
    );
  }
}
