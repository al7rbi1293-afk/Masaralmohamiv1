import type { CommissionRow, PayoutRow } from './partners-tab-types';

type CommissionsPanelProps = {
  commissions: CommissionRow[];
  actionBusy: string | null;
  onAction: (id: string, action: 'approve' | 'mark_payable' | 'mark_paid' | 'reverse') => void;
};

export function CommissionsPanel({ commissions, actionBusy, onAction }: CommissionsPanelProps) {
  return (
    <div className="overflow-x-auto rounded-xl border border-brand-border bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
      <table className="min-w-full text-sm">
        <thead className="border-b border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-300">
          <tr>
            <th className="py-3 text-start font-medium">الشريك</th>
            <th className="py-3 text-start font-medium">payment_id</th>
            <th className="py-3 text-start font-medium">base</th>
            <th className="py-3 text-start font-medium">partner amount</th>
            <th className="py-3 text-start font-medium">marketing amount</th>
            <th className="py-3 text-start font-medium">status</th>
            <th className="py-3 text-start font-medium">إجراءات</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {commissions.map((commission) => (
            <tr key={commission.id}>
              <td className="py-3">
                {commission.partner?.full_name || '—'}
                <div className="text-xs text-slate-500">{commission.partner?.partner_code || '—'}</div>
              </td>
              <td className="py-3">
                <code>{commission.payment_id}</code>
              </td>
              <td className="py-3">
                {Number(commission.base_amount).toFixed(2)} {commission.currency}
              </td>
              <td className="py-3">
                {Number(commission.partner_amount).toFixed(2)} {commission.currency}
              </td>
              <td className="py-3">
                {Number(commission.marketing_amount).toFixed(2)} {commission.currency}
              </td>
              <td className="py-3">{commission.status}</td>
              <td className="py-3">
                <div className="flex flex-wrap gap-2">
                  <button
                    disabled={actionBusy === commission.id}
                    onClick={() => onAction(commission.id, 'approve')}
                    className="rounded bg-emerald-600 px-2 py-1 text-xs text-white disabled:opacity-50"
                  >
                    approve
                  </button>
                  <button
                    disabled={actionBusy === commission.id}
                    onClick={() => onAction(commission.id, 'mark_payable')}
                    className="rounded bg-indigo-600 px-2 py-1 text-xs text-white disabled:opacity-50"
                  >
                    payable
                  </button>
                  <button
                    disabled={actionBusy === commission.id}
                    onClick={() => onAction(commission.id, 'mark_paid')}
                    className="rounded bg-slate-700 px-2 py-1 text-xs text-white disabled:opacity-50"
                  >
                    paid
                  </button>
                  <button
                    disabled={actionBusy === commission.id}
                    onClick={() => onAction(commission.id, 'reverse')}
                    className="rounded bg-red-600 px-2 py-1 text-xs text-white disabled:opacity-50"
                  >
                    reverse
                  </button>
                </div>
              </td>
            </tr>
          ))}
          {commissions.length === 0 ? (
            <tr>
              <td className="py-4 text-center text-slate-500" colSpan={7}>
                لا توجد عمولات.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

type PayoutsPanelProps = {
  payouts: PayoutRow[];
  actionBusy: string | null;
  onAction: (id: string, action: 'mark_processing' | 'mark_paid' | 'mark_failed' | 'cancel') => void;
};

export function PayoutsPanel({ payouts, actionBusy, onAction }: PayoutsPanelProps) {
  return (
    <div className="overflow-x-auto rounded-xl border border-brand-border bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
      <table className="min-w-full text-sm">
        <thead className="border-b border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-300">
          <tr>
            <th className="py-3 text-start font-medium">الشريك</th>
            <th className="py-3 text-start font-medium">الفترة</th>
            <th className="py-3 text-start font-medium">المبلغ</th>
            <th className="py-3 text-start font-medium">الحالة</th>
            <th className="py-3 text-start font-medium">المرجع</th>
            <th className="py-3 text-start font-medium">إجراءات</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {payouts.map((payout) => (
            <tr key={payout.id}>
              <td className="py-3">
                {payout.partner_name}
                <div className="text-xs text-slate-500">مستحق حالي: {Number(payout.pending_amount_for_partner).toFixed(2)} SAR</div>
              </td>
              <td className="py-3">
                {payout.period_start} → {payout.period_end}
              </td>
              <td className="py-3">{Number(payout.total_amount).toFixed(2)} SAR</td>
              <td className="py-3">{payout.status}</td>
              <td className="py-3">{payout.reference_number || '—'}</td>
              <td className="py-3">
                <div className="flex flex-wrap gap-2">
                  <button
                    disabled={actionBusy === payout.id}
                    onClick={() => onAction(payout.id, 'mark_processing')}
                    className="rounded bg-indigo-600 px-2 py-1 text-xs text-white disabled:opacity-50"
                  >
                    processing
                  </button>
                  <button
                    disabled={actionBusy === payout.id}
                    onClick={() => onAction(payout.id, 'mark_paid')}
                    className="rounded bg-emerald-600 px-2 py-1 text-xs text-white disabled:opacity-50"
                  >
                    paid
                  </button>
                  <button
                    disabled={actionBusy === payout.id}
                    onClick={() => onAction(payout.id, 'mark_failed')}
                    className="rounded bg-red-600 px-2 py-1 text-xs text-white disabled:opacity-50"
                  >
                    failed
                  </button>
                </div>
              </td>
            </tr>
          ))}
          {payouts.length === 0 ? (
            <tr>
              <td className="py-4 text-center text-slate-500" colSpan={6}>
                لا توجد دفعات مسجلة حالياً.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
