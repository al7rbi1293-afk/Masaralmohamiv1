import { NextRequest, NextResponse } from 'next/server';
import { requireMobileOfficeOwnerContext } from '@/lib/mobile/auth';
import { getMobileTeamOverview } from '@/lib/mobile/team';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const auth = await requireMobileOfficeOwnerContext(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const overview = await getMobileTeamOverview(auth.context);
    return NextResponse.json({ ok: true, ...overview });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'تعذر تحميل الفريق.';
    const status = message === 'missing_org' ? 403 : 500;
    return NextResponse.json({ error: status === 403 ? 'لا يوجد مكتب مفعّل لهذا الحساب.' : message }, { status });
  }
}
