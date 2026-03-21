import { NextRequest, NextResponse } from 'next/server';
import { requireOfficeAppContext } from '@/lib/mobile/auth';
import { listOfficeMatters } from '@/lib/mobile/office';
import {
  createOfficeMatter,
  MOBILE_OFFICE_FORBIDDEN_MESSAGE,
  toMobileOfficeUserMessage,
} from '@/lib/mobile/office-crud';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const auth = await requireOfficeAppContext(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { searchParams } = new URL(request.url);
  const data = await listOfficeMatters(auth.context, {
    q: searchParams.get('q'),
    status: searchParams.get('status'),
    clientId: searchParams.get('client_id'),
    page: Number(searchParams.get('page') ?? '1') || 1,
    limit: Number(searchParams.get('limit') ?? '20') || 20,
  });

  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const auth = await requireOfficeAppContext(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const matter = await createOfficeMatter(auth.context, body);
    return NextResponse.json({ matter }, { status: 201 });
  } catch (error) {
    const message = toMobileOfficeUserMessage(error, 'تعذر إنشاء القضية.', 'القضية غير موجودة.');
    const status =
      message === MOBILE_OFFICE_FORBIDDEN_MESSAGE
        ? 403
        : message === 'القضية غير موجودة.' || message === 'العميل غير موجود.'
          ? 404
          : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
