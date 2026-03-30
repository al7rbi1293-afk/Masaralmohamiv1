import type { PartnerApplication } from './partners-tab-types';

type ApplicationsPanelProps = {
  applications: PartnerApplication[];
  actionBusy: string | null;
  onAction: (id: string, action: 'approve' | 'reject' | 'needs_review' | 'delete') => void;
};

export function ApplicationsPanel({ applications, actionBusy, onAction }: ApplicationsPanelProps) {
  return (
    <div className="overflow-x-auto rounded-xl border border-brand-border bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
      <table className="min-w-full text-sm">
        <thead className="border-b border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-300">
          <tr>
            <th className="py-3 text-start font-medium">الاسم</th>
            <th className="py-3 text-start font-medium">البريد</th>
            <th className="py-3 text-start font-medium">الواتساب</th>
            <th className="py-3 text-start font-medium">المدينة</th>
            <th className="py-3 text-start font-medium">الخبرة التسويقية</th>
            <th className="py-3 text-start font-medium">القنوات / الجمهور</th>
            <th className="py-3 text-start font-medium">الحالة</th>
            <th className="py-3 text-start font-medium">التاريخ</th>
            <th className="py-3 text-start font-medium">إجراءات</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {applications.map((application) => (
            <tr key={application.id} className="align-top">
              <td className="py-3 font-medium">{application.full_name}</td>
              <td className="py-3">{application.email}</td>
              <td className="py-3">{application.whatsapp_number}</td>
              <td className="py-3">{application.city}</td>
              <td className="py-3">
                <div className="max-w-xs whitespace-pre-wrap break-words text-slate-700 dark:text-slate-200">
                  {application.marketing_experience}
                </div>
              </td>
              <td className="py-3">
                <div className="max-w-xs whitespace-pre-wrap break-words text-slate-600 dark:text-slate-300">
                  {application.audience_notes?.trim() || '—'}
                </div>
              </td>
              <td className="py-3">{application.status}</td>
              <td className="py-3">{new Date(application.created_at).toLocaleString('ar-SA')}</td>
              <td className="py-3">
                <div className="flex flex-wrap gap-2">
                  <button
                    disabled={actionBusy === application.id}
                    onClick={() => onAction(application.id, 'approve')}
                    className="rounded bg-emerald-600 px-2 py-1 text-xs text-white disabled:opacity-50"
                  >
                    approve
                  </button>
                  <button
                    disabled={actionBusy === application.id}
                    onClick={() => onAction(application.id, 'needs_review')}
                    className="rounded bg-amber-600 px-2 py-1 text-xs text-white disabled:opacity-50"
                  >
                    needs_review
                  </button>
                  <button
                    disabled={actionBusy === application.id}
                    onClick={() => onAction(application.id, 'reject')}
                    className="rounded bg-red-600 px-2 py-1 text-xs text-white disabled:opacity-50"
                  >
                    reject
                  </button>
                  <button
                    disabled={actionBusy === application.id}
                    onClick={() => onAction(application.id, 'delete')}
                    className="rounded bg-red-700 px-2 py-1 text-xs text-white disabled:opacity-50"
                  >
                    حذف
                  </button>
                </div>
              </td>
            </tr>
          ))}
          {applications.length === 0 ? (
            <tr>
              <td className="py-4 text-center text-slate-500" colSpan={9}>
                لا توجد طلبات حالياً.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
