import { NextResponse } from 'next/server';
import { getActiveClientPortalAccess } from '@/lib/client-portal/access';
import { sendNewSignupAlertEmail } from '@/lib/email'; // We should probably create sendClientQuestionEmail

export async function POST(request: Request) {
  try {
    const access = await getActiveClientPortalAccess();
    if (!access) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { db, session } = access;
    const body = await request.json().catch(() => ({}));
    const { matter_id, message } = body;

    if (!matter_id || !message?.trim()) {
      return NextResponse.json({ error: 'القضية ونص السؤال مطلوبان.' }, { status: 400 });
    }

    // Verify matter belongs to client
    const { data: matter } = await db
      .from('matters')
      .select('id, title')
      .eq('org_id', session.orgId)
      .eq('client_id', session.clientId)
      .eq('id', matter_id)
      .maybeSingle();

    if (!matter) {
      return NextResponse.json({ error: 'القضية غير صالحة أو لا تملك صلاحية الوصول لها.' }, { status: 403 });
    }

    const { data: comm, error } = await db
      .from('matter_communications')
      .insert({
        org_id: session.orgId,
        matter_id: matter.id,
        client_id: session.clientId,
        sender: 'CLIENT',
        message: message.trim(),
      })
      .select()
      .single();

    if (error) {
      console.error('Failed to insert communication', error);
      return NextResponse.json({ error: 'حدث خطأ أثناء حفظ رسالتك. يرجى المحاولة لاحقاً.' }, { status: 500 });
    }

    // Send email to lawyer asynchronously
    void (async () => {
      try {
        const { getPublicSiteUrl } = await import('@/lib/env');
        const { sendClientQuestionEmail } = await import('@/lib/email');

        // Check if there is an assigned user
        const { data: matterDetails } = await db
          .from('matters')
          .select('id, assigned_user_id')
          .eq('id', matter.id)
          .single();

        let lawyerEmail = null;

        if (matterDetails?.assigned_user_id) {
          const { data: assignedUser } = await db
            .from('app_users')
            .select('email')
            .eq('id', matterDetails.assigned_user_id)
            .single();
          lawyerEmail = assignedUser?.email;
        }

        if (!lawyerEmail) {
          // Fallback to org owner
          const { data: owners } = await db
            .from('memberships')
            .select('user_id')
            .eq('org_id', session.orgId)
            .eq('role', 'owner')
            .limit(1)
            .single();

          if (owners?.user_id) {
            const { data: ownerUser } = await db
              .from('app_users')
              .select('email')
              .eq('id', owners.user_id)
              .single();
            lawyerEmail = ownerUser?.email;
          }
        }

        if (lawyerEmail) {
          await sendClientQuestionEmail({
            to: lawyerEmail,
            clientName: session.email || 'عميل',
            matterTitle: matter.title,
            question: message.trim(),
            platformUrl: `${getPublicSiteUrl()}/app/matters/${matter.id}?tab=communications`,
          });
        }
      } catch (err) {
        console.error('Failed to notify lawyer of client question:', err);
      }
    })();

    return NextResponse.json({ success: true, communication: comm });
  } catch (error) {
    console.error('Submit question error:', error);
    return NextResponse.json({ error: 'حدث خطأ أثنا معالجة طلبك.' }, { status: 500 });
  }
}
