import { Activity, Building, Calendar, CreditCard, Shield, Sparkles, TimerReset, Trash2, Users } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { ActionCard, InfoCard } from './orgs-tab-ui';
import { formatArabicDate, getPlanLabel, getRoleLabel } from './orgs-tab-utils';
import type { ConfirmActionState, Org } from './orgs-tab-types';

type OrgDetailsPanelProps = {
  org: Org;
  actionId: string | null;
  isExpired: (org: Org) => boolean;
  onRequestConfirmation: (org: Org, action: ConfirmActionState['action']) => void;
  onOpenActivationDialog: (org: Org) => void;
  onOpenTrialDialog: (org: Org) => void;
};

export function OrgDetailsPanel({
  org,
  actionId,
  isExpired,
  onRequestConfirmation,
  onOpenActivationDialog,
  onOpenTrialDialog,
}: OrgDetailsPanelProps) {
  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-900/50">
        <div className="flex items-center gap-4 border-b border-slate-200 pb-4 dark:border-slate-800">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-emerald/10 text-brand-emerald dark:bg-emerald-500/20 dark:text-emerald-400">
            <Building className="h-6 w-6" />
          </div>
          <div>
            <h4 className="text-lg font-bold text-brand-navy dark:text-slate-100">{org.name}</h4>
            <div className="mt-1 flex items-center gap-2 text-sm text-slate-500">
              <Users className="h-3.5 w-3.5" />
              <span>عدد المستخدمين: {org.members_count}</span>
            </div>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="mb-1 flex items-center gap-1 text-slate-500 dark:text-slate-400">
              <Calendar className="h-3.5 w-3.5" /> تاريخ الإنشاء
            </p>
            <p className="font-medium text-slate-900 dark:text-slate-100">{formatArabicDate(org.created_at)}</p>
          </div>
          <div>
            <p className="mb-1 flex items-center gap-1 text-slate-500 dark:text-slate-400">
              <Activity className="h-3.5 w-3.5" /> حالة المكتب
            </p>
            <div className="flex flex-col items-start gap-1">
              <span
                className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                  org.status === 'suspended'
                    ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                    : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                }`}
              >
                {org.status === 'suspended' ? 'معلّق' : 'نشط'}
              </span>
              {isExpired(org) && org.status !== 'suspended' && (
                <span className="inline-flex rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700 dark:bg-red-900/40 dark:text-red-300">
                  منتهي الصلاحية
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div>
        <h4 className="mb-3 flex items-center gap-2 text-base font-semibold text-brand-navy dark:text-slate-100">
          <Users className="h-4 w-4 text-brand-emerald" />
          الحسابات المرتبطة
        </h4>
        {org.linked_accounts.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-400">
            لا يوجد أي حساب مرتبط بهذا المكتب.
          </div>
        ) : (
          <div className="space-y-2">
            {org.linked_accounts.map((account) => (
              <div
                key={account.membership_id}
                className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900/40"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium text-slate-900 dark:text-slate-100">{account.full_name || 'بدون اسم'}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400" dir="ltr">
                      {account.email || '—'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {account.is_app_admin && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                        إدارة
                      </span>
                    )}
                    <span className="rounded-full bg-brand-emerald/10 px-2 py-0.5 text-xs font-medium text-brand-emerald dark:bg-emerald-500/20 dark:text-emerald-300">
                      {getRoleLabel(account.role)}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        account.status === 'suspended'
                          ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                          : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                      }`}
                    >
                      {account.status === 'suspended' ? 'معلّق' : 'نشط'}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <h4 className="mb-3 flex items-center gap-2 text-base font-semibold text-brand-navy dark:text-slate-100">
          <CreditCard className="h-4 w-4 text-brand-emerald" />
          معلومات الاشتراك
        </h4>
        <div className="space-y-3">
          <InfoCard label="الخطة الحالية" value={getPlanLabel(org.subscription?.plan)} />
          <InfoCard label="حالة الاشتراك" value={org.subscription?.status ?? 'تجريبي'} />
          <InfoCard
            label="تاريخ الانتهاء"
            value={
              org.subscription?.current_period_end
                ? formatArabicDate(org.subscription.current_period_end)
                : org.trial?.ends_at
                  ? formatArabicDate(org.trial.ends_at)
                  : '—'
            }
          />
        </div>
      </div>

      <div>
        <h4 className="mb-3 flex items-center gap-2 text-base font-semibold text-brand-navy dark:text-slate-100">
          <Shield className="h-4 w-4 text-brand-emerald" />
          خيارات الإجراءات
        </h4>
        <div className="grid gap-3">
          <ActionCard
            icon={<Shield className="h-4 w-4" />}
            title={org.status === 'suspended' ? 'إلغاء تعليق المكتب' : 'تعليق المكتب'}
            description={
              org.status === 'suspended' ? 'إعادة تفعيل المكتب والسماح له بالعودة للنظام.' : 'إيقاف المكتب مؤقتًا بدون حذف بياناته.'
            }
            tone={org.status === 'suspended' ? 'emerald' : 'amber'}
            disabled={actionId === org.id}
            onClick={() => onRequestConfirmation(org, org.status === 'suspended' ? 'activate' : 'suspend')}
          />
          <ActionCard
            icon={<Sparkles className="h-4 w-4" />}
            title="تفعيل اشتراك"
            description="اختر الباقة والمدة: شهر، سنة، أو مدة مخصصة بالشهور أو السنوات."
            tone="emerald"
            disabled={actionId === org.id}
            onClick={() => onOpenActivationDialog(org)}
          />
          <ActionCard
            icon={<TimerReset className="h-4 w-4" />}
            title="تمديد الفترة التجريبية"
            description="مدد التجربة لعدد الأيام الذي تحدده بدل التمديد الثابت 14 يوم."
            tone="slate"
            disabled={actionId === org.id}
            onClick={() => onOpenTrialDialog(org)}
          />
          <ActionCard
            icon={<Trash2 className="h-4 w-4" />}
            title="حذف نهائي"
            description="حذف المكتب نهائيًا مع بياناته. استخدمه فقط عند الضرورة."
            tone="red"
            disabled={actionId === org.id}
            onClick={() => onRequestConfirmation(org, 'delete')}
          />
        </div>

        {org.has_admin_account && (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/30 dark:bg-amber-950/20">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">خيار خاص بحساب الإدارة</p>
                <p className="mt-1 text-sm leading-6 text-amber-800 dark:text-amber-300">
                  اشتراك مدى الحياة مخفي عن بقية المكاتب، ولا يظهر إلا للمكتب المرتبط بحساب إدارة فعلي.
                </p>
              </div>
              <button
                type="button"
                className={`${buttonVariants('outline', 'sm')} border-amber-300 text-amber-900 hover:bg-amber-100 dark:border-amber-700 dark:text-amber-200 dark:hover:bg-amber-900/30`}
                onClick={() => onRequestConfirmation(org, 'grant_lifetime')}
                disabled={actionId === org.id}
              >
                مدى الحياة
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
