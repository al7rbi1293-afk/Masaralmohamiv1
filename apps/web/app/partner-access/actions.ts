'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import {
  generateSessionToken,
  hashPassword,
  SESSION_COOKIE_NAME,
  SESSION_COOKIE_OPTIONS,
} from '@/lib/auth-custom';
import { getPartnerAccessRequest } from '@/lib/partners/access';

const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{7,}$/;

export async function completePartnerAccessAction(formData: FormData) {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const token = String(formData.get('token') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  const confirmPassword = String(formData.get('confirm_password') ?? '');

  if (!email || !token) {
    redirect(buildPartnerAccessHref(email, token, 'رابط الوصول غير صالح أو غير مكتمل.'));
  }

  if (!PASSWORD_REGEX.test(password)) {
    redirect(
      buildPartnerAccessHref(
        email,
        token,
        'كلمة المرور يجب أن تكون 7 خانات على الأقل وتحتوي على حرف كبير، صغير، رقم، ورمز.',
      ),
    );
  }

  if (password !== confirmPassword) {
    redirect(buildPartnerAccessHref(email, token, 'كلمتا المرور غير متطابقتين.'));
  }

  const accessRequest = await getPartnerAccessRequest({ email, token });
  if (!accessRequest) {
    redirect(
      buildPartnerAccessHref(
        email,
        token,
        'انتهت صلاحية الرابط أو تم استخدامه مسبقاً. يمكنك تسجيل الدخول أو طلب رابط جديد من فريقنا.',
      ),
    );
  }

  const db = createSupabaseServerClient();
  const passwordHash = await hashPassword(password);

  const { error: updateError } = await db
    .from('app_users')
    .update({
      password_hash: passwordHash,
      email_verified: true,
      email_verification_token: null,
      email_verification_expires_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', accessRequest.userId);

  if (updateError) {
    redirect(buildPartnerAccessHref(email, token, 'تعذر إكمال تفعيل الحساب حالياً. حاول مرة أخرى.'));
  }

  const sessionToken = await generateSessionToken({
    userId: accessRequest.userId,
    email: accessRequest.email,
  });

  const cookieStore = cookies();
  cookieStore.set(SESSION_COOKIE_NAME, sessionToken, SESSION_COOKIE_OPTIONS);
  cookieStore.delete('masar-sb-access-token');
  cookieStore.delete('masar-sb-refresh-token');

  redirect('/app/partners?activated=1');
}

function buildPartnerAccessHref(email: string, token: string, error: string) {
  const search = new URLSearchParams();

  if (email) {
    search.set('email', email);
  }

  if (token) {
    search.set('token', token);
  }

  if (error) {
    search.set('error', error);
  }

  return `/partner-access?${search.toString()}`;
}
