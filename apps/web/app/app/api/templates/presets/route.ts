import { NextResponse } from 'next/server';
import { createSupabaseServerRlsClient } from '@/lib/supabase/server';
import { getCurrentAuthUser } from '@/lib/supabase/auth-session';

export async function GET() {
  const user = await getCurrentAuthUser();
  if (!user) {
    return NextResponse.json({ error: 'الرجاء تسجيل الدخول.' }, { status: 401 });
  }

  const supabase = createSupabaseServerRlsClient();
  const { data, error } = await supabase
    .from('template_presets')
    .select('code, name_ar, category, variables')
    .order('name_ar', { ascending: true })
    .limit(200);

  if (error) {
    return NextResponse.json({ error: 'تعذر تحميل القوالب الجاهزة.' }, { status: 400 });
  }

  return NextResponse.json({ presets: (data as any[]) ?? [] }, { status: 200 });
}

