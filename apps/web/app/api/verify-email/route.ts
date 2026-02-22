import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { logError, logInfo } from '@/lib/logger';

export async function GET(request: NextRequest) {
    const url = new URL(request.url);
    const token = url.searchParams.get('token');
    const email = url.searchParams.get('email');

    if (!token || !email) {
        return redirectWithError(request, 'رابط التفعيل غير صالح أو غير مكتمل.');
    }

    const db = createSupabaseServerClient();

    const { data: user, error } = await db
        .from('app_users')
        .select('id, email_verification_token, email_verification_expires_at, email_verified')
        .eq('email', email)
        .maybeSingle();

    if (error || !user) {
        return redirectWithError(request, 'رابط التفعيل غير صالح.');
    }

    if (user.email_verified) {
        // Already verified
        return redirectWithSuccess(request, 'حسابك مفعل مسبقاً. يمكنك تسجيل الدخول الآن.');
    }

    if (user.email_verification_token !== token) {
        return redirectWithError(request, 'رمز التفعيل غير صحيح للتأكيد.');
    }

    if (
        !user.email_verification_expires_at ||
        new Date(user.email_verification_expires_at).getTime() < Date.now()
    ) {
        return redirectWithError(request, 'انتهت صلاحية رابط التفعيل. يرجى طلب رابط جديد.');
    }

    // Token is valid and not expired, let's verify the user
    const { error: updateError } = await db
        .from('app_users')
        .update({
            email_verified: true,
            email_verification_token: null,
            email_verification_expires_at: null,
        })
        .eq('id', user.id);

    if (updateError) {
        logError('email_verification_failed', {
            userId: user.id,
            error: updateError.message,
        });
        return redirectWithError(request, 'حدث خطأ أثناء تفعيل الحساب.');
    }

    logInfo('email_verified_success', { userId: user.id });

    return redirectWithSuccess(request, 'تم تفعيل حسابك بنجاح. يمكنك تسجيل الدخول الآن.');
}

function redirectWithError(request: NextRequest, message: string) {
    const url = new URL('/signin', request.url);
    url.searchParams.set('error', encodeURIComponent(message));
    const nextParam = new URL(request.url).searchParams.get('next');
    if (nextParam) url.searchParams.set('next', encodeURIComponent(nextParam));
    return NextResponse.redirect(url, 302);
}

function redirectWithSuccess(request: NextRequest, message: string) {
    const url = new URL('/signin', request.url);
    url.searchParams.set('success', encodeURIComponent(message));
    const nextParam = new URL(request.url).searchParams.get('next');
    if (nextParam) url.searchParams.set('next', encodeURIComponent(nextParam));
    return NextResponse.redirect(url, 302);
}
