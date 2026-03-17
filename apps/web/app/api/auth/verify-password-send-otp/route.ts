import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { sendEmail } from '@/lib/email';
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

    const { data: user, error: userError } = await supabaseAdmin
      .from('app_users')
      .select('id, full_name, is_active, password_hash, status, email_verified')
      .eq('email', email)
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

    if (!user.is_active) {
      return NextResponse.json(
        { error: 'عذراً، هذا الحساب غير مفعل.' },
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
        { error: 'حدث خطأ أثناء إعداد جلسة التحقق. يرجى المحاولة لاحقاً.' },
        { status: 500 }
      );
    }

    const html = `
      <div dir="rtl" style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <h2 style="color: #0b2b4d;">رمز التحقق الثنائي</h2>
        <p>مرحباً ${user.full_name || ''}،</p>
        <p>كمستوى أمان إضافي، نرجو منك إدخال الرمز السري أدناه لإكمال تسجيل الدخول لـ حسابك في منصة مسار المحامي.</p>
        <div style="background-color: #f4f6f8; padding: 15px; border-radius: 8px; text-align: center; margin: 20px 0;">
          <h1 style="color: #00bf63; margin: 0; letter-spacing: 5px;">${otp}</h1>
        </div>
        <p>هذا الرمز صالح لمدة 10 دقائق فقط.</p>
        <p>إذا لم تكن أنت من يحاول الدخول للبريد، يرجى تغيير كلمة المرور فورا.</p>
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
    console.error('Request OTP via Password error:', error);
    return NextResponse.json(
      { error: 'حدث خطأ غير متوقع. يرجى المحاولة مرة أخرى.' },
      { status: 500 }
    );
  }
}
