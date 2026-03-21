import { NextRequest, NextResponse } from 'next/server';
import { requirePartnerAppContext } from '@/lib/mobile/auth';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const auth = await requirePartnerAppContext(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { db, user, partner } = auth.context;
  const partnerId = partner?.id;
  if (!partnerId) {
    return NextResponse.json({ error: 'تعذر العثور على حساب الشريك.' }, { status: 404 });
  }

  const [{ data: appUser }, clicksRes, leadsRes, commissionsRes, payoutsRes] = await Promise.all([
    db
      .from('app_users')
      .select('full_name, email, phone')
      .eq('id', user.id)
      .maybeSingle(),
    db.from('partner_clicks').select('id').eq('partner_id', partnerId),
    db.from('partner_leads').select('id, status').eq('partner_id', partnerId),
    db.from('partner_commissions').select('partner_amount, status, currency').eq('partner_id', partnerId),
    db
      .from('partner_payouts')
      .select('id, total_amount, status, reference_number, created_at')
      .eq('partner_id', partnerId)
      .order('created_at', { ascending: false })
      .limit(20),
  ]);

  const leads = leadsRes.data ?? [];
  const commissions = commissionsRes.data ?? [];
  const totalCommission = commissions
    .filter((commission: any) => commission.status !== 'reversed')
    .reduce((sum: number, commission: any) => sum + Number(commission.partner_amount || 0), 0);

  return NextResponse.json({
    user: {
      id: user.id,
      full_name: String((appUser as any)?.full_name || partner.full_name || '').trim() || null,
      email: String((appUser as any)?.email || partner.email || '').trim() || null,
      phone: String((appUser as any)?.phone || partner.whatsapp_number || '').trim() || null,
    },
    partner: {
      id: partner.id,
      partner_code: partner.partner_code,
      referral_link: partner.referral_link,
    },
    kpis: {
      clicks: (clicksRes.data || []).length,
      leads: leads.length,
      subscribed_leads: leads.filter((lead: any) => lead.status === 'subscribed').length,
      total_commission: Number(totalCommission.toFixed(2)),
      commission_currency: String((commissions[0] as any)?.currency || 'SAR'),
    },
    payouts: (payoutsRes.data || []).map((payout: any) => ({
      id: String(payout.id),
      total_amount: Number(Number(payout.total_amount || 0).toFixed(2)),
      status: String(payout.status || ''),
      reference_number: payout.reference_number ? String(payout.reference_number) : null,
      created_at: String(payout.created_at || ''),
    })),
  });
}
