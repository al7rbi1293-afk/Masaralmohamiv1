import { NextRequest, NextResponse } from 'next/server';
import { requireOfficeAppContext } from '@/lib/mobile/auth';
import { getOfficeMatterDetails } from '@/lib/mobile/office';
import {
  deleteOfficeMatter,
  MOBILE_OFFICE_FORBIDDEN_MESSAGE,
  toMobileOfficeUserMessage,
  updateOfficeMatter,
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

  const matter = await getOfficeMatterDetails(auth.context, params.id);
  if (!matter) {
    return NextResponse.json({ error: 'القضية غير موجودة أو لا تملك صلاحية الوصول.' }, { status: 404 });
  }

  return NextResponse.json({ data: matter });
}

export async function PATCH(request: NextRequest, { params }: RouteProps) {
  const auth = await requireOfficeAppContext(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const matter = await updateOfficeMatter(auth.context, params.id, body);
    return NextResponse.json({ matter });
  } catch (error) {
    const message = toMobileOfficeUserMessage(error, 'تعذر تحديث القضية.', 'القضية غير موجودة.');
    const status =
      message === MOBILE_OFFICE_FORBIDDEN_MESSAGE
        ? 403
        : message === 'القضية غير موجودة.' || message === 'العميل غير موجود.'
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
    await deleteOfficeMatter(auth.context, params.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = toMobileOfficeUserMessage(error, 'تعذر حذف القضية.', 'القضية غير موجودة.');
    const status =
      message === MOBILE_OFFICE_FORBIDDEN_MESSAGE
        ? 403
        : message === 'القضية غير موجودة.'
          ? 404
          : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
