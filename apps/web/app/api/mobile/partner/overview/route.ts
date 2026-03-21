import { NextRequest, NextResponse } from 'next/server';
import { requirePartnerAppContext } from '@/lib/mobile/auth';
import { buildPartnerOverview } from '../_shared';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const auth = await requirePartnerAppContext(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const data = await buildPartnerOverview(auth.context);
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'تعذر تحميل بيانات بوابة الشريك.' },
      { status: 500 },
    );
  }
}
