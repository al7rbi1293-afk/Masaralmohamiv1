import { NextRequest, NextResponse } from 'next/server';
import { requireOfficeAppContext } from '@/lib/mobile/auth';
import {
  deleteOfficeTask,
  getOfficeTask,
  MOBILE_OFFICE_FORBIDDEN_MESSAGE,
  toMobileOfficeUserMessage,
  updateOfficeTask,
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
    const task = await getOfficeTask(auth.context, params.id);
    if (!task) {
      return NextResponse.json({ error: 'المهمة غير موجودة.' }, { status: 404 });
    }

    return NextResponse.json({ data: task });
  } catch (error) {
    const message = toMobileOfficeUserMessage(error, 'تعذر تحميل المهمة.', 'المهمة غير موجودة.');
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
    const task = await updateOfficeTask(auth.context, params.id, body);
    return NextResponse.json({ task });
  } catch (error) {
    const message = toMobileOfficeUserMessage(error, 'تعذر تحديث المهمة.', 'المهمة غير موجودة.');
    const status =
      message === MOBILE_OFFICE_FORBIDDEN_MESSAGE
        ? 403
        : message === 'المهمة غير موجودة.'
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
    await deleteOfficeTask(auth.context, params.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = toMobileOfficeUserMessage(error, 'تعذر حذف المهمة.', 'المهمة غير موجودة.');
    const status =
      message === MOBILE_OFFICE_FORBIDDEN_MESSAGE
        ? 403
        : message === 'المهمة غير موجودة.'
          ? 404
          : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
