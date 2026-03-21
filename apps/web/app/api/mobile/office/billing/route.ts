import { NextRequest, NextResponse } from 'next/server';
import { requireOfficeAppContext } from '@/lib/mobile/auth';
import { listOfficeBilling } from '@/lib/mobile/office';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const auth = await requireOfficeAppContext(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { searchParams } = new URL(request.url);
  const data = await listOfficeBilling(auth.context, {
    status: searchParams.get('status'),
    archived: (searchParams.get('archived') as 'active' | 'archived' | 'all' | null) ?? null,
    clientId: searchParams.get('client_id'),
    page: Number(searchParams.get('page') ?? '1') || 1,
    limit: Number(searchParams.get('limit') ?? '20') || 20,
  });

  return NextResponse.json(data);
}
