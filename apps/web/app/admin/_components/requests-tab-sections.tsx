import type {
  FullVersionRequest,
  Lead,
  RequestDeleteKind,
  RequestsTabId,
  SubRequest,
} from './requests-tab-types';

type RequestsTabItem = {
  id: RequestsTabId;
  label: string;
  count: number;
};

type RequestsTabsProps = {
  tabs: RequestsTabItem[];
  activeTab: RequestsTabId;
  onChange: (nextTab: RequestsTabId) => void;
};

export function RequestsTabs({ tabs, activeTab, onChange }: RequestsTabsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
            activeTab === tab.id
              ? 'border-brand-green bg-brand-green text-white'
              : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800'
          }`}
        >
          {tab.label}
          <span className="ms-2 rounded-full bg-black/10 px-2 py-0.5 text-xs">{tab.count}</span>
        </button>
      ))}
    </div>
  );
}

type SubscriptionRequestsPanelProps = {
  requests: SubRequest[];
  actionId: string | null;
  actionKey: (id: string, kind: RequestDeleteKind) => string;
  statusBadge: (status: string) => string;
  statusLabel: (status: string) => string;
  planLabel: (planCode: string) => string;
  onAction: (id: string, requestKind: SubRequest['request_kind'], action: 'approve' | 'reject') => Promise<void>;
  onDelete: (id: string, kind: RequestDeleteKind) => Promise<void>;
};

export function SubscriptionRequestsPanel({
  requests,
  actionId,
  actionKey,
  statusBadge,
  statusLabel,
  planLabel,
  onAction,
  onDelete,
}: SubscriptionRequestsPanelProps) {
  if (!requests.length) {
    return <p className="text-sm text-slate-500">لا توجد طلبات اشتراك بعد.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead className="border-b border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-300">
          <tr>
            <th className="py-3 text-start font-medium">المكتب</th>
            <th className="py-3 text-start font-medium">مقدم الطلب</th>
            <th className="py-3 text-start font-medium">الخطة</th>
            <th className="py-3 text-start font-medium">المدة</th>
            <th className="py-3 text-start font-medium">المرجع</th>
            <th className="py-3 text-start font-medium">الحالة</th>
            <th className="py-3 text-start font-medium">التاريخ</th>
            <th className="py-3 text-start font-medium">إجراءات</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {requests.map((request) => (
            <tr key={request.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
              <td className="py-3 font-medium">{request.organizations?.name ?? '—'}</td>
              <td className="py-3">{request.requester_name ?? '—'}</td>
              <td className="py-3 font-medium text-brand-navy dark:text-brand-light">{planLabel(request.plan_requested)}</td>
              <td className="py-3">{request.duration_months} شهر</td>
              <td className="py-3">{request.payment_reference ?? '—'}</td>
              <td className="py-3">
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusBadge(request.status)}`}>
                  {statusLabel(request.status)}
                </span>
              </td>
              <td className="py-3">{new Date(request.requested_at).toLocaleDateString('ar-SA')}</td>
              <td className="py-3">
                <div className="flex flex-wrap items-center gap-2">
                  {request.status === 'pending' ? (
                    <>
                      <button
                        disabled={actionId === actionKey(request.id, request.request_kind)}
                        onClick={() => void onAction(request.id, request.request_kind, 'approve')}
                        className="rounded bg-emerald-600 px-3 py-1 text-xs text-white hover:bg-emerald-700 disabled:opacity-50"
                      >
                        قبول
                      </button>
                      <button
                        disabled={actionId === actionKey(request.id, request.request_kind)}
                        onClick={() => void onAction(request.id, request.request_kind, 'reject')}
                        className="rounded bg-red-600 px-3 py-1 text-xs text-white hover:bg-red-700 disabled:opacity-50"
                      >
                        رفض
                      </button>
                    </>
                  ) : (
                    <span className="text-xs text-slate-400">{request.notes ?? '—'}</span>
                  )}
                  <button
                    disabled={actionId === actionKey(request.id, request.request_kind)}
                    onClick={() => void onDelete(request.id, request.request_kind)}
                    className="rounded bg-red-700 px-3 py-1 text-xs text-white hover:bg-red-800 disabled:opacity-50"
                  >
                    حذف
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

