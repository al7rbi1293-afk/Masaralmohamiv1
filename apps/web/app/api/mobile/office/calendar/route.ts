import { NextRequest, NextResponse } from 'next/server';
import { requireOfficeAppContext } from '@/lib/mobile/auth';
import { listOfficeCalendar } from '@/lib/mobile/office';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const auth = await requireOfficeAppContext(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { searchParams } = new URL(request.url);
  const data = await listOfficeCalendar(auth.context, {
    from: searchParams.get('from'),
    to: searchParams.get('to'),
    mine: searchParams.get('mine') === '1',
  });

  return NextResponse.json(data);
}
