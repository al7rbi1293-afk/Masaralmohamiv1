import { NextRequest, NextResponse } from 'next/server';
import { requireClientPortalContext } from '@/lib/mobile/client-portal';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const auth = await requireClientPortalContext(request);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { db, session } = auth.context;
    const body = await request.json().catch(() => ({}));
    const matterId = String(body.matter_id ?? '').trim();
    const message = String(body.message ?? '').trim();

    if (!matterId || !message) {
      return NextResponse.json({ error: 'القضية ونص السؤال مطلوبان.' }, { status: 400 });
    }

    const { data: matter } = await db
      .from('matters')
      .select('id, title')
      .eq('org_id', session.orgId)
      .eq('client_id', session.clientId)
      .eq('id', matterId)
      .maybeSingle();

    if (!matter) {
      return NextResponse.json({ error: 'القضية غير صالحة أو لا تملك صلاحية الوصول لها.' }, { status: 403 });
    }

    const { data: communication, error } = await db
      .from('matter_communications')
      .insert({
        org_id: session.orgId,
        matter_id: matter.id,
        client_id: session.clientId,
        sender: 'CLIENT',
        message,
      })
      .select('id, sender, message, created_at')
      .single();

    if (error || !communication) {
      return NextResponse.json({ error: 'حدث خطأ أثناء حفظ رسالتك. يرجى المحاولة لاحقاً.' }, { status: 500 });
    }

    void (async () => {
      try {
        const { getPublicSiteUrl } = await import('@/lib/env');
        const { sendClientQuestionEmail } = await import('@/lib/email');

        const { data: matterDetails } = await db
          .from('matters')
          .select('id, assigned_user_id')
          .eq('id', matter.id)
          .single();

        let lawyerEmail: string | null = null;

        if (matterDetails?.assigned_user_id) {
          const { data: assignedUser } = await db
            .from('app_users')
            .select('email')
            .eq('id', matterDetails.assigned_user_id)
            .single();
          lawyerEmail = assignedUser?.email ? String(assignedUser.email) : null;
        }

        if (!lawyerEmail) {
          const { data: ownerMembership } = await db
            .from('memberships')
            .select('user_id')
            .eq('org_id', session.orgId)
            .eq('role', 'owner')
            .limit(1)
            .single();

          if (ownerMembership?.user_id) {
            const { data: ownerUser } = await db
              .from('app_users')
              .select('email')
              .eq('id', ownerMembership.user_id)
              .single();
            lawyerEmail = ownerUser?.email ? String(ownerUser.email) : null;
          }
        }

        if (lawyerEmail) {
          await sendClientQuestionEmail({
            to: lawyerEmail,
            clientName: session.email || 'عميل',
            matterTitle: String((matter as { title?: string | null }).title ?? 'قضية'),
            question: message,
            platformUrl: `${getPublicSiteUrl()}/app/matters/${matter.id}?tab=communications`,
          });
        }
      } catch {
        // Best-effort notification for office staff.
      }
    })();

    return NextResponse.json({
      success: true,
      communication: {
        id: String(communication.id),
        sender: String(communication.sender ?? 'CLIENT'),
        message: String(communication.message ?? message),
        created_at: String(communication.created_at ?? new Date().toISOString()),
      },
    });
  } catch {
    return NextResponse.json({ error: 'حدث خطأ أثناء معالجة طلبك.' }, { status: 500 });
  }
}
