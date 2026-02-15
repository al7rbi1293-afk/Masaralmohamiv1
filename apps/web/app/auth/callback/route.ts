import { NextResponse } from 'next/server';
import { createSupabaseServerAuthClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
    const { searchParams, origin } = new URL(request.url);
    const code = searchParams.get('code');
    // if "next" is in param, use it as the redirect URL
    const next = searchParams.get('next') ?? '/app';

    if (code) {
        const supabase = createSupabaseServerAuthClient();
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (!error) {
            return NextResponse.redirect(`${origin}${next}`);
        }
    }

    // return the user to an error page with instructions
    return NextResponse.redirect(`${origin}/signin?error=${encodeURIComponent('رابط التحقق غير صالح أو انتهت صلاحيته. حاول تسجيل الدخول.')}`);
}
