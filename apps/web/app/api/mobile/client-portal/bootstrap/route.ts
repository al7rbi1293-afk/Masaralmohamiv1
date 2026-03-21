import { NextRequest, NextResponse } from 'next/server';
import { getClientPortalBootstrapData, requireClientPortalContext } from '@/lib/mobile/client-portal';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const auth = await requireClientPortalContext(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const data = await getClientPortalBootstrapData(auth.context);
  if (!data) {
    return NextResponse.json({ error: 'تعذر تحميل بيانات العميل المرتبط بهذه الجلسة.' }, { status: 404 });
  }

  return NextResponse.json(data);
}
