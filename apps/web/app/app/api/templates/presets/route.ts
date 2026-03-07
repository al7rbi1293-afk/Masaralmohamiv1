import { NextResponse } from 'next/server';
import { getCurrentAuthUser } from '@/lib/supabase/auth-session';
import { TEMPLATE_PRESETS } from '@/lib/templatePresets';

export async function GET() {
  const user = await getCurrentAuthUser();
  if (!user) {
    return NextResponse.json({ error: 'الرجاء تسجيل الدخول.' }, { status: 401 });
  }

  return NextResponse.json(
    { ok: true, count: TEMPLATE_PRESETS.length, presets: TEMPLATE_PRESETS },
    { status: 200 },
  );
}
