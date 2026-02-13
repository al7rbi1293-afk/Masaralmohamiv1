'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';

type Role = 'owner' | 'lawyer' | 'assistant';

export type MatterMemberItem = {
  user_id: string;
  full_name: string;
  email: string | null;
  role: Role;
};

export type OrgMemberOption = MatterMemberItem;

type MatterMembersClientProps = {
  matterId: string;
  currentUserId: string;
  canManage: boolean;
  orgMembers: OrgMemberOption[];
};

const roleLabel: Record<Role, string> = {
  owner: 'شريك',
  lawyer: 'محامٍ',
  assistant: 'مساعد',
};

const roleVariant: Record<Role, 'default' | 'success' | 'warning' | 'danger'> = {
  owner: 'warning',
  lawyer: 'default',
  assistant: 'default',
};

export function MatterMembersClient({
  matterId,
  currentUserId,
  canManage,
  orgMembers,
}: MatterMembersClientProps) {
  const router = useRouter();
  const [members, setMembers] = useState<MatterMemberItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [busy, setBusy] = useState(false);
  const [busyRemoveId, setBusyRemoveId] = useState('');

  async function loadMembers() {
    setLoading(true);
    setError('');

    try {
      const response = await fetch(`/app/api/matters/${encodeURIComponent(matterId)}/members`, {
        method: 'GET',
      });
      const json = (await response.json().catch(() => ({}))) as any;
      if (!response.ok) {
        setError(String(json?.error ?? 'تعذر تحميل الأعضاء. حاول مرة أخرى.'));
        return;
      }

      setMembers(Array.isArray(json?.members) ? (json.members as MatterMemberItem[]) : []);
    } catch {
      setError('تعذر تحميل الأعضاء. حاول مرة أخرى.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadMembers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matterId]);

  const memberIds = useMemo(() => {
    return new Set(members.map((m) => m.user_id));
  }, [members]);

  const selectableMembers = useMemo(() => {
    return orgMembers.filter((m) => !memberIds.has(m.user_id));
  }, [orgMembers, memberIds]);

  const lastMember = members.length <= 1;

  async function addMember() {
    if (!selectedUserId) {
      setError('يرجى اختيار عضو.');
      return;
    }

    setBusy(true);
    setError('');
    setMessage('');

    try {
      const response = await fetch(`/app/api/matters/${encodeURIComponent(matterId)}/members/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: selectedUserId }),
      });
      const json = (await response.json().catch(() => ({}))) as any;
      if (!response.ok) {
        setError(String(json?.error ?? 'تعذر تنفيذ العملية.'));
        return;
      }

      setMessage('تمت إضافة العضو.');
      setSelectedUserId('');
      setModalOpen(false);
      await loadMembers();
      router.refresh();
    } catch {
      setError('تعذر تنفيذ العملية.');
    } finally {
      setBusy(false);
    }
  }

  async function removeMember(userId: string) {
    const confirmed = window.confirm('هل أنت متأكد من إزالة هذا العضو من القضية؟');
    if (!confirmed) return;

    setBusyRemoveId(userId);
    setError('');
    setMessage('');

    try {
      const response = await fetch(
        `/app/api/matters/${encodeURIComponent(matterId)}/members/remove`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: userId }),
        },
      );
      const json = (await response.json().catch(() => ({}))) as any;
      if (!response.ok) {
        setError(String(json?.error ?? 'تعذر تنفيذ العملية.'));
        return;
      }

      setMessage('تمت إزالة العضو.');
      await loadMembers();
      router.refresh();
    } catch {
      setError('تعذر تنفيذ العملية.');
    } finally {
      setBusyRemoveId('');
    }
  }

  return (
    <div className="mt-4 space-y-4">
      {message ? (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-200">
          {message}
        </p>
      ) : null}

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-600 dark:text-slate-300">
          القضية الخاصة لا تظهر إلا للشريك (Owner) والأعضاء المصرّح لهم.
        </p>
        {canManage ? (
          <Button type="button" variant="primary" size="sm" onClick={() => setModalOpen(true)}>
            إضافة عضو
          </Button>
        ) : null}
      </div>

      {loading ? (
        <p className="text-sm text-slate-600 dark:text-slate-300">جارٍ تحميل الأعضاء...</p>
      ) : !members.length ? (
        <p className="text-sm text-slate-600 dark:text-slate-300">لا يوجد أعضاء حتى الآن.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-brand-border dark:border-slate-700">
          <table className="min-w-full text-sm">
            <thead className="border-b border-brand-border text-slate-600 dark:border-slate-700 dark:text-slate-300">
              <tr>
                <th className="px-3 py-3 text-start font-medium">العضو</th>
                <th className="px-3 py-3 text-start font-medium">البريد</th>
                <th className="px-3 py-3 text-start font-medium">الدور</th>
                {canManage ? <th className="px-3 py-3 text-start font-medium">إجراءات</th> : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-border dark:divide-slate-800">
              {members.map((member) => {
                const displayName =
                  member.full_name?.trim() || member.email || member.user_id;
                const isMe = member.user_id === currentUserId;
                const disableRemove = lastMember || busyRemoveId === member.user_id;
                const disableReason = lastMember
                  ? 'لا يمكن إزالة آخر عضو من القضية الخاصة.'
                  : '';

                return (
                  <tr
                    key={member.user_id}
                    className="hover:bg-brand-background/60 dark:hover:bg-slate-800/60"
                  >
                    <td className="px-3 py-3 font-medium text-brand-navy dark:text-slate-100">
                      {displayName}
                      {isMe ? (
                        <span className="ms-2 text-xs text-slate-500 dark:text-slate-400">
                          (أنت)
                        </span>
                      ) : null}
                    </td>
                    <td className="px-3 py-3 text-slate-700 dark:text-slate-200">
                      {member.email ?? '—'}
                    </td>
                    <td className="px-3 py-3">
                      <Badge variant={roleVariant[member.role]}>
                        {roleLabel[member.role]}
                      </Badge>
                    </td>
                    {canManage ? (
                      <td className="px-3 py-3">
                        <button
                          type="button"
                          className={buttonVariants('outline', 'sm')}
                          disabled={disableRemove}
                          title={disableReason}
                          onClick={() => removeMember(member.user_id)}
                        >
                          إزالة
                        </button>
                      </td>
                    ) : null}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {modalOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setModalOpen(false)}
        >
          <div
            className="w-full max-w-xl rounded-xl border border-brand-border bg-white p-5 shadow-panel dark:border-slate-700 dark:bg-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold text-brand-navy dark:text-slate-100">
                  إضافة عضو للقضية
                </h3>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                  اختر عضوًا من فريق المكتب لإضافته إلى القضية الخاصة.
                </p>
              </div>
              <button
                type="button"
                className={buttonVariants('ghost', 'sm')}
                onClick={() => setModalOpen(false)}
              >
                إغلاق
              </button>
            </div>

            <div className="mt-4 grid gap-4">
              <label className="block space-y-1 text-sm">
                <span className="font-medium text-slate-700 dark:text-slate-200">
                  العضو <span className="text-red-600">*</span>
                </span>
                <select
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  className="h-11 w-full rounded-lg border border-brand-border bg-white px-3 outline-none ring-brand-emerald focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
                >
                  <option value="">اختر عضوًا</option>
                  {selectableMembers.map((member) => {
                    const label =
                      member.full_name?.trim() || member.email || member.user_id;
                    return (
                      <option key={member.user_id} value={member.user_id}>
                        {label}
                      </option>
                    );
                  })}
                </select>
                {!selectableMembers.length ? (
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    لا توجد أعضاء إضافية لإضافتها.
                  </p>
                ) : null}
              </label>

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="primary"
                  size="md"
                  onClick={addMember}
                  disabled={busy || !selectableMembers.length}
                >
                  {busy ? 'جارٍ إضافة العضو...' : 'إضافة'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="md"
                  onClick={() => setModalOpen(false)}
                  disabled={busy}
                >
                  إلغاء
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

