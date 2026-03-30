import { Activity, Building, Calendar, Mail, Phone, Shield, User as UserIcon } from 'lucide-react';
import { SlideOverContent, SlideOverDescription, SlideOverHeader, SlideOverTitle } from '@/components/ui/slide-over';
import type { PendingUser, User } from './users-tab-types';
import { isConfirmedUser, isOrganizationExpired } from './users-tab-helpers';

export function UserDetailsPanel({
  selectedUser,
  actionId,
  onSuspend,
  onActivate,
  onDeleteConfirmed,
  onDeletePending,
}: {
  selectedUser: User | PendingUser;
  actionId: string | null;
  onSuspend: (user: User) => void;
  onActivate: (user: User) => void;
  onDeleteConfirmed: (user: User) => void;
  onDeletePending: (user: PendingUser) => void;
}) {
  return (
    <SlideOverContent>
      <SlideOverHeader>
        <SlideOverTitle>تفاصيل المستخدم</SlideOverTitle>
        <SlideOverDescription>معلومات الحساب والارتباط بالمكاتب.</SlideOverDescription>
      </SlideOverHeader>

      <div className="space-y-6">
        <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-900/50">
          <div className="flex items-center gap-4 border-b border-slate-200 pb-4 dark:border-slate-800">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-emerald/10 text-brand-emerald dark:bg-emerald-500/20 dark:text-emerald-400">
              <UserIcon className="h-6 w-6" />
            </div>
            <div>
              <h4 className="text-lg font-bold text-brand-navy dark:text-slate-100">
                {isConfirmedUser(selectedUser) ? selectedUser.full_name || 'بدون اسم' : 'حساب غير مفعّل'}
              </h4>
              <div className="mt-1 flex items-center gap-2 text-sm text-slate-500">
                <Mail className="h-3.5 w-3.5" />
                <span>{selectedUser.email ?? selectedUser.user_id}</span>
              </div>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="mb-1 flex items-center gap-1 text-slate-500 dark:text-slate-400"><Calendar className="h-3.5 w-3.5" /> التسجيل</p>
              <p className="font-medium text-slate-900 dark:text-slate-100">{new Date(selectedUser.created_at).toLocaleDateString('ar-SA')}</p>
            </div>
            {isConfirmedUser(selectedUser) && (
              <div>
                <p className="mb-1 flex items-center gap-1 text-slate-500 dark:text-slate-400"><Phone className="h-3.5 w-3.5" /> الجوال</p>
                <p className="font-medium text-slate-900 dark:text-slate-100" dir="ltr">{selectedUser.phone || '—'}</p>
              </div>
            )}
            <div>
              <p className="mb-1 flex items-center gap-1 text-slate-500 dark:text-slate-400"><Activity className="h-3.5 w-3.5" /> الحالة</p>
              {isConfirmedUser(selectedUser) ? (
                <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${selectedUser.status === 'suspended'
                  ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                  : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                  }`}>
                  {selectedUser.status === 'suspended' ? 'معلّق' : 'نشط'}
                </span>
              ) : (
                <span className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">غير مفعّل</span>
              )}
            </div>
          </div>
        </div>

        {isConfirmedUser(selectedUser) && (
          <div>
            <h4 className="mb-3 flex items-center gap-2 text-base font-semibold text-brand-navy dark:text-slate-100">
              <Building className="h-4 w-4 text-brand-emerald" />
              المكاتب المرتبطة
            </h4>
            {selectedUser.memberships.length === 0 ? (
              <p className="rounded-lg border border-slate-100 bg-slate-50 p-3 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-800/50">لا يوجد ارتباط بأي مكتب.</p>
            ) : (
              <div className="space-y-3">
                {selectedUser.memberships.map((m) => (
                  <div key={m.org_id} className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-800/50">
                    <div>
                      <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{m.organizations?.name}</p>
                      <p className="text-xs text-slate-500">{m.role}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className={`rounded-full px-2 py-0.5 text-xs ${m.organizations?.status === 'active'
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                        : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
                        }`}>
                        {m.organizations?.status === 'active' ? 'مكتب نشط' : 'مكتب معلّق'}
                      </span>
                      {isOrganizationExpired(m.organizations) ? (
                        <span className="text-[10px] font-bold text-red-600 dark:text-red-400">انتهت الصلاحية</span>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div>
          <h4 className="mb-3 flex items-center gap-2 text-base font-semibold text-brand-navy dark:text-slate-100">
            <Shield className="h-4 w-4 text-brand-emerald" />
            إجراءات سريعة
          </h4>
          <div className="flex flex-col gap-2">
            {isConfirmedUser(selectedUser) ? (
              <>
                {selectedUser.status === 'active' ? (
                  <button
                    disabled={actionId === selectedUser.user_id}
                    onClick={() => onSuspend(selectedUser)}
                    className="w-full rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-100 disabled:opacity-50 dark:border-red-900/30 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/40"
                  >
                    تعليق الحساب
                  </button>
                ) : (
                  <button
                    disabled={actionId === selectedUser.user_id}
                    onClick={() => onActivate(selectedUser)}
                    className="w-full rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-medium text-emerald-700 transition-colors hover:bg-emerald-100 disabled:opacity-50 dark:border-emerald-900/30 dark:bg-emerald-900/20 dark:text-emerald-400 dark:hover:bg-emerald-900/40"
                  >
                    تفعيل الحساب
                  </button>
                )}
                <button
                  disabled={actionId === selectedUser.user_id}
                  onClick={() => onDeleteConfirmed(selectedUser)}
                  className="w-full rounded-lg border border-slate-900 bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-black disabled:opacity-50 dark:border-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600"
                >
                  حذف الحساب نهائيًا
                </button>
              </>
            ) : (
              <button
                disabled={actionId === selectedUser.user_id}
                onClick={() => onDeletePending(selectedUser)}
                className="w-full rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-100 disabled:opacity-50 dark:border-red-900/30 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/40"
              >
                حذف حساب غير مفعّل نهائياً
              </button>
            )}
          </div>
        </div>
      </div>
    </SlideOverContent>
  );
}
