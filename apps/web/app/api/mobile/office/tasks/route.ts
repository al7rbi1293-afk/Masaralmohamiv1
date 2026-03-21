import { NextRequest, NextResponse } from 'next/server';
import { requireOfficeAppContext } from '@/lib/mobile/auth';
import { listOfficeTasks } from '@/lib/mobile/office';
import {
  createOfficeTask,
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
  const data = await listOfficeTasks(auth.context, {
    q: searchParams.get('q'),
    status: searchParams.get('status'),
    archived: (searchParams.get('archived') as 'active' | 'archived' | 'all' | null) ?? null,
    matterId: searchParams.get('matter_id'),
    page: Number(searchParams.get('page') ?? '1') || 1,
    limit: Number(searchParams.get('limit') ?? '20') || 20,
    mine: searchParams.get('mine') === '1',
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
    const task = await createOfficeTask(auth.context, body);
    return NextResponse.json({ task }, { status: 201 });
  } catch (error) {
    const message = toMobileOfficeUserMessage(error, 'تعذر إنشاء المهمة.', 'المهمة غير موجودة.');
    const status =
      message === MOBILE_OFFICE_FORBIDDEN_MESSAGE
        ? 403
        : message === 'المهمة غير موجودة.'
          ? 404
          : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
