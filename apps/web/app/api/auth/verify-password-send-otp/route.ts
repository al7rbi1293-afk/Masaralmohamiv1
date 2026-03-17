import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { sendEmail } from '@/lib/email';
import { LOGIN_OTP_EMAIL_HTML, LOGIN_OTP_EMAIL_SUBJECT } from '@/lib/email-templates';
import { verifyPassword } from '@/lib/auth-custom';

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();

    const emailValidation = z.string().email().safeParse(email);
    if (!email || !emailValidation.success) {
      return NextResponse.json(
        { error: 'يرجى إدخال بريد إلكتروني صحيح.' },
        { status: 400 }
      );
    }

    if (!password) {
      return NextResponse.json(
        { error: 'يرجى إدخال كلمة المرور.' },
        { status: 400 }
      );
    }

    const supabaseAdmin = createSupabaseServerClient();

    const normalizedEmail = email.trim().toLowerCase();

    const { data: user, error: userError } = await supabaseAdmin
      .from('app_users')
      .select('id, full_name, password_hash, status, email_verified')
      .eq('email', normalizedEmail)
      .maybeSingle();

    if (userError || !user) {
      return NextResponse.json(
        { error: 'البريد الإلكتروني أو كلمة المرور غير صحيحة.' },
        { status: 404 }
      );
    }

    if (user.status === 'suspended') {
      return NextResponse.json(
        { error: 'تم تعليق الحساب. تواصل مع الإدارة.' },
        { status: 403 }
      );
    }

    if (!user.email_verified) {
      return NextResponse.json(
        { error: 'الحساب موجود ولكنه غير مفعل. يرجى مراجعة بريدك الإلكتروني لتفعيل الحساب.' },
        { status: 403 }
      );
    }

    // Verify the password
    const passwordMatch = await verifyPassword(password, user.password_hash);
    if (!passwordMatch) {
      return NextResponse.json(
        { error: 'البريد الإلكتروني أو كلمة المرور غير صحيحة.' },
        { status: 401 }
      );
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const ttlMinutes = 10;
    const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000).toISOString();

    const { error: updateError } = await supabaseAdmin
      .from('app_users')
      .update({
        otp_code: otp,
        otp_expires_at: expiresAt,
      })
      .eq('id', user.id);

    if (updateError) {
      console.error('Error updating OTP:', updateError);
      return NextResponse.json(
        { error: 'حدث خطأ أثناء إعداد جلسة التحقق. يرجى المحاولة لاحقاً.' },
        { status: 500 }
      );
    }

    const html = LOGIN_OTP_EMAIL_HTML({
      name: user.full_name || '',
      code: otp,
      ttlMinutes,
    });

    try {
      await sendEmail({
        to: email,
        subject: LOGIN_OTP_EMAIL_SUBJECT,
        html,
      });
    } catch (emailError) {
      console.error('Failed to send OTP email:', emailError);
      return NextResponse.json(
        { error: 'حدث خطأ أثناء إرسال البريد الإلكتروني. يرجى المحاولة لاحقاً.' },
        { status: 500 }
      );
    }

    return NextResponse.json({ message: 'تم إرسال رمز التحقق إلى بريدك الإلكتروني بنجاح.' });
  } catch (error) {
    console.error('Request OTP via Password error:', error);
    return NextResponse.json(
      { error: 'حدث خطأ غير متوقع. يرجى المحاولة مرة أخرى.' },
      { status: 500 }
    );
  }
}
