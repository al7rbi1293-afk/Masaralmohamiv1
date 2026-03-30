import type { PartnerRow } from './partners-tab-types';

type PartnersPanelProps = {
  partners: PartnerRow[];
  actionBusy: string | null;
  onAction: (id: string, action: 'regenerate_code' | 'deactivate' | 'reactivate' | 'delete') => void;
};

export function PartnersPanel({ partners, actionBusy, onAction }: PartnersPanelProps) {
  return (
    <div className="overflow-x-auto rounded-xl border border-brand-border bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
      <table className="min-w-full text-sm">
        <thead className="border-b border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-300">
          <tr>
            <th className="py-3 text-start font-medium">الاسم</th>
            <th className="py-3 text-start font-medium">البريد</th>
            <th className="py-3 text-start font-medium">الواتساب</th>
            <th className="py-3 text-start font-medium">الكود</th>
            <th className="py-3 text-start font-medium">الرابط</th>
            <th className="py-3 text-start font-medium">الإحصائيات</th>
            <th className="py-3 text-start font-medium">إجراءات</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {partners.map((partner) => (
            <tr key={partner.id}>
              <td className="py-3 font-medium">{partner.full_name}</td>
              <td className="py-3">{partner.email}</td>
              <td className="py-3">{partner.whatsapp_number}</td>
              <td className="py-3">
                <code>{partner.partner_code}</code>
              </td>
              <td className="py-3 text-xs">
                <a className="text-brand-emerald underline" href={partner.referral_link} target="_blank" rel="noreferrer">
                  فتح الرابط
                </a>
              </td>
              <td className="py-3 text-xs text-slate-600 dark:text-slate-300">
                زيارات: {partner.stats.clicksCount}
                <br />
                تسجيلات: {partner.stats.signupsCount}
                <br />
                اشتراكات: {partner.stats.subscribedCount}
                <br />
                عمولات: {partner.stats.totalCommissionAmount.toFixed(2)} SAR
              </td>
              <td className="py-3">
                <div className="flex flex-wrap gap-2">
                  <button
                    disabled={actionBusy === partner.id}
                    onClick={() => onAction(partner.id, 'regenerate_code')}
                    className="rounded bg-slate-700 px-2 py-1 text-xs text-white disabled:opacity-50"
                  >
                    regenerate code
                  </button>
                  {partner.is_active ? (
                    <button
                      disabled={actionBusy === partner.id}
                      onClick={() => onAction(partner.id, 'deactivate')}
                      className="rounded bg-red-600 px-2 py-1 text-xs text-white disabled:opacity-50"
                    >
                      deactivate
                    </button>
                  ) : (
                    <button
                      disabled={actionBusy === partner.id}
                      onClick={() => onAction(partner.id, 'reactivate')}
                      className="rounded bg-emerald-600 px-2 py-1 text-xs text-white disabled:opacity-50"
                    >
                      reactivate
                    </button>
                  )}
                  <button
                    disabled={actionBusy === partner.id}
                    onClick={() => onAction(partner.id, 'delete')}
                    className="rounded bg-red-700 px-2 py-1 text-xs text-white disabled:opacity-50"
                  >
                    حذف
                  </button>
                </div>
              </td>
            </tr>
          ))}
          {partners.length === 0 ? (
            <tr>
              <td className="py-4 text-center text-slate-500" colSpan={7}>
                لا يوجد شركاء معتمدون.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
