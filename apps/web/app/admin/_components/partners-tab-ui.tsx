import {
  APPLICATION_STATUS_OPTIONS,
  COMMISSION_STATUS_OPTIONS,
  PAYOUT_STATUS_OPTIONS,
  type PartnersView,
} from './partners-tab-types';

type PartnersTabsProps = {
  view: PartnersView;
  onChange: (view: PartnersView) => void;
};

const tabs: Array<{ id: PartnersView; label: string }> = [
  { id: 'applications', label: 'Applications' },
  { id: 'partners', label: 'Partners' },
  { id: 'commissions', label: 'Commissions' },
  { id: 'payouts', label: 'Payouts' },
  { id: 'audit', label: 'Audit Logs' },
];

export function PartnersTabs({ view, onChange }: PartnersTabsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
            view === tab.id
              ? 'border-brand-green bg-brand-green text-white'
              : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

type PartnersFiltersProps = {
  view: PartnersView;
  query: string;
  applicationStatus: (typeof APPLICATION_STATUS_OPTIONS)[number];
  commissionStatus: (typeof COMMISSION_STATUS_OPTIONS)[number];
  payoutStatus: (typeof PAYOUT_STATUS_OPTIONS)[number];
  partnerActive: 'all' | 'active' | 'inactive';
  onQueryChange: (value: string) => void;
  onApplicationStatusChange: (value: (typeof APPLICATION_STATUS_OPTIONS)[number]) => void;
  onCommissionStatusChange: (value: (typeof COMMISSION_STATUS_OPTIONS)[number]) => void;
  onPayoutStatusChange: (value: (typeof PAYOUT_STATUS_OPTIONS)[number]) => void;
  onPartnerActiveChange: (value: 'all' | 'active' | 'inactive') => void;
};

export function PartnersFilters({
  view,
  query,
  applicationStatus,
  commissionStatus,
  payoutStatus,
  partnerActive,
  onQueryChange,
  onApplicationStatusChange,
  onCommissionStatusChange,
  onPayoutStatusChange,
  onPartnerActiveChange,
}: PartnersFiltersProps) {
  return (
    <>
      {view === 'applications' || view === 'partners' || view === 'commissions' ? (
        <div className="grid gap-3 md:grid-cols-[1fr_auto_auto]">
          <input
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            className="h-10 rounded-lg border border-brand-border px-3 text-sm dark:border-slate-700 dark:bg-slate-900"
            placeholder="بحث بالاسم / البريد / الجوال / كود الشريك"
          />

          {view === 'applications' ? (
            <select
              value={applicationStatus}
              onChange={(event) => onApplicationStatusChange(event.target.value as (typeof APPLICATION_STATUS_OPTIONS)[number])}
              className="h-10 rounded-lg border border-brand-border px-3 text-sm dark:border-slate-700 dark:bg-slate-900"
            >
              {APPLICATION_STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          ) : null}

          {view === 'partners' ? (
            <select
              value={partnerActive}
              onChange={(event) => onPartnerActiveChange(event.target.value as 'all' | 'active' | 'inactive')}
              className="h-10 rounded-lg border border-brand-border px-3 text-sm dark:border-slate-700 dark:bg-slate-900"
            >
              <option value="all">all</option>
              <option value="active">active</option>
              <option value="inactive">inactive</option>
            </select>
          ) : null}

          {view === 'commissions' ? (
            <select
              value={commissionStatus}
              onChange={(event) => onCommissionStatusChange(event.target.value as (typeof COMMISSION_STATUS_OPTIONS)[number])}
              className="h-10 rounded-lg border border-brand-border px-3 text-sm dark:border-slate-700 dark:bg-slate-900"
            >
              {COMMISSION_STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          ) : null}
        </div>
      ) : null}

      {view === 'payouts' ? (
        <div className="flex justify-end">
          <select
            value={payoutStatus}
            onChange={(event) => onPayoutStatusChange(event.target.value as (typeof PAYOUT_STATUS_OPTIONS)[number])}
            className="h-10 rounded-lg border border-brand-border px-3 text-sm dark:border-slate-700 dark:bg-slate-900"
          >
            {PAYOUT_STATUS_OPTIONS.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </div>
      ) : null}
    </>
  );
}

export { ApplicationsPanel } from './partners-tab-applications-panel';
export { PartnersPanel } from './partners-tab-partners-panel';
export { CommissionsPanel, PayoutsPanel } from './partners-tab-finance-panels';
export { AuditPanel } from './partners-tab-audit-panel';
