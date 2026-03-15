'use server';

import { revalidatePath } from 'next/cache';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getCurrentAuthUser } from '@/lib/supabase/auth-session';
// We will add the email sending logic later
// import { sendLawyerReplyEmail } from '@/lib/email';

export async function sendLawyerReplyAction(matterId: string, message: string, clientId: string, pathname: string) {
  const user = await getCurrentAuthUser();
  if (!user) {
    return { success: false, error: 'غير مصرح.' };
  }

  if (!message?.trim() || !matterId || !clientId) {
    return { success: false, error: 'جميع الحقول مطلوبة.' };
  }

  const db = createSupabaseServerClient();

  // Validate matter and get org_id
  const { data: matter, error: matterError } = await db
    .from('matters')
    .select('org_id')
    .eq('id', matterId)
    .maybeSingle();

  if (matterError || !matter) {
    return { success: false, error: 'تعذر العثور على القضية.' };
  }

  const { error: insertError } = await db.from('matter_communications').insert({
    org_id: matter.org_id,
    matter_id: matterId,
    client_id: clientId,
    user_id: user.id,
    sender: 'LAWYER',
    message: message.trim(),
  });

  if (insertError) {
    console.error('Failed to insert lawyer reply:', insertError);
    return { success: false, error: 'حدث خطأ أثناء إضافة الرد.' };
  }

  // Fetch client email and matter title
  void (async () => {
    try {
      const { getPublicSiteUrl } = await import('@/lib/env');
      const { sendLawyerReplyEmail } = await import('@/lib/email');

      const { data: matterDetails } = await db
        .from('matters')
        .select('title')
        .eq('id', matterId)
        .single();

      const { data: client } = await db
        .from('clients')
        .select('email')
        .eq('id', clientId)
        .single();

      if (client?.email && matterDetails?.title) {
        await sendLawyerReplyEmail({
          to: client.email,
          matterTitle: matterDetails.title,
          reply: message.trim(),
          portalUrl: `${getPublicSiteUrl()}/client-portal?tab=matters&matter=${matterId}`,
        });
      }
    } catch (err) {
      console.error('Failed to notify client of lawyer reply:', err);
    }
  })();

  revalidatePath(pathname);
  return { success: true };
}

export async function getMatterCommunicationsAction(matterId: string) {
  const db = createSupabaseServerClient();
  const { data, error } = await db
    .from('matter_communications')
    .select('*, user:app_users(full_name)')
    .eq('matter_id', matterId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Failed to fetch communications:', error);
    return [];
  }

  return data;
}
