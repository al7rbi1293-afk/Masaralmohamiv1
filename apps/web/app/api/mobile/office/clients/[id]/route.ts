import { NextRequest, NextResponse } from 'next/server';
import { requireOfficeAppContext } from '@/lib/mobile/auth';
import {
  deleteOfficeClient,
  getOfficeClient,
  MOBILE_OFFICE_FORBIDDEN_MESSAGE,
  toMobileOfficeUserMessage,
  updateOfficeClient,
} from '@/lib/mobile/office-crud';

export const runtime = 'nodejs';

type RouteProps = {
  params: {
    id: string;
  };
};

export async function GET(request: NextRequest, { params }: RouteProps) {
  const auth = await requireOfficeAppContext(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const client = await getOfficeClient(auth.context, params.id);
    if (!client) {
      return NextResponse.json({ error: 'العميل غير موجود.' }, { status: 404 });
    }

    return NextResponse.json({ data: client });
  } catch (error) {
    const message = toMobileOfficeUserMessage(error, 'تعذر تحميل العميل.', 'العميل غير موجود.');
    const status = message === MOBILE_OFFICE_FORBIDDEN_MESSAGE ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function PATCH(request: NextRequest, { params }: RouteProps) {
  const auth = await requireOfficeAppContext(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const client = await updateOfficeClient(auth.context, params.id, body);
    return NextResponse.json({ client });
  } catch (error) {
    const message = toMobileOfficeUserMessage(error, 'تعذر تحديث العميل.', 'العميل غير موجود.');
    const status =
      message === MOBILE_OFFICE_FORBIDDEN_MESSAGE
        ? 403
        : message === 'العميل غير موجود.'
          ? 404
          : 400;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(request: NextRequest, { params }: RouteProps) {
  const auth = await requireOfficeAppContext(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    await deleteOfficeClient(auth.context, params.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = toMobileOfficeUserMessage(error, 'تعذر حذف العميل.', 'العميل غير موجود.');
    const status =
      message === MOBILE_OFFICE_FORBIDDEN_MESSAGE
        ? 403
        : message === 'العميل غير موجود.'
          ? 404
          : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
