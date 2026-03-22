import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { isSmtpConfigured } from '@/lib/env';
import { sendEmail } from '@/lib/email';
import { LOGIN_OTP_EMAIL_HTML, LOGIN_OTP_EMAIL_SUBJECT, LOGIN_OTP_EMAIL_TEXT } from '@/lib/email-templates';

export async function POST(request: Request) {
  try {
    const { email } = await request.json();

    const emailValidation = z.string().email().safeParse(email);
    if (!email || !emailValidation.success) {
      return NextResponse.json(
        { error: 'يرجى إدخال بريد إلكتروني صحيح.' },
        { status: 400 }
      );
    }

    const supabaseAdmin = createSupabaseServerClient();

    const normalizedEmail = email.trim().toLowerCase();

    const { data: user, error: userError } = await supabaseAdmin
      .from('app_users')
      .select('id, full_name, status')
      .eq('email', normalizedEmail)
      .maybeSingle();

    if (userError || !user) {
      return NextResponse.json(
        { error: 'البريد الإلكتروني غير مسجل في النظام.' },
        { status: 404 }
      );
    }

    if (user.status === 'suspended') {
      return NextResponse.json(
        { error: 'عذراً، هذا الحساب غير مفعل.' },
        { status: 403 }
      );
    }

    if (!isSmtpConfigured()) {
      return NextResponse.json(
        { error: 'تعذر إرسال رمز التحقق حالياً لأن إعداد البريد الإلكتروني غير مكتمل.' },
        { status: 503 }
      );
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 minutes

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
        { error: 'حدث خطأ أثناء توليد الرمز. يرجى المحاولة لاحقاً.' },
        { status: 500 }
      );
    }

    try {
      await sendEmail({
        to: email,
        subject: LOGIN_OTP_EMAIL_SUBJECT,
        html: LOGIN_OTP_EMAIL_HTML({
          name: user.full_name || '',
          code: otp,
          ttlMinutes: 10,
        }),
        text: LOGIN_OTP_EMAIL_TEXT({
          name: user.full_name || '',
          code: otp,
          ttlMinutes: 10,
        }),
        requireConfigured: true,
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
    console.error('Request OTP error:', error);
    return NextResponse.json(
      { error: 'حدث خطأ غير متوقع. يرجى المحاولة مرة أخرى.' },
      { status: 500 }
    );
  }
}
