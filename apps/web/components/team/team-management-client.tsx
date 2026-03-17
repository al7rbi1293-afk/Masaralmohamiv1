'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, buttonVariants } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';

export type TeamMemberItem = {
  user_id: string;
  email: string | null;
  full_name: string;
  phone: string | null;
  license_number: string | null;
  role: 'owner' | 'lawyer' | 'assistant';
  permissions: Record<string, boolean>;
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
  currentUserId: string;
  members: TeamMemberItem[];
};

const roleLabel: Record<TeamMemberItem['role'], string> = {
  owner: 'مالك',
  lawyer: 'محامٍ',
  assistant: 'مساعد',
};

export function TeamManagementClient({
  currentUserId,
  members,
}: TeamManagementClientProps) {
  const router = useRouter();
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const confirmActionRef = useRef<null | (() => Promise<void>)>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [confirmTitle, setConfirmTitle] = useState('');
  const [confirmMessage, setConfirmMessage] = useState('');
  const [confirmLabel, setConfirmLabel] = useState('تأكيد');
  const [confirmDestructive, setConfirmDestructive] = useState(true);

  const [addOpen, setAddOpen] = useState(false);
  const [addFullName, setAddFullName] = useState('');
  const [addEmail, setAddEmail] = useState('');
  const [addPassword, setAddPassword] = useState('');
  const [addLicenseNumber, setAddLicenseNumber] = useState('');
  const [addRole, setAddRole] = useState<TeamMemberItem['role']>('lawyer');
  const [addPermissions, setAddPermissions] = useState<Record<string, boolean>>({
    matters: true,
    clients: true,
    billing: false,
    settings: false,
  });
  const [addBusy, setAddBusy] = useState(false);

  const [editOpen, setEditOpen] = useState(false);
  const [editUserId, setEditUserId] = useState('');
  const [editFullName, setEditFullName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editLicenseNumber, setEditLicenseNumber] = useState('');
  const [editPermissions, setEditPermissions] = useState<Record<string, boolean>>({});
  const [editBusy, setEditBusy] = useState(false);

  const [busyKey, setBusyKey] = useState('');

  const membersSorted = useMemo(() => {
    return [...members].sort((a, b) => a.created_at.localeCompare(b.created_at));
  }, [members]);

  const ownersCount = useMemo(() => {
    return membersSorted.filter((member) => member.role === 'owner').length;
  }, [membersSorted]);

  useEffect(() => {
    if (!addOpen) {
      setAddFullName('');
      setAddEmail('');
      setAddPassword('');
      setAddLicenseNumber('');
      setAddRole('lawyer');
      setAddPermissions({ matters: true, clients: true, billing: false, settings: false });
      setAddBusy(false);
      setError('');
      setMessage('');
    }
  }, [addOpen]);

  useEffect(() => {
    if (!editOpen) {
      setEditUserId('');
      setEditFullName('');
      setEditEmail('');
      setEditPhone('');
      setEditLicenseNumber('');
      setEditPermissions({});
      setEditBusy(false);
    }
  }, [editOpen]);

  function openConfirm(params: {
    title: string;
    message: string;
    confirmLabel: string;
    destructive?: boolean;
    action: () => Promise<void>;
  }) {
    confirmActionRef.current = params.action;
    setConfirmTitle(params.title);
    setConfirmMessage(params.message);
    setConfirmLabel(params.confirmLabel);
    setConfirmDestructive(params.destructive ?? true);
    setConfirmBusy(false);
    setConfirmOpen(true);
  }

  async function addMember() {
    setAddBusy(true);
    setError('');
    setMessage('');

    const email = addEmail.trim().toLowerCase();
    const fullName = addFullName.trim();
    const password = addPassword;
    const licenseNumber = addLicenseNumber.trim() || undefined;

    if (!email || !fullName || !password) {
      setAddBusy(false);
      setError('يرجى تعبئة جميع الحقول المطلوبة.');
      return;
    }

    try {
      const response = await fetch('/app/api/team/add-member', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName,
          email,
          password,
          licenseNumber,
          role: addRole,
          permissions: addPermissions,
        }),
      });
      let errorMsg = 'تعذر إضافة العضو.';
      if (!response.ok) {
        const rawText = await response.text().catch(() => '');
        try {
          const json = JSON.parse(rawText);
          errorMsg = String(json?.error || json?.rawError || errorMsg);
        } catch {
          errorMsg = rawText ? rawText.slice(0, 100) : errorMsg; // Show first 100 chars of HTML/text crash
        }
        setError(errorMsg);
        return;
      }

      setMessage('تمت إضافة العضو بنجاح.');
      setAddOpen(false);
      router.refresh();
    } catch {
      setError('تعذر إضافة العضو. حاول مرة أخرى.');
    } finally {
      setAddBusy(false);
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
        body: JSON.stringify({ userId, role }),
      });
      const json = (await response.json().catch(() => ({}))) as any;
      if (!response.ok) {
        setError(String(json?.error ?? 'تعذر تحديث الدور.'));
        return;
      }

      setMessage('تم تحديث الدور.');
      router.refresh();
    } catch {
      setError('تعذر تحديث الدور.');
    } finally {
      setBusyKey('');
    }
  }

  async function removeMemberDirect(userId: string) {
    setBusyKey(`remove:${userId}`);
    setError('');
    setMessage('');

    try {
      const response = await fetch('/app/api/team/remove-member', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
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

  function removeMember(userId: string) {
    openConfirm({
      title: 'إزالة عضو',
      message: 'هل أنت متأكد من إزالة هذا العضو من المكتب؟',
      confirmLabel: 'إزالة',
      destructive: true,
      action: async () => removeMemberDirect(userId),
    });
  }

  function openEdit(member: TeamMemberItem) {
    setEditUserId(member.user_id);
    setEditFullName(member.full_name ?? '');
    setEditEmail(member.email ?? '');
    setEditPhone(member.phone ?? '');
    setEditLicenseNumber(member.license_number ?? '');
    setEditPermissions(member.permissions ?? {});
    setEditOpen(true);
    setError('');
    setMessage('');
  }

  async function saveMemberDetails() {
    const fullName = editFullName.trim();
    const email = editEmail.trim().toLowerCase();
    const phone = editPhone.trim();
    const licenseNumber = editLicenseNumber.trim() || undefined;

    if (!editUserId || !fullName || !email) {
      setError('يرجى تعبئة الاسم والبريد الإلكتروني.');
      return;
    }

    setEditBusy(true);
    setError('');
    setMessage('');

    try {
      const response = await fetch('/app/api/team/update-member', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: editUserId,
          fullName,
          email,
          phone: phone || null,
          licenseNumber: licenseNumber || null,
          permissions: editPermissions,
        }),
      });
      const json = (await response.json().catch(() => ({}))) as any;
      if (!response.ok) {
        setError(String(json?.error ?? 'تعذر تحديث بيانات العضو.'));
        return;
      }

      setMessage('تم تحديث بيانات العضو.');
      setEditOpen(false);
      router.refresh();
    } catch {
      setError('تعذر تحديث بيانات العضو. حاول مرة أخرى.');
    } finally {
      setEditBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-slate-600 dark:text-slate-300">
          <p>يمكنك إضافة أعضاء جدد وتحديث بياناتهم وإدارة أدوارهم من هذه الصفحة.</p>
        </div>
        <Button type="button" variant="primary" size="sm" onClick={() => setAddOpen(true)}>
          إضافة عضو
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

      <ConfirmDialog
        open={confirmOpen}
        title={confirmTitle}
        message={confirmMessage}
        confirmLabel={confirmLabel}
        destructive={confirmDestructive}
        busy={confirmBusy}
        onCancel={() => {
          if (!confirmBusy) setConfirmOpen(false);
        }}
        onConfirm={async () => {
          if (!confirmActionRef.current) return;
          setConfirmBusy(true);
          try {
            await confirmActionRef.current();
            setConfirmOpen(false);
          } finally {
            setConfirmBusy(false);
          }
        }}
      />

      <section className="rounded-lg border border-brand-border p-4 dark:border-slate-700">
        <h2 className="text-base font-semibold text-brand-navy dark:text-slate-100">أعضاء المكتب</h2>
        {!membersSorted.length ? (
          <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">لا يوجد أعضاء بعد.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="border-b border-brand-border text-slate-600 dark:border-slate-700 dark:text-slate-300">
                <tr>
                  <th className="py-2 text-start font-medium">الاسم</th>
                  <th className="py-2 text-start font-medium">البريد</th>
                  <th className="py-2 text-start font-medium">الجوال</th>
                  <th className="py-2 text-start font-medium">الدور</th>
                  <th className="py-2 text-start font-medium">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-border dark:divide-slate-800">
                {membersSorted.map((member) => {
                  const displayName = member.full_name?.trim() || member.email || member.user_id;
                  const isLastOwner = member.role === 'owner' && ownersCount <= 1;
                  const lastOwnerTooltip = isLastOwner
                    ? 'لا يمكن إزالة/تغيير آخر شريك (Owner) في المكتب.'
                    : '';
                  return (
                    <tr key={member.user_id}>
                      <td className="py-2 text-slate-700 dark:text-slate-200">
                        <p className="font-medium text-brand-navy dark:text-slate-100">
                          {displayName}
                          {member.user_id === currentUserId ? (
                            <span className="ms-2 text-xs text-slate-500 dark:text-slate-400">(أنت)</span>
                          ) : null}
                        </p>
                      </td>
                      <td className="py-2 text-slate-700 dark:text-slate-200">
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          {member.email ?? '-'}
                        </span>
                      </td>
                      <td className="py-2 text-slate-700 dark:text-slate-200">
                        <span className="text-xs text-slate-500 dark:text-slate-400" dir="ltr">
                          {member.phone ?? '-'}
                        </span>
                      </td>
                      <td className="py-2">
                        <select
                          defaultValue={member.role}
                          onChange={(e) => changeRole(member.user_id, e.target.value as any)}
                          disabled={
                            isLastOwner ||
                            (busyKey.startsWith('role:') && busyKey.endsWith(member.user_id))
                          }
                          title={lastOwnerTooltip}
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
                            onClick={() => openEdit(member)}
                            disabled={editBusy || busyKey === `remove:${member.user_id}`}
                          >
                            تعديل البيانات
                          </button>
                          <button
                            type="button"
                            className={buttonVariants('outline', 'sm')}
                            onClick={() => removeMember(member.user_id)}
                            disabled={isLastOwner || busyKey === `remove:${member.user_id}`}
                            title={lastOwnerTooltip}
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

      {editOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-3 sm:items-center sm:p-4"
          onClick={() => {
            if (!editBusy) setEditOpen(false);
          }}
        >
          <div
            className="mobile-modal-panel w-full max-w-xl rounded-xl border border-brand-border bg-white p-4 shadow-panel sm:p-5 dark:border-slate-700 dark:bg-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold text-brand-navy dark:text-slate-100">تعديل بيانات العضو</h3>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                  يمكنك تعديل معلومات وصلاحيات هذا العضو.
                </p>
              </div>
              <button
                type="button"
                className={buttonVariants('ghost', 'sm')}
                onClick={() => setEditOpen(false)}
                disabled={editBusy}
              >
                إغلاق
              </button>
            </div>

            <div className="mt-4 grid gap-4">
              <label className="block space-y-1 text-sm">
                <span className="font-medium text-slate-700 dark:text-slate-200">
                  الاسم الكامل <span className="text-red-600">*</span>
                </span>
                <input
                  value={editFullName}
                  onChange={(e) => setEditFullName(e.target.value)}
                  type="text"
                  placeholder="محمد العبدالله"
                  className="h-11 w-full rounded-lg border border-brand-border px-3 outline-none ring-brand-emerald focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
                  required
                />
              </label>

              <label className="block space-y-1 text-sm">
                <span className="font-medium text-slate-700 dark:text-slate-200">
                  البريد الإلكتروني <span className="text-red-600">*</span>
                </span>
                <input
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  type="email"
                  dir="ltr"
                  className="h-11 w-full rounded-lg border border-brand-border px-3 outline-none ring-brand-emerald focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
                  required
                />
              </label>

              <label className="block space-y-1 text-sm">
                <span className="font-medium text-slate-700 dark:text-slate-200">رقم الجوال</span>
                <input
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  type="tel"
                  dir="ltr"
                  placeholder="05XXXXXXXX"
                  className="h-11 w-full rounded-lg border border-brand-border px-3 outline-none ring-brand-emerald focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
                />
              </label>

              <label className="block space-y-1 text-sm">
                <span className="font-medium text-slate-700 dark:text-slate-200">رقم الترخيص (إن وجد)</span>
                <input
                  value={editLicenseNumber}
                  onChange={(e) => setEditLicenseNumber(e.target.value)}
                  type="text"
                  dir="ltr"
                  placeholder="مثال: 4123456"
                  className="h-11 w-full rounded-lg border border-brand-border px-3 outline-none ring-brand-emerald focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
                />
              </label>
              
              <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/50">
                <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200">الصلاحيات المخصصة</h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {[
                    { id: 'matters', label: 'القضايا' },
                    { id: 'clients', label: 'العملاء' },
                    { id: 'billing', label: 'الفوترة' },
                    { id: 'settings', label: 'الإعدادات' },
                  ].map((perm) => (
                    <label key={perm.id} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={!!editPermissions[perm.id]}
                        onChange={(e) =>
                          setEditPermissions((prev) => ({ ...prev, [perm.id]: e.target.checked }))
                        }
                        className="rounded border-slate-300 text-brand-emerald focus:ring-brand-emerald dark:border-slate-700"
                      />
                      <span className="text-slate-700 dark:text-slate-300">{perm.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="mt-2 flex flex-wrap gap-2">
                <Button type="button" variant="primary" size="md" onClick={saveMemberDetails} disabled={editBusy}>
                  {editBusy ? 'جارٍ الحفظ...' : 'حفظ التغييرات'}
                </Button>
                <Button type="button" variant="outline" size="md" onClick={() => setEditOpen(false)} disabled={editBusy}>
                  إلغاء
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {addOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-3 sm:items-center sm:p-4"
          onClick={() => setAddOpen(false)}
        >
          <div
            className="mobile-modal-panel w-full max-w-xl rounded-xl border border-brand-border bg-white p-4 shadow-panel sm:p-5 dark:border-slate-700 dark:bg-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold text-brand-navy dark:text-slate-100">إضافة عضو جديد</h3>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                  سيتم إنشاء حساب للعضو فوراً وإضافته لفريقك.
                </p>
              </div>
              <button type="button" className={buttonVariants('ghost', 'sm')} onClick={() => setAddOpen(false)}>
                إغلاق
              </button>
            </div>

            <div className="mt-4 grid gap-4">
              <label className="block space-y-1 text-sm">
                <span className="font-medium text-slate-700 dark:text-slate-200">
                  الاسم الكامل <span className="text-red-600">*</span>
                </span>
                <input
                  value={addFullName}
                  onChange={(e) => setAddFullName(e.target.value)}
                  type="text"
                  placeholder="محمد العبدالله"
                  className="h-11 w-full rounded-lg border border-brand-border px-3 outline-none ring-brand-emerald focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
                  required
                />
              </label>

              <label className="block space-y-1 text-sm">
                <span className="font-medium text-slate-700 dark:text-slate-200">
                  البريد الإلكتروني <span className="text-red-600">*</span>
                </span>
                <input
                  value={addEmail}
                  onChange={(e) => setAddEmail(e.target.value)}
                  type="email"
                  dir="ltr"
                  className="h-11 w-full rounded-lg border border-brand-border px-3 outline-none ring-brand-emerald focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
                  required
                />
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block space-y-1 text-sm">
                  <span className="font-medium text-slate-700 dark:text-slate-200">
                    كلمة المرور (المبدئية) <span className="text-red-600">*</span>
                  </span>
                  <input
                    value={addPassword}
                    onChange={(e) => setAddPassword(e.target.value)}
                    type="password"
                    dir="ltr"
                    className="h-11 w-full rounded-lg border border-brand-border px-3 outline-none ring-brand-emerald focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
                    placeholder="٦ أحرف كحد أدنى"
                    required
                  />
                </label>

                <label className="block space-y-1 text-sm">
                  <span className="font-medium text-slate-700 dark:text-slate-200">الدور</span>
                  <select
                    value={addRole}
                    onChange={(e) => setAddRole(e.target.value as any)}
                    className="h-11 w-full rounded-lg border border-brand-border bg-white px-3 outline-none ring-brand-emerald focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
                  >
                    <option value="lawyer">محامٍ</option>
                    <option value="assistant">مساعد</option>
                    <option value="owner">مالك</option>
                  </select>
                </label>
              </div>

              <label className="block space-y-1 text-sm">
                <span className="font-medium text-slate-700 dark:text-slate-200">رقم الترخيص (إن وجد)</span>
                <input
                  value={addLicenseNumber}
                  onChange={(e) => setAddLicenseNumber(e.target.value)}
                  type="text"
                  dir="ltr"
                  placeholder="مثال: 4123456"
                  className="h-11 w-full rounded-lg border border-brand-border px-3 outline-none ring-brand-emerald focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
                />
              </label>

              <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/50">
                <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200">الصلاحيات الافتراضية</h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {[
                    { id: 'matters', label: 'القضايا' },
                    { id: 'clients', label: 'العملاء' },
                    { id: 'billing', label: 'الفوترة' },
                    { id: 'settings', label: 'الإعدادات' },
                  ].map((perm) => (
                    <label key={perm.id} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={!!addPermissions[perm.id]}
                        onChange={(e) =>
                          setAddPermissions((prev) => ({ ...prev, [perm.id]: e.target.checked }))
                        }
                        className="rounded border-slate-300 text-brand-emerald focus:ring-brand-emerald dark:border-slate-700"
                      />
                      <span className="text-slate-700 dark:text-slate-300">{perm.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="mt-2 flex flex-wrap gap-2">
                <Button type="button" variant="primary" size="md" onClick={addMember} disabled={addBusy}>
                  {addBusy ? 'جارٍ إضافة العضو...' : 'إضافة عضو'}
                </Button>
                <Button type="button" variant="outline" size="md" onClick={() => setAddOpen(false)} disabled={addBusy}>
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
