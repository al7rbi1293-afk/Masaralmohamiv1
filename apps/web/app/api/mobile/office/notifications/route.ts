import { NextRequest, NextResponse } from 'next/server';
import { requireOfficeAppContext } from '@/lib/mobile/auth';
import { listOfficeNotifications } from '@/lib/mobile/office';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const auth = await requireOfficeAppContext(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { searchParams } = new URL(request.url);
  const data = await listOfficeNotifications(auth.context, {
    page: Number(searchParams.get('page') ?? '1') || 1,
    limit: Number(searchParams.get('limit') ?? '20') || 20,
  });

  return NextResponse.json(data);
}
