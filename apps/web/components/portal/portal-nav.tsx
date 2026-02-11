'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { clearSession, type SessionUser } from '@/lib/session';

type PortalNavProps = {
  tenantId: string;
  user: SessionUser;
};

const sections = [
  { slug: 'dashboard', label: 'لوحة التحكم' },
  { slug: 'clients', label: 'العملاء' },
  { slug: 'matters', label: 'القضايا' },
  { slug: 'documents', label: 'المستندات' },
  { slug: 'tasks', label: 'المهام' },
  { slug: 'billing', label: 'الفوترة' },
  { slug: 'settings', label: 'الإعدادات' },
  { slug: 'users', label: 'المستخدمون' },
];

export function PortalNav({ tenantId, user }: PortalNavProps) {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <aside className="rounded-xl2 border border-brand-border bg-white p-4 shadow-panel dark:border-slate-700 dark:bg-slate-900">
      <div className="mb-4 border-b border-brand-border pb-4 dark:border-slate-700">
        <p className="text-xs text-slate-500 dark:text-slate-400">المكتب</p>
        <p className="text-sm font-semibold text-brand-navy dark:text-slate-100">{user.name}</p>
        <p className="mt-1 break-all text-xs text-slate-500 dark:text-slate-400">{user.email}</p>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{user.role}</p>
      </div>

      <nav aria-label="روابط إدارة المكتب" className="space-y-2">
        {sections.map((item) => {
          const href = `/app/${tenantId}/${item.slug}`;
          const isActive = pathname === href;

          return (
            <Link
              key={item.slug}
              href={href}
              className={`block rounded-lg px-3 py-2 text-sm transition ${
                isActive
                  ? 'bg-brand-navy text-white'
                  : 'text-slate-700 hover:bg-brand-background dark:text-slate-200 dark:hover:bg-slate-800'
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      <button
        type="button"
        onClick={() => {
          clearSession();
          router.replace('/app/login');
        }}
        className="mt-6 w-full rounded-lg border border-brand-border px-3 py-2 text-sm text-slate-700 transition hover:bg-brand-background dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
      >
        تسجيل الخروج
      </button>
    </aside>
  );
}
