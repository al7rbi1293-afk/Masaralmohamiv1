import type { AuditRow } from './partners-tab-types';

type AuditPanelProps = {
  logs: AuditRow[];
};

export function AuditPanel({ logs }: AuditPanelProps) {
  return (
    <div className="overflow-x-auto rounded-xl border border-brand-border bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
      <table className="min-w-full text-sm">
        <thead className="border-b border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-300">
          <tr>
            <th className="py-3 text-start font-medium">action</th>
            <th className="py-3 text-start font-medium">target</th>
            <th className="py-3 text-start font-medium">details</th>
            <th className="py-3 text-start font-medium">created_at</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {logs.map((log) => (
            <tr key={log.id}>
              <td className="py-3 font-medium">{log.action}</td>
              <td className="py-3">{log.target_type}</td>
              <td className="py-3 text-xs text-slate-500">{JSON.stringify(log.details).slice(0, 140)}</td>
              <td className="py-3">{new Date(log.created_at).toLocaleString('ar-SA')}</td>
            </tr>
          ))}
          {logs.length === 0 ? (
            <tr>
              <td className="py-4 text-center text-slate-500" colSpan={4}>
                لا توجد سجلات.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
