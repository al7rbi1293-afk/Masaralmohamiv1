import 'server-only';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { buildPartnerReferralLink } from '@/lib/partners/link';
import { generatePartnerCode, partnerSlugFromCode } from '@/lib/partners/code';
import { emptyToNull, nowIso, normalizePartnerCode } from '@/lib/partners/utils';
import {
  sendPartnerApplicationNotification,
  sendPartnerApprovalNotification,
} from '@/lib/partners/mail-provider';
import { ensurePartnerPortalAccess } from '@/lib/partners/access';
import type {
  PartnerApplicationStatus,
  PartnerCommissionStatus,
  PartnerPayoutStatus,
  PartnerSummaryStats,
} from '@/lib/partners/types';
import { getPublicSiteUrl } from '@/lib/env';

type CreatePartnerApplicationInput = {
  full_name: string;
  whatsapp_number: string;
  email: string;
  city: string;
  marketing_experience: string;
  audience_notes?: string;
};

export async function createPartnerApplication(input: CreatePartnerApplicationInput) {
  const db = createSupabaseServerClient();

  const { data, error } = await db
    .from('partner_applications')
    .insert({
      full_name: input.full_name,
      whatsapp_number: input.whatsapp_number,
      email: input.email.toLowerCase(),
      city: input.city,
      marketing_experience: input.marketing_experience,
      audience_notes: emptyToNull(input.audience_notes),
      status: 'pending',
    })
    .select('*')
    .single();

  if (error || !data) {
    throw new Error(error?.message || 'تعذر حفظ طلب الشريك.');
  }

  const siteUrl = getPublicSiteUrl();
  const adminUrl = `${siteUrl}/admin`;

  await sendPartnerApplicationNotification({
    applicationId: data.id,
    fullName: data.full_name,
    whatsappNumber: data.whatsapp_number,
    email: data.email,
    city: data.city,
    submittedAt: data.created_at,
    adminUrl,
  });

  return data;
}

export async function listPartnerApplications(params?: {
  status?: PartnerApplicationStatus | 'all';
  query?: string;
  limit?: number;
}) {
  const db = createSupabaseServerClient();
  const limit = Math.min(Math.max(params?.limit ?? 200, 1), 500);

  let q = db
    .from('partner_applications')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (params?.status && params.status !== 'all') {
    q = q.eq('status', params.status);
  }

  if (params?.query) {
    const escaped = params.query.trim();
    q = q.or(`full_name.ilike.%${escaped}%,email.ilike.%${escaped}%,whatsapp_number.ilike.%${escaped}%`);
  }

  const { data, error } = await q;
  if (error) throw new Error(error.message);

  return data ?? [];
}

async function createUniquePartnerIdentity(maxAttempts = 12) {
  const db = createSupabaseServerClient();

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const partnerCode = generatePartnerCode();
    const partnerSlug = partnerSlugFromCode(partnerCode);
    const referralLink = buildPartnerReferralLink(partnerCode);

    const { data: existing, error } = await db
      .from('partners')
      .select('id')
      .eq('partner_code', partnerCode)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    if (!existing) {
      return { partnerCode, partnerSlug, referralLink };
    }
  }

  throw new Error('تعذر توليد كود شريك فريد بعد عدة محاولات.');
}

export async function addPartnerAuditLog(params: {
  actorUserId: string | null;
  action: string;
  targetType: string;
  targetId?: string | null;
  details?: Record<string, unknown>;
}) {
  const db = createSupabaseServerClient();
  await db.from('partner_audit_logs').insert({
    actor_user_id: params.actorUserId,
    action: params.action,
    target_type: params.targetType,
    target_id: params.targetId || null,
    details: params.details ?? {},
  });
}

