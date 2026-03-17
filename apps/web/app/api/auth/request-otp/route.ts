import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { sendEmail } from '@/lib/email';

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

    const html = `
      <div dir="rtl" style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <h2 style="color: #0b2b4d;">رمز تسجيل الدخول</h2>
        <p>مرحباً ${user.full_name || ''}،</p>
        <p>لقد طلبت تسجيل الدخول إلى حسابك في منصة مسار المحامي.</p>
        <p>الرمز السري المؤقت الخاص بك هو:</p>
        <div style="background-color: #f4f6f8; padding: 15px; border-radius: 8px; text-align: center; margin: 20px 0;">
          <h1 style="color: #00bf63; margin: 0; letter-spacing: 5px;">${otp}</h1>
        </div>
        <p>هذا الرمز صالح لمدة 10 دقائق فقط.</p>
        <p>إذا لم تكن قد طلبت هذا الرمز، يرجى تجاهل هذه الرسالة.</p>
        <br />
        <p>مع تحيات،<br />فريق منصة مسار المحامي</p>
      </div>
    `;

    try {
      await sendEmail({
        to: email,
        subject: 'رمز الدخول إلى مسار المحامي',
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
    console.error('Request OTP error:', error);
    return NextResponse.json(
      { error: 'حدث خطأ غير متوقع. يرجى المحاولة مرة أخرى.' },
      { status: 500 }
    );
  }
}
