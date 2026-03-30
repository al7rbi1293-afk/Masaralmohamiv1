import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { deleteLawyerSurveyResponse, getLawyerSurveyResponses } from '@/lib/admin-lawyer-surveys';

export async function GET(request: NextRequest) {
  try {
    await requireAdmin('admin.surveys.read');
  } catch {
    return NextResponse.json({ error: 'غير مصرح.' }, { status: 403 });
  }

  try {
    const responses = await getLawyerSurveyResponses();
    return NextResponse.json({ responses });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'تعذر تحميل الردود.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await requireAdmin('admin.surveys.write');
  } catch {
    return NextResponse.json({ error: 'غير مصرح.' }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const responseId = typeof (body as { id?: unknown }).id === 'string' ? (body as { id: string }).id.trim() : '';
  if (!responseId) {
    return NextResponse.json({ error: 'بيانات غير صالحة.' }, { status: 400 });
  }

  try {
    const result = await deleteLawyerSurveyResponse(responseId);
    return NextResponse.json({ success: true, id: result.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'تعذر حذف الرد.';
    const status = message.includes('غير موجود') ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