export async function reviewPartnerApplication(params: {
  applicationId: string;
  action: 'approve' | 'reject' | 'needs_review' | 'delete';
  adminUserId: string;
  adminNotes?: string;
}) {
  const db = createSupabaseServerClient();

  const { data: application, error: applicationError } = await db
    .from('partner_applications')
    .select('*')
    .eq('id', params.applicationId)
    .maybeSingle();

  if (applicationError) {
    throw new Error(applicationError.message);
  }
  if (!application) {
    throw new Error('طلب الشريك غير موجود.');
  }

  const now = nowIso();

  if (params.action === 'delete') {
    const { error: deleteError } = await db
      .from('partner_applications')
      .delete()
      .eq('id', params.applicationId);

    if (deleteError) {
      throw new Error(deleteError.message);
    }

    await addPartnerAuditLog({
      actorUserId: params.adminUserId,
      action: 'partner_application_deleted',
      targetType: 'partner_application',
      targetId: params.applicationId,
      details: {
        full_name: application.full_name,
        email: application.email,
        status: application.status,
      },
    });

    return { applicationId: params.applicationId, status: 'deleted', partner: null };
  }

  if (params.action === 'approve') {
    const { data: existingPartner, error: existingPartnerError } = await db
      .from('partners')
      .select('*')
      .eq('application_id', params.applicationId)
      .maybeSingle();

    if (existingPartnerError) {
      throw new Error(existingPartnerError.message);
    }

    let partner = existingPartner;

    if (!partner) {
      const uniqueIdentity = await createUniquePartnerIdentity();
      const { data: insertedPartner, error: partnerInsertError } = await db
        .from('partners')
        .insert({
          application_id: params.applicationId,
          full_name: application.full_name,
          whatsapp_number: application.whatsapp_number,
          email: application.email,
          partner_code: uniqueIdentity.partnerCode,
          partner_slug: uniqueIdentity.partnerSlug,
          referral_link: uniqueIdentity.referralLink,
          commission_rate_partner: 5,
          commission_rate_marketing: 5,
          is_active: true,
          approved_by: params.adminUserId,
          approved_at: now,
        })
        .select('*')
        .single();

      if (partnerInsertError || !insertedPartner) {
        throw new Error(partnerInsertError?.message || 'تعذر إنشاء سجل الشريك.');
      }

      partner = insertedPartner;
    }

    const portalAccess = await ensurePartnerPortalAccess({
      partnerId: String(partner.id),
      email: String(partner.email || application.email || ''),
      fullName: String(partner.full_name || application.full_name || ''),
      phone: String(partner.whatsapp_number || application.whatsapp_number || '').trim() || null,
    });

    const { error: updateError } = await db
      .from('partner_applications')
      .update({
        status: 'approved',
        admin_notes: emptyToNull(params.adminNotes),
        reviewed_by: params.adminUserId,
        reviewed_at: now,
      })
      .eq('id', params.applicationId);

    if (updateError) {
      throw new Error(updateError.message);
    }

    await addPartnerAuditLog({
      actorUserId: params.adminUserId,
      action: 'partner_application_approved',
      targetType: 'partner_application',
      targetId: params.applicationId,
      details: {
        partner_id: partner.id,
        partner_code: partner.partner_code,
      },
    });

    try {
      await sendPartnerApprovalNotification({
        fullName: String(partner.full_name || application.full_name || ''),
        email: String(partner.email || application.email || ''),
        partnerCode: String(partner.partner_code || ''),
        referralLink: String(partner.referral_link || ''),
        accessMode: portalAccess.accessMode,
        activationUrl: portalAccess.activationUrl,
        signInUrl: portalAccess.signInUrl,
        partnerPortalUrl: portalAccess.partnerPortalUrl,
      });
    } catch (error) {
      console.error('Failed to send partner approval email:', error);
    }

    return { applicationId: params.applicationId, status: 'approved', partner };
  }

  const mappedStatus: PartnerApplicationStatus = params.action === 'reject' ? 'rejected' : 'needs_review';

  const { error: updateError } = await db
    .from('partner_applications')
    .update({
      status: mappedStatus,
      admin_notes: emptyToNull(params.adminNotes),
      reviewed_by: params.adminUserId,
      reviewed_at: now,
    })
    .eq('id', params.applicationId);

  if (updateError) {
    throw new Error(updateError.message);
  }

  await addPartnerAuditLog({
    actorUserId: params.adminUserId,
    action: mappedStatus === 'rejected' ? 'partner_application_rejected' : 'partner_application_needs_review',
    targetType: 'partner_application',
    targetId: params.applicationId,
    details: {
      admin_notes: emptyToNull(params.adminNotes),
    },
  });

  return { applicationId: params.applicationId, status: mappedStatus, partner: null };
}

