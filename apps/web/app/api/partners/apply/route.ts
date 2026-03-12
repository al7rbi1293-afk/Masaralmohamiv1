import { NextRequest, NextResponse } from 'next/server';
import { partnerApplicationSchema } from '@/lib/partners/validation';
import { createPartnerApplication } from '@/lib/partners/service';
import { checkRateLimit, getRequestIp, RATE_LIMIT_MESSAGE_AR } from '@/lib/rateLimit';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const ip = getRequestIp(request);
  const rate = await checkRateLimit({
    key: `partners_apply:${ip}`,
    limit: 5,
    windowMs: 10 * 60 * 1000,
  });

  if (!rate.allowed) {
    return NextResponse.json({ message: RATE_LIMIT_MESSAGE_AR }, { status: 429 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ message: 'تعذر قراءة البيانات المرسلة.' }, { status: 400 });
  }

  const parsed = partnerApplicationSchema.safeParse({
    full_name: (payload as any)?.full_name,
    whatsapp_number: (payload as any)?.whatsapp_number,
    email: (payload as any)?.email,
    city: (payload as any)?.city,
    marketing_experience: (payload as any)?.marketing_experience,
    audience_notes: (payload as any)?.audience_notes,
    accepted_terms: Boolean((payload as any)?.accepted_terms),
    website: String((payload as any)?.website || ''),
  });

  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    return NextResponse.json(
      {
        message: firstIssue?.message || 'تعذر التحقق من البيانات.',
        fieldErrors: parsed.error.flatten().fieldErrors,
      },
      { status: 400 },
    );
  }

  try {
    const application = await createPartnerApplication(parsed.data);

    return NextResponse.json(
      {
        success: true,
        message: 'تم استلام طلبك بنجاح. سنراجع الطلب ونتواصل معك قريبًا.',
        id: application.id,
      },
      { status: 201 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : 'تعذر إرسال الطلب حالياً. حاول لاحقًا.',
      },
      { status: 500 },
    );
  }
}
