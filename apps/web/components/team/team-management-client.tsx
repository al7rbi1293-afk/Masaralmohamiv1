'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button, buttonVariants } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export type TeamMemberItem = {
  user_id: string;
  email: string | null;
  full_name: string;
  role: 'owner' | 'lawyer' | 'assistant';
  created_at: string;
  is_current_user: boolean;
};

export type TeamInvitationItem = {
  id: string;
  email: string;
  role: 'owner' | 'lawyer' | 'assistant';
  token: string;
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
};

type TeamManagementClientProps = {
  publicSiteUrl: string;
  currentUserId: string;
  members: TeamMemberItem[];
  invitations: TeamInvitationItem[];
};

const roleLabel: Record<TeamMemberItem['role'], string> = {
  owner: 'مالك',
  lawyer: 'محامٍ',
  assistant: 'مساعد',
};

export function TeamManagementClient({
  publicSiteUrl,
  currentUserId,
  members,
  invitations,
}: TeamManagementClientProps) {
  const router = useRouter();
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<TeamMemberItem['role']>('lawyer');
  const [inviteExpiry, setInviteExpiry] = useState<'24h' | '7d'>('7d');
  const [inviteBusy, setInviteBusy] = useState(false);
  const [inviteLink, setInviteLink] = useState('');

  const [busyKey, setBusyKey] = useState('');

  const membersSorted = useMemo(() => {
    return [...members].sort((a, b) => a.created_at.localeCompare(b.created_at));
  }, [members]);

  useEffect(() => {
    if (!inviteOpen) {
      setInviteEmail('');
      setInviteRole('lawyer');
      setInviteExpiry('7d');
      setInviteBusy(false);
      setInviteLink('');
    }
  }, [inviteOpen]);

  async function createInvite() {
    setInviteBusy(true);
    setError('');
    setMessage('');

    const email = inviteEmail.trim().toLowerCase();
    if (!email) {
      setInviteBusy(false);
      setError('يرجى إدخال البريد الإلكتروني.');
      return;
    }

    try {
      const response = await fetch('/app/api/team/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          role: inviteRole,
          expires_in: inviteExpiry,
        }),
      });
      const json = (await response.json().catch(() => ({}))) as any;
      if (!response.ok) {
        setError(String(json?.error ?? 'تعذر إنشاء الدعوة.'));
        return;
      }

      setInviteLink(String(json?.inviteUrl ?? ''));
      setMessage('تم إنشاء رابط الدعوة.');
      router.refresh();
    } catch {
      setError('تعذر إنشاء الدعوة. حاول مرة أخرى.');
    } finally {
      setInviteBusy(false);
    }
  }

  async function revokeInvite(invitationId: string) {
    setBusyKey(`revoke:${invitationId}`);
    setError('');
    setMessage('');

    try {
      const response = await fetch('/app/api/team/revoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invitation_id: invitationId }),
      });
      const json = (await response.json().catch(() => ({}))) as any;
      if (!response.ok) {
        setError(String(json?.error ?? 'تعذر إلغاء الدعوة.'));
        return;
      }

      setMessage('تم إلغاء الدعوة.');
      router.refresh();
    } catch {
      setError('تعذر إلغاء الدعوة.');
    } finally {
      setBusyKey('');
    }
  }

  async function changeRole(userId: string, role: TeamMemberItem['role']) {
    setBusyKey(`role:${userId}`);
    setError('');
    setMessage('');

    try {
      const response = await fetch('/app/api/team/change-role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, role }),
      });
      const json = (await response.json().catch(() => ({}))) as any;
      if (!response.ok) {
        setError(String(json?.error ?? 'تعذر تحديث الدور.'));
        return;
      }

      setMessage('تم تحديث دور العضو.');
      router.refresh();
    } catch {
      setError('تعذر تحديث الدور.');
    } finally {
      setBusyKey('');
    }
  }

  async function removeMember(userId: string) {
    const confirmed = window.confirm('هل أنت متأكد من إزالة هذا العضو من المكتب؟');
    if (!confirmed) return;

    setBusyKey(`remove:${userId}`);
    setError('');
    setMessage('');

    try {
      const response = await fetch('/app/api/team/remove-member', {
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
      setError('تعذر إزالة العضو.');
    } finally {
      setBusyKey('');
    }
  }

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setMessage('تم نسخ الرابط.');
      setError('');
    } catch {
      setError('تعذر النسخ. انسخ الرابط يدويًا.');
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-slate-600 dark:text-slate-300">
          <p>يمكنك مشاركة رابط الدعوة يدويًا. لا يوجد إرسال بريد آلي في النسخة الحالية.</p>
        </div>
        <Button type="button" variant="primary" size="sm" onClick={() => setInviteOpen(true)}>
          دعوة عضو جديد
        </Button>
      </div>

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

      <section className="rounded-lg border border-brand-border p-4 dark:border-slate-700">
        <h2 className="text-base font-semibold text-brand-navy dark:text-slate-100">أعضاء المكتب</h2>
        {!membersSorted.length ? (
          <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">لا يوجد أعضاء بعد.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="border-b border-brand-border text-slate-600 dark:border-slate-700 dark:text-slate-300">
                <tr>
                  <th className="py-2 text-start font-medium">العضو</th>
                  <th className="py-2 text-start font-medium">الدور</th>
                  <th className="py-2 text-start font-medium">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-border dark:divide-slate-800">
                {membersSorted.map((member) => {
                  const displayName = member.full_name?.trim() || member.email || member.user_id;
                  return (
                    <tr key={member.user_id}>
                      <td className="py-2 text-slate-700 dark:text-slate-200">
                        <div className="space-y-0.5">
                          <p className="font-medium text-brand-navy dark:text-slate-100">
                            {displayName}
                            {member.user_id === currentUserId ? (
                              <span className="ms-2 text-xs text-slate-500 dark:text-slate-400">(أنت)</span>
                            ) : null}
                          </p>
                          {member.email ? (
                            <p className="text-xs text-slate-500 dark:text-slate-400">{member.email}</p>
                          ) : null}
                        </div>
                      </td>
                      <td className="py-2">
                        <select
                          defaultValue={member.role}
                          onChange={(e) => changeRole(member.user_id, e.target.value as any)}
                          disabled={busyKey.startsWith('role:') && busyKey.endsWith(member.user_id)}
                          className="h-9 rounded-lg border border-brand-border bg-white px-2 text-sm outline-none ring-brand-emerald focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
                        >
                          <option value="owner">مالك</option>
                          <option value="lawyer">محامٍ</option>
                          <option value="assistant">مساعد</option>
                        </select>
                      </td>
                      <td className="py-2">
                        <div className="flex flex-wrap gap-2">
                          <Badge variant="default">{roleLabel[member.role]}</Badge>
                          <button
                            type="button"
                            className={buttonVariants('outline', 'sm')}
                            onClick={() => removeMember(member.user_id)}
                            disabled={busyKey === `remove:${member.user_id}`}
                          >
                            إزالة
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-lg border border-brand-border p-4 dark:border-slate-700">
        <h2 className="text-base font-semibold text-brand-navy dark:text-slate-100">الدعوات المعلقة</h2>
        {!invitations.length ? (
          <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">لا توجد دعوات حالياً.</p>
        ) : (
          <div className="mt-4 space-y-3">
            {invitations.map((inv) => {
              const url = `${publicSiteUrl}/invite/${inv.token}`;
              const expired = new Date(inv.expires_at).getTime() <= Date.now();
              return (
                <div
                  key={inv.id}
                  className="rounded-lg border border-brand-border p-3 text-sm dark:border-slate-700"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-medium text-brand-navy dark:text-slate-100">{inv.email}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        الدور: {roleLabel[inv.role]} · ينتهي: {new Date(inv.expires_at).toLocaleString('ar-SA')}
                        {expired ? ' · منتهية' : ''}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className={buttonVariants('outline', 'sm')}
                        onClick={() => copy(url)}
                      >
                        نسخ الرابط
                      </button>
                      <Link href={url} className={buttonVariants('ghost', 'sm')} target="_blank" rel="noreferrer">
                        فتح
                      </Link>
                      <button
                        type="button"
                        className={buttonVariants('outline', 'sm')}
                        onClick={() => revokeInvite(inv.id)}
                        disabled={busyKey === `revoke:${inv.id}`}
                      >
                        إلغاء
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {inviteOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setInviteOpen(false)}
        >
          <div
            className="w-full max-w-xl rounded-xl border border-brand-border bg-white p-5 shadow-panel dark:border-slate-700 dark:bg-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold text-brand-navy dark:text-slate-100">دعوة عضو جديد</h3>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                  أدخل البريد وحدد الدور ومدة صلاحية الرابط.
                </p>
              </div>
              <button type="button" className={buttonVariants('ghost', 'sm')} onClick={() => setInviteOpen(false)}>
                إغلاق
              </button>
            </div>

            <div className="mt-4 grid gap-4">
              <label className="block space-y-1 text-sm">
                <span className="font-medium text-slate-700 dark:text-slate-200">
                  البريد الإلكتروني <span className="text-red-600">*</span>
                </span>
                <input
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  type="email"
                  className="h-11 w-full rounded-lg border border-brand-border px-3 outline-none ring-brand-emerald focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
                  required
                />
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block space-y-1 text-sm">
                  <span className="font-medium text-slate-700 dark:text-slate-200">الدور</span>
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value as any)}
                    className="h-11 w-full rounded-lg border border-brand-border bg-white px-3 outline-none ring-brand-emerald focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
                  >
                    <option value="lawyer">محامٍ</option>
                    <option value="assistant">مساعد</option>
                    <option value="owner">مالك</option>
                  </select>
                </label>

                <label className="block space-y-1 text-sm">
                  <span className="font-medium text-slate-700 dark:text-slate-200">الصلاحية</span>
                  <select
                    value={inviteExpiry}
                    onChange={(e) => setInviteExpiry(e.target.value as any)}
                    className="h-11 w-full rounded-lg border border-brand-border bg-white px-3 outline-none ring-brand-emerald focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
                  >
                    <option value="24h">24 ساعة</option>
                    <option value="7d">7 أيام</option>
                  </select>
                </label>
              </div>

              {inviteLink ? (
                <div className="rounded-lg border border-brand-border bg-brand-background p-3 text-sm dark:border-slate-700 dark:bg-slate-800/40">
                  <p className="font-medium text-brand-navy dark:text-slate-100">رابط الدعوة</p>
                  <p className="mt-1 break-all text-xs text-slate-600 dark:text-slate-300">{inviteLink}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button type="button" className={buttonVariants('primary', 'sm')} onClick={() => copy(inviteLink)}>
                      نسخ الرابط
                    </button>
                    <Link href={inviteLink} className={buttonVariants('outline', 'sm')} target="_blank" rel="noreferrer">
                      فتح
                    </Link>
                  </div>
                </div>
              ) : null}

              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="primary" size="md" onClick={createInvite} disabled={inviteBusy}>
                  {inviteBusy ? 'جارٍ إنشاء الدعوة...' : 'إنشاء رابط الدعوة'}
                </Button>
                <Button type="button" variant="outline" size="md" onClick={() => setInviteOpen(false)} disabled={inviteBusy}>
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