async function collectPartnerStats(partnerIds: string[]): Promise<Map<string, PartnerSummaryStats>> {
  const db = createSupabaseServerClient();
  const stats = new Map<string, PartnerSummaryStats>();

  for (const partnerId of partnerIds) {
    stats.set(partnerId, {
      clicksCount: 0,
      signupsCount: 0,
      subscribedCount: 0,
      totalCommissionAmount: 0,
    });
  }

  if (!partnerIds.length) {
    return stats;
  }

  const [clicksRes, leadsRes, commissionsRes] = await Promise.all([
    db.from('partner_clicks').select('partner_id').in('partner_id', partnerIds),
    db.from('partner_leads').select('partner_id, status').in('partner_id', partnerIds),
    db
      .from('partner_commissions')
      .select('partner_id, partner_amount, status')
      .in('partner_id', partnerIds),
  ]);

  if (clicksRes.error) throw new Error(clicksRes.error.message);
  if (leadsRes.error) throw new Error(leadsRes.error.message);
  if (commissionsRes.error) throw new Error(commissionsRes.error.message);

  for (const row of clicksRes.data ?? []) {
    const partnerId = String((row as any).partner_id);
    const current = stats.get(partnerId);
    if (!current) continue;
    current.clicksCount += 1;
  }

  for (const row of leadsRes.data ?? []) {
    const partnerId = String((row as any).partner_id);
    const current = stats.get(partnerId);
    if (!current) continue;

    const status = String((row as any).status);
    if (status === 'signed_up' || status === 'trial_started' || status === 'subscribed') {
      current.signupsCount += 1;
    }
    if (status === 'subscribed') {
      current.subscribedCount += 1;
    }
  }

  for (const row of commissionsRes.data ?? []) {
    const partnerId = String((row as any).partner_id);
    const current = stats.get(partnerId);
    if (!current) continue;

    const status = String((row as any).status);
    if (status !== 'reversed') {
      current.totalCommissionAmount += Number((row as any).partner_amount || 0);
    }
  }

  return stats;
}

export async function listPartners(params?: {
  query?: string;
  active?: 'all' | 'active' | 'inactive';
  limit?: number;
}) {
  const db = createSupabaseServerClient();
  const limit = Math.min(Math.max(params?.limit ?? 200, 1), 500);

  let q = db
    .from('partners')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (params?.active === 'active') {
    q = q.eq('is_active', true);
  } else if (params?.active === 'inactive') {
    q = q.eq('is_active', false);
  }

  if (params?.query) {
    const escaped = params.query.trim();
    q = q.or(`full_name.ilike.%${escaped}%,email.ilike.%${escaped}%,whatsapp_number.ilike.%${escaped}%,partner_code.ilike.%${escaped}%`);
  }

  const { data, error } = await q;
  if (error) throw new Error(error.message);

  const partners = data ?? [];
  const partnerIds = partners.map((item: any) => String(item.id));
  const statsMap = await collectPartnerStats(partnerIds);

  return partners.map((partner: any) => ({
    ...partner,
    stats: statsMap.get(String(partner.id)) ?? {
      clicksCount: 0,
      signupsCount: 0,
      subscribedCount: 0,
      totalCommissionAmount: 0,
    },
  }));
}

export async function updatePartner(params: {
  partnerId: string;
  action: 'regenerate_code' | 'deactivate' | 'reactivate' | 'delete';
  adminUserId: string;
}) {
  const db = createSupabaseServerClient();

  const { data: existing, error: existingError } = await db
    .from('partners')
    .select('*')
    .eq('id', params.partnerId)
    .maybeSingle();

  if (existingError) throw new Error(existingError.message);
  if (!existing) throw new Error('الشريك غير موجود.');

  if (params.action === 'delete') {
    // 1. Delete all related records first (manual cascade)
    await Promise.all([
      db.from('partner_clicks').delete().eq('partner_id', params.partnerId),
      db.from('partner_leads').delete().eq('partner_id', params.partnerId),
      db.from('partner_commissions').delete().eq('partner_id', params.partnerId),
      db.from('partner_payouts').delete().eq('partner_id', params.partnerId),
    ]);

    // 2. Delete the partner record
    const { error: deleteError } = await db
      .from('partners')
      .delete()
      .eq('id', params.partnerId);

    if (deleteError) {
      throw new Error(deleteError.message || 'تعذر حذف سجل الشريك.');
    }

    // 3. Log the action
    await addPartnerAuditLog({
      actorUserId: params.adminUserId,
      action: 'partner_deleted',
      targetType: 'partner',
      targetId: params.partnerId,
      details: {
        email: existing.email,
        full_name: existing.full_name,
        partner_code: existing.partner_code,
      },
    });

    return existing; // Return the snapshot of what was deleted
  }

  if (params.action === 'regenerate_code') {
    const uniqueIdentity = await createUniquePartnerIdentity();

    const { data: updated, error: updateError } = await db
      .from('partners')
      .update({
        partner_code: uniqueIdentity.partnerCode,
        partner_slug: uniqueIdentity.partnerSlug,
        referral_link: uniqueIdentity.referralLink,
        updated_at: nowIso(),
      })
      .eq('id', params.partnerId)
      .select('*')
      .single();

    if (updateError || !updated) {
      throw new Error(updateError?.message || 'تعذر تحديث كود الشريك.');
    }

    await addPartnerAuditLog({
      actorUserId: params.adminUserId,
      action: 'partner_code_regenerated',
      targetType: 'partner',
      targetId: params.partnerId,
      details: {
        old_code: existing.partner_code,
        new_code: updated.partner_code,
      },
    });

    return updated;
  }

  const isActive = params.action === 'reactivate';

  const { data: updated, error: updateError } = await db
    .from('partners')
    .update({
      is_active: isActive,
      updated_at: nowIso(),
    })
    .eq('id', params.partnerId)
    .select('*')
    .single();

  if (updateError || !updated) {
    throw new Error(updateError?.message || 'تعذر تحديث حالة الشريك.');
  }

  await addPartnerAuditLog({
    actorUserId: params.adminUserId,
    action: isActive ? 'partner_reactivated' : 'partner_deactivated',
    targetType: 'partner',
    targetId: params.partnerId,
  });

  return updated;
}

