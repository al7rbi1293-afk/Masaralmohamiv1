import { NextRequest, NextResponse } from 'next/server';
import { referralCaptureSchema } from '@/lib/partners/validation';
import { captureReferralClick, setReferralCookies } from '@/lib/partners/referral';
import { REFERRAL_COOKIE_SESSION_ID } from '@/lib/partners/constants';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  let payload: unknown = {};
  try {
    payload = await request.json();
  } catch {
    // noop
  }

  const parsed = referralCaptureSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: 'تعذر التحقق من بيانات الإحالة.' }, { status: 400 });
  }

  const referralCode = parsed.data.ref;
  const sessionFromCookie = request.cookies.get(REFERRAL_COOKIE_SESSION_ID)?.value;

  const result = await captureReferralClick({
    request,
    referralCode,
    sessionId: parsed.data.session_id || sessionFromCookie,
    landingPage: parsed.data.landing_page,
    utmSource: parsed.data.utm_source,
    utmMedium: parsed.data.utm_medium,
    utmCampaign: parsed.data.utm_campaign,
  });

  const response = NextResponse.json(
    {
      success: result.captured,
      result,
    },
    { status: 200 },
  );

  if (result.captured && result.partnerId && result.partnerCode && result.clickId) {
    setReferralCookies(response, {
      code: result.partnerCode,
      partnerId: result.partnerId,
      sessionId: result.sessionId,
      clickId: result.clickId,
    });
  }

  return response;
}
