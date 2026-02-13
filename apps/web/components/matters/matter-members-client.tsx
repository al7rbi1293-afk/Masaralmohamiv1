'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, buttonVariants } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export type MatterMemberDisplay = {
  user_id: string;
  email: string | null;
  full_name: string;
  is_current_user: boolean;
};

export type OrgMemberOption = {
  user_id: string;
  label: string;
};

type MatterMembersClientProps = {
  matterId: string;
  canManage: boolean;
  members: MatterMemberDisplay[];
  orgOptions: OrgMemberOption[];
};

export function MatterMembersClient({ matterId, canManage, members, orgOptions }: MatterMembersClientProps) {
  const router = useRouter();
  const [selectedUserId, setSelectedUserId] = useState('');
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const options = useMemo(() => {
    const existing = new Set(members.map((m) => m.user_id));
    return orgOptions.filter((o) => !existing.has(o.user_id));
  }, [members, orgOptions]);

  async function addMember() {
    const userId = selectedUserId.trim();
    if (!userId) return;

    setBusy('add');
    setError('');
    setMessage('');

    try {
      const response = await fetch(`/app/api/matters/${encodeURIComponent(matterId)}/members/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId }),
      });
      const json = (await response.json().catch(() => ({}))) as any;
      if (!response.ok) {
        setError(String(json?.error ?? 'تعذر إضافة العضو.'));
        return;
      }

      setMessage('تمت إضافة العضو.');
      setSelectedUserId('');
      router.refresh();
    } catch {
      setError('تعذر إضافة العضو. حاول مرة أخرى.');
    } finally {
      setBusy('');
    }
  }

  async function removeMember(userId: string) {
    const confirmed = window.confirm('هل أنت متأكد من إزالة هذا العضو من القضية؟');
    if (!confirmed) return;

    setBusy(`remove:${userId}`);
    setError('');
    setMessage('');

    try {
      const response = await fetch(`/app/api/matters/${encodeURIComponent(matterId)}/members/remove`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId }),
      });
      const json = (await response.json().catch(() => ({}))) as any;
      if (!response.ok) {
        setError(String(json?.error ?? 'تعذر إزالة العضو.'));
        return;
      }

      setMessage('تمت إزالة العضو.');
      router.refresh();
    } catch {
      setError('تعذر إزالة العضو. حاول مرة أخرى.');
    } finally {
      setBusy('');
    }
  }

  return (
    <div className="space-y-3">
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

      {!members.length ? (
        <p className="text-sm text-slate-600 dark:text-slate-300">لا يوجد أعضاء مضافون بعد.</p>
      ) : (
        <ul className="space-y-2">
          {members.map((member) => {
            const label = member.full_name?.trim() || member.email || member.user_id;
            return (
              <li
                key={member.user_id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-brand-border p-3 text-sm dark:border-slate-700"
              >
                <div className="space-y-0.5">
                  <p className="font-medium text-brand-navy dark:text-slate-100">
                    {label}
                    {member.is_current_user ? (
                      <span className="ms-2 text-xs text-slate-500 dark:text-slate-400">(أنت)</span>
                    ) : null}
                  </p>
                  {member.email ? (
                    <p className="text-xs text-slate-500 dark:text-slate-400">{member.email}</p>
                  ) : null}
                </div>

                <div className="flex items-center gap-2">
                  <Badge variant="default">عضو</Badge>
                  {canManage ? (
                    <button
                      type="button"
                      className={buttonVariants('outline', 'sm')}
                      disabled={busy === `remove:${member.user_id}`}
                      onClick={() => removeMember(member.user_id)}
                    >
                      إزالة
                    </button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {canManage ? (
        <div className="rounded-lg border border-brand-border p-4 dark:border-slate-700">
          <h3 className="font-semibold text-brand-navy dark:text-slate-100">إضافة عضو</h3>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            اختر عضوًا من فريق المكتب ليصبح لديه صلاحية رؤية هذه القضية الخاصة.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <select
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              className="h-11 min-w-[220px] rounded-lg border border-brand-border bg-white px-3 text-sm outline-none ring-brand-emerald focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
            >
              <option value="">اختر عضوًا...</option>
              {options.map((opt) => (
                <option key={opt.user_id} value={opt.user_id}>
                  {opt.label}
                </option>
              ))}
            </select>
            <Button type="button" variant="primary" size="md" onClick={addMember} disabled={busy === 'add' || !selectedUserId}>
              {busy === 'add' ? 'جارٍ الإضافة...' : 'إضافة'}
            </Button>
          </div>
        </div>
      ) : (
        <p className="text-xs text-slate-500 dark:text-slate-400">
          لا تملك صلاحية تعديل أعضاء هذه القضية.
        </p>
      )}
    </div>
  );
}