export async function listPartnerCommissions(params?: {
  status?: PartnerCommissionStatus | 'all';
  query?: string;
  limit?: number;
}) {
  const db = createSupabaseServerClient();
  const limit = Math.min(Math.max(params?.limit ?? 300, 1), 500);

  let q = db
    .from('partner_commissions')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (params?.status && params.status !== 'all') {
    q = q.eq('status', params.status);
  }

  const { data, error } = await q;
  if (error) throw new Error(error.message);

  const commissions = data ?? [];
  const partnerIds = Array.from(new Set(commissions.map((item: any) => String(item.partner_id))));

  let partnersById = new Map<string, { id: string; full_name: string; partner_code: string; email: string }>();

  if (partnerIds.length) {
    const { data: partnerRows, error: partnerError } = await db
      .from('partners')
      .select('id, full_name, partner_code, email')
      .in('id', partnerIds);

    if (partnerError) throw new Error(partnerError.message);

    for (const row of partnerRows ?? []) {
      partnersById.set(String((row as any).id), {
        id: String((row as any).id),
        full_name: String((row as any).full_name || ''),
        partner_code: String((row as any).partner_code || ''),
        email: String((row as any).email || ''),
      });
    }
  }

  const filtered = params?.query
    ? commissions.filter((item: any) => {
        const partner = partnersById.get(String(item.partner_id));
        const haystack = `${partner?.full_name || ''} ${partner?.partner_code || ''} ${partner?.email || ''} ${String(item.payment_id || '')}`.toLowerCase();
        return haystack.includes(params.query!.toLowerCase());
      })
    : commissions;

  return filtered.map((item: any) => ({
    ...item,
    partner: partnersById.get(String(item.partner_id)) ?? null,
  }));
}

export async function updatePartnerCommission(params: {
  commissionId: string;
  action: 'approve' | 'mark_payable' | 'mark_paid' | 'reverse';
  adminUserId: string;
  notes?: string;
}) {
  const db = createSupabaseServerClient();

  const { data: commission, error: commissionError } = await db
    .from('partner_commissions')
    .select('*')
    .eq('id', params.commissionId)
    .maybeSingle();

  if (commissionError) throw new Error(commissionError.message);
  if (!commission) throw new Error('العمولة غير موجودة.');

  let nextStatus: PartnerCommissionStatus = commission.status;
  if (params.action === 'approve') nextStatus = 'approved';
  if (params.action === 'mark_payable') nextStatus = 'payable';
  if (params.action === 'mark_paid') nextStatus = 'paid';
  if (params.action === 'reverse') nextStatus = 'reversed';

  const updatePayload: Record<string, unknown> = {
    status: nextStatus,
    updated_at: nowIso(),
  };

  if (params.action === 'mark_paid') {
    updatePayload.paid_at = nowIso();
  }

  if (params.notes) {
    updatePayload.notes = params.notes;
  }

  const { data: updated, error: updateError } = await db
    .from('partner_commissions')
    .update(updatePayload)
    .eq('id', params.commissionId)
    .select('*')
    .single();

  if (updateError || !updated) {
    throw new Error(updateError?.message || 'تعذر تحديث العمولة.');
  }

  await addPartnerAuditLog({
    actorUserId: params.adminUserId,
    action: `commission_${params.action}`,
    targetType: 'partner_commission',
    targetId: params.commissionId,
    details: {
      previous_status: commission.status,
      new_status: nextStatus,
      notes: emptyToNull(params.notes),
    },
  });

  return updated;
}

