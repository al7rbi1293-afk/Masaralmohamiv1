import { NextRequest, NextResponse } from 'next/server';
import { requireOfficeAppContext } from '@/lib/mobile/auth';
import {
  createOfficeClient,
  listOfficeClients,
  MOBILE_OFFICE_FORBIDDEN_MESSAGE,
  toMobileOfficeUserMessage,
} from '@/lib/mobile/office-crud';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const auth = await requireOfficeAppContext(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const { searchParams } = new URL(request.url);
    const data = await listOfficeClients(auth.context, {
      q: searchParams.get('q'),
      status: (searchParams.get('status') as 'active' | 'archived' | 'all' | null) ?? null,
      page: Number(searchParams.get('page') ?? '1') || 1,
      limit: Number(searchParams.get('limit') ?? '20') || 20,
    });

    return NextResponse.json(data);
  } catch (error) {
    const message = toMobileOfficeUserMessage(error, 'تعذر تحميل العملاء.', 'العميل غير موجود.');
    const status = message === MOBILE_OFFICE_FORBIDDEN_MESSAGE ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireOfficeAppContext(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const client = await createOfficeClient(auth.context, body);
    return NextResponse.json({ client }, { status: 201 });
  } catch (error) {
    const message = toMobileOfficeUserMessage(error, 'تعذر إنشاء العميل.', 'العميل غير موجود.');
    const status = message === MOBILE_OFFICE_FORBIDDEN_MESSAGE ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
