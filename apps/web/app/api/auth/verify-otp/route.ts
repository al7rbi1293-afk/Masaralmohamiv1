import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  try {
    const { email, otp } = await request.json();

    if (!email || !otp) {
      return NextResponse.json(
        { error: 'البريد الإلكتروني ورمز التحقق مطلوبان.' },
        { status: 400 }
      );
    }

    const supabaseAdmin = createSupabaseServerClient();

    const { data: user, error: userError } = await supabaseAdmin
      .from('app_users')
      .select('id, full_name, is_active, otp_code, otp_expires_at')
      .eq('email', email)
      .maybeSingle();

    if (userError || !user) {
      return NextResponse.json(
        { error: 'البريد الإلكتروني غير مسجل في النظام.' },
        { status: 404 }
      );
    }

    if (!user.is_active) {
      return NextResponse.json(
        { error: 'عذراً، هذا الحساب غير مفعل.' },
        { status: 403 }
      );
    }

    if (!user.otp_code || !user.otp_expires_at) {
      return NextResponse.json(
        { error: 'لم يتم طلب رمز تحقق لهذا الحساب.' },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();
    if (now > user.otp_expires_at) {
      return NextResponse.json(
        { error: 'انتهت صلاحية الرمز. يرجى طلب رمز جديد.' },
        { status: 400 }
      );
    }

    if (user.otp_code !== otp) {
      return NextResponse.json(
        { error: 'الرمز المدخل غير صحيح.' },
        { status: 400 }
      );
    }

    // Clear OTP after successful verification
    await supabaseAdmin
      .from('app_users')
      .update({
        otp_code: null,
        otp_expires_at: null,
      })
      .eq('id', user.id);

    // Note: The actual session creation happens in the client-side using supabase.auth.signInWithOtp()
    // This endpoint is primarily for validating our custom OTP tracking DB columns before doing the Supabase Auth login.
    // However, Supabase Auth handles its own OTPs. It's best if we let Supabase handle the magic link or OTP directly.
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Verify OTP error:', error);
    return NextResponse.json(
      { error: 'حدث خطأ غير متوقع. يرجى المحاولة مرة أخرى.' },
      { status: 500 }
    );
  }
}