export async function listPartnerPayouts(params?: {
  status?: PartnerPayoutStatus | 'all';
  limit?: number;
}) {
  const db = createSupabaseServerClient();
  const limit = Math.min(Math.max(params?.limit ?? 300, 1), 500);

  let q = db
    .from('partner_payouts')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (params?.status && params.status !== 'all') {
    q = q.eq('status', params.status);
  }

  const { data: payouts, error } = await q;
  if (error) throw new Error(error.message);

  const rows = payouts ?? [];
  const partnerIds = Array.from(new Set(rows.map((item: any) => String(item.partner_id))));

  const partnerNameMap = new Map<string, string>();
  if (partnerIds.length) {
    const { data: partners, error: partnersError } = await db
      .from('partners')
      .select('id, full_name')
      .in('id', partnerIds);

    if (partnersError) throw new Error(partnersError.message);

    for (const item of partners ?? []) {
      partnerNameMap.set(String((item as any).id), String((item as any).full_name || ''));
    }
  }

  const { data: payableCommissions, error: payableError } = await db
    .from('partner_commissions')
    .select('partner_id, partner_amount, status')
    .in('status', ['approved', 'payable']);

  if (payableError) throw new Error(payableError.message);

  const pendingByPartner = new Map<string, number>();
  for (const row of payableCommissions ?? []) {
    const partnerId = String((row as any).partner_id);
    const amount = Number((row as any).partner_amount || 0);
    pendingByPartner.set(partnerId, (pendingByPartner.get(partnerId) || 0) + amount);
  }

  return rows.map((row: any) => ({
    ...row,
    partner_name: partnerNameMap.get(String(row.partner_id)) ?? '—',
    pending_amount_for_partner: pendingByPartner.get(String(row.partner_id)) || 0,
  }));
}

export async function updatePartnerPayout(params: {
  payoutId: string;
  action: 'mark_processing' | 'mark_paid' | 'mark_failed' | 'cancel';
  adminUserId: string;
  referenceNumber?: string;
  notes?: string;
}) {
  const db = createSupabaseServerClient();

  const nextStatusMap: Record<typeof params.action, PartnerPayoutStatus> = {
    mark_processing: 'processing',
    mark_paid: 'paid',
    mark_failed: 'failed',
    cancel: 'cancelled',
  };

  const nextStatus = nextStatusMap[params.action];

  const payload: Record<string, unknown> = {
    status: nextStatus,
    updated_at: nowIso(),
  };

  if (params.referenceNumber) {
    payload.reference_number = params.referenceNumber;
  }

  if (params.notes) {
    payload.notes = params.notes;
  }

  const { data: updated, error } = await db
    .from('partner_payouts')
    .update(payload)
    .eq('id', params.payoutId)
    .select('*')
    .single();

  if (error || !updated) {
    throw new Error(error?.message || 'تعذر تحديث حالة الصرف.');
  }

  await addPartnerAuditLog({
    actorUserId: params.adminUserId,
    action: `payout_${params.action}`,
    targetType: 'partner_payout',
    targetId: params.payoutId,
    details: {
      reference_number: emptyToNull(params.referenceNumber),
      notes: emptyToNull(params.notes),
      status: nextStatus,
    },
  });

  return updated;
}

export async function listPartnerAuditLogs(limit = 500) {
  const db = createSupabaseServerClient();
  const safeLimit = Math.min(Math.max(limit, 1), 1000);

  const { data, error } = await db
    .from('partner_audit_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(safeLimit);

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function findPartnerByCode(partnerCode: string) {
  const db = createSupabaseServerClient();
  const normalizedCode = normalizePartnerCode(partnerCode);
  if (!normalizedCode) {
    return null;
  }

  const { data, error } = await db
    .from('partners')
    .select('*')
    .eq('partner_code', normalizedCode)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data;
}
