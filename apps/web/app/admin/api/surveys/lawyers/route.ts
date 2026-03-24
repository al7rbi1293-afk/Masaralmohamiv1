import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { getLawyerSurveyResponses } from '@/lib/admin-lawyer-surveys';

export async function GET(request: NextRequest) {
  try {
    await requireAdmin();
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