type ActivationRequestsPanelProps = {
  requests: FullVersionRequest[];
  actionId: string | null;
  actionKey: (id: string, kind: RequestDeleteKind) => string;
  compactText: (value: string | null, max?: number) => string;
  onDelete: (id: string, kind: RequestDeleteKind) => Promise<void>;
};

export function ActivationRequestsPanel({
  requests,
  actionId,
  actionKey,
  compactText,
  onDelete,
}: ActivationRequestsPanelProps) {
  if (!requests.length) {
    return <p className="text-sm text-slate-500">لا توجد طلبات تفعيل/حذف بعد.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead className="border-b border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-300">
          <tr>
            <th className="py-3 text-start font-medium">الاسم</th>
            <th className="py-3 text-start font-medium">البريد</th>
            <th className="py-3 text-start font-medium">المكتب</th>
            <th className="py-3 text-start font-medium">النوع</th>
            <th className="py-3 text-start font-medium">المصدر</th>
            <th className="py-3 text-start font-medium">الرسالة</th>
            <th className="py-3 text-start font-medium">التاريخ</th>
            <th className="py-3 text-start font-medium">إجراءات</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {requests.map((request) => (
            <tr key={request.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
              <td className="py-3 font-medium">{request.full_name ?? '—'}</td>
              <td className="py-3">{request.email}</td>
              <td className="py-3">{request.firm_name ?? '—'}</td>
              <td className="py-3">{request.type === 'delete_request' ? 'طلب حذف' : 'طلب تفعيل'}</td>
              <td className="py-3">{request.source}</td>
              <td className="py-3">{compactText(request.message)}</td>
              <td className="py-3">{new Date(request.created_at).toLocaleDateString('ar-SA')}</td>
              <td className="py-3">
                <button
                  disabled={actionId === actionKey(request.id, 'full_version_request')}
                  onClick={() => void onDelete(request.id, 'full_version_request')}
                  className="rounded bg-red-700 px-3 py-1 text-xs text-white hover:bg-red-800 disabled:opacity-50"
                >
                  حذف
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

type LeadsPanelProps = {
  leads: Lead[];
  actionId: string | null;
  actionKey: (id: string, kind: RequestDeleteKind) => string;
  compactText: (value: string | null, max?: number) => string;
  onDelete: (id: string, kind: RequestDeleteKind) => Promise<void>;
};

export function LeadsPanel({
  leads,
  actionId,
  actionKey,
  compactText,
  onDelete,
}: LeadsPanelProps) {
  if (!leads.length) {
    return <p className="text-sm text-slate-500">لا توجد Leads بعد.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead className="border-b border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-300">
          <tr>
            <th className="py-3 text-start font-medium">الاسم</th>
            <th className="py-3 text-start font-medium">البريد</th>
            <th className="py-3 text-start font-medium">المكتب</th>
            <th className="py-3 text-start font-medium">الموضوع</th>
            <th className="py-3 text-start font-medium">الهاتف</th>
            <th className="py-3 text-start font-medium">الرسالة</th>
            <th className="py-3 text-start font-medium">التاريخ</th>
            <th className="py-3 text-start font-medium">إجراءات</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {leads.map((lead) => (
            <tr key={lead.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
              <td className="py-3 font-medium">{lead.full_name}</td>
              <td className="py-3">{lead.email}</td>
              <td className="py-3">{lead.firm_name ?? '—'}</td>
              <td className="py-3">{lead.topic ?? '—'}</td>
              <td className="py-3">{lead.phone ?? '—'}</td>
              <td className="py-3">{compactText(lead.message)}</td>
              <td className="py-3">{new Date(lead.created_at).toLocaleDateString('ar-SA')}</td>
              <td className="py-3">
                <button
                  disabled={actionId === actionKey(lead.id, 'lead')}
                  onClick={() => void onDelete(lead.id, 'lead')}
                  className="rounded bg-red-700 px-3 py-1 text-xs text-white hover:bg-red-800 disabled:opacity-50"
                >
                  حذف
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
