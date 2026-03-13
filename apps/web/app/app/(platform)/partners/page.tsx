import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { buttonVariants } from '@/components/ui/button';
import { getCurrentAuthUser } from '@/lib/supabase/auth-session';
import { createSupabaseServerClient } from '@/lib/supabase/server';

type PartnerPortalPageProps = {
  searchParams?: {
    activated?: string;
  };
};

export default async function PartnerPortalPage({ searchParams }: PartnerPortalPageProps) {
  const user = await getCurrentAuthUser();
  if (!user) {
    return (
      <Card className="p-6">
        <p className="text-sm text-slate-700 dark:text-slate-200">يرجى تسجيل الدخول أولاً.</p>
      </Card>
    );
  }

  const db = createSupabaseServerClient();
  const { data: partner } = await db
    .from('partners')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!partner) {
    return (
      <Card className="space-y-4 p-6">
        <h1 className="text-xl font-bold text-brand-navy dark:text-slate-100">بوابة الشريك</h1>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          لم يتم العثور على حساب شريك نجاح مرتبط بهذا البريد حتى الآن.
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          إذا تمت الموافقة على طلبك مؤخرًا، استخدم رابط التفعيل الذي وصلك عبر البريد الإلكتروني أو تواصل معنا لإعادة إرساله.
        </p>
        <Link href="/success-partners" className={buttonVariants('outline', 'sm')}>
          تقديم طلب شريك نجاح
        </Link>
      </Card>
    );
  }

  const [clicksRes, leadsRes, commissionsRes, payoutsRes] = await Promise.all([
    db.from('partner_clicks').select('id').eq('partner_id', partner.id),
    db.from('partner_leads').select('id, status').eq('partner_id', partner.id),
    db.from('partner_commissions').select('partner_amount, status, currency').eq('partner_id', partner.id),
    db.from('partner_payouts').select('id, total_amount, status, reference_number, created_at').eq('partner_id', partner.id).order('created_at', { ascending: false }).limit(20),
  ]);

  const clicksCount = (clicksRes.data || []).length;
  const leads = leadsRes.data || [];
  const leadsCount = leads.length;
  const subscribedCount = leads.filter((lead: any) => lead.status === 'subscribed').length;
  const commissions = commissionsRes.data || [];
  const totalCommission = commissions
    .filter((commission: any) => commission.status !== 'reversed')
    .reduce((sum: number, commission: any) => sum + Number(commission.partner_amount || 0), 0);

  return (
    <Card className="space-y-6 p-6">
      <div>
        <h1 className="text-xl font-bold text-brand-navy dark:text-slate-100">بوابة الشريك</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">ملخص الأداء الحالي لشريك النجاح.</p>
      </div>

      {searchParams?.activated === '1' ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-200">
          تم إعداد حساب الشريك بنجاح، ويمكنك الآن استخدام بوابتك ورابط الإحالة مباشرة.
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="الزيارات" value={clicksCount} />
        <StatCard label="العملاء المحتملون" value={leadsCount} />
        <StatCard label="المشتركون" value={subscribedCount} />
        <StatCard label="إجمالي العمولات" value={`${totalCommission.toFixed(2)} SAR`} />
      </div>

      <div className="rounded-lg border border-brand-border p-4 dark:border-slate-700">
        <h2 className="text-base font-semibold text-brand-navy dark:text-slate-100">بياناتك</h2>
        <p className="mt-2 text-sm text-slate-700 dark:text-slate-300">{partner.full_name}</p>
        <p className="text-sm text-slate-500 dark:text-slate-400">الكود: <code>{partner.partner_code}</code></p>
        <p className="text-sm text-slate-500 dark:text-slate-400">الرابط: <a href={partner.referral_link} className="text-brand-emerald underline" target="_blank" rel="noreferrer">{partner.referral_link}</a></p>
      </div>

      <div className="rounded-lg border border-brand-border p-4 dark:border-slate-700">
        <h2 className="text-base font-semibold text-brand-navy dark:text-slate-100">سجل الدفعات</h2>
        {(payoutsRes.data || []).length === 0 ? (
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">لا توجد دفعات بعد.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="border-b border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-300">
                <tr>
                  <th className="py-2 text-start font-medium">المبلغ</th>
                  <th className="py-2 text-start font-medium">الحالة</th>
                  <th className="py-2 text-start font-medium">المرجع</th>
                  <th className="py-2 text-start font-medium">التاريخ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {(payoutsRes.data || []).map((payout: any) => (
                  <tr key={payout.id}>
                    <td className="py-2">{Number(payout.total_amount).toFixed(2)} SAR</td>
                    <td className="py-2">{payout.status}</td>
                    <td className="py-2">{payout.reference_number || '—'}</td>
                    <td className="py-2">{new Date(payout.created_at).toLocaleDateString('ar-SA')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Card>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-brand-border p-4 dark:border-slate-700">
      <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-1 text-lg font-bold text-brand-navy dark:text-slate-100">{value}</p>
    </div>
  );
}
