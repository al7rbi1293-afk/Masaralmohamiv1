'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { Search, Users, Briefcase, FileText, CheckSquare } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

type SearchClientItem = {
  id: string;
  name?: string;
  title?: string;
  status?: string;
  is_private?: boolean;
  due_at?: string | null;
  phone?: string | null;
  email?: string | null;
};

type SearchResponse = {
  clients: SearchClientItem[];
  matters: SearchClientItem[];
  documents: SearchClientItem[];
  tasks: SearchClientItem[];
  error?: string;
};

type GlobalSearchClientProps = {
  initialQuery?: string;
};

export function GlobalSearchClient({ initialQuery = '' }: GlobalSearchClientProps) {
  const [q, setQ] = useState(initialQuery);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [results, setResults] = useState<SearchResponse>({
    clients: [],
    matters: [],
    documents: [],
    tasks: [],
  });

  const normalizedQuery = useMemo(() => q.trim().slice(0, 80), [q]);

  useEffect(() => {
    const value = normalizedQuery;
    if (value.length < 2) {
      setResults({ clients: [], matters: [], documents: [], tasks: [] });
      setError('');
      setBusy(false);
      return;
    }

    setBusy(true);
    setError('');

    const handle = window.setTimeout(async () => {
      try {
        const response = await fetch(`/app/api/search?q=${encodeURIComponent(value)}`, {
          method: 'GET',
        });
        const json = (await response.json().catch(() => ({}))) as SearchResponse;
        if (!response.ok) {
          setError(String(json?.error ?? 'تعذر البحث.'));
          setResults({ clients: [], matters: [], documents: [], tasks: [] });
          return;
        }
        setResults({
          clients: Array.isArray(json.clients) ? json.clients : [],
          matters: Array.isArray(json.matters) ? json.matters : [],
          documents: Array.isArray(json.documents) ? json.documents : [],
          tasks: Array.isArray(json.tasks) ? json.tasks : [],
        });
      } catch {
        setError('تعذر البحث. حاول مرة أخرى.');
        setResults({ clients: [], matters: [], documents: [], tasks: [] });
      } finally {
        setBusy(false);
      }
    }, 300);

    return () => window.clearTimeout(handle);
  }, [normalizedQuery]);

  return (
    <div className="space-y-4">
      <label className="block space-y-1 text-sm">
        <span className="font-medium text-slate-700 dark:text-slate-200">كلمة البحث</span>
        <div className="relative">
          <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="ابحث بالاسم أو العنوان..."
            className="h-11 w-full rounded-lg border border-brand-border pl-3 pr-10 outline-none ring-brand-emerald focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
          />
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400">ابدأ بكتابة حرفين على الأقل.</p>
      </label>

      {busy ? (
        <p className="text-sm text-slate-600 dark:text-slate-300">جارٍ البحث...</p>
      ) : null}

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
          {error}
        </p>
      ) : null}

      {normalizedQuery.length >= 2 ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <ResultGroup
            title="العملاء"
            icon={<Users className="h-4 w-4" />}
            items={results.clients.map((c) => ({
              id: c.id,
              title: c.name ?? 'عميل',
              subtitle: [c.phone, c.email].filter(Boolean).join(' · '),
              href: `/app/clients/${c.id}`,
              badge: c.status === 'archived' ? 'مؤرشف' : '',
            }))}
            moreHref={`/app/clients?q=${encodeURIComponent(normalizedQuery)}&status=all`}
          />

          <ResultGroup
            title="القضايا"
            icon={<Briefcase className="h-4 w-4" />}
            items={results.matters.map((m) => ({
              id: m.id,
              title: m.title ?? 'قضية',
              subtitle: m.status ? statusToArabic(m.status) : '',
              href: `/app/matters/${m.id}`,
              badge: m.is_private ? 'خاصة' : '',
            }))}
            moreHref={`/app/matters?q=${encodeURIComponent(normalizedQuery)}&status=all`}
          />

          <ResultGroup
            title="المستندات"
            icon={<FileText className="h-4 w-4" />}
            items={results.documents.map((d) => ({
              id: d.id,
              title: d.title ?? 'مستند',
              subtitle: '',
              href: `/app/documents/${d.id}`,
              badge: '',
            }))}
            moreHref={`/app/documents?q=${encodeURIComponent(normalizedQuery)}`}
          />

          <ResultGroup
            title="المهام"
            icon={<CheckSquare className="h-4 w-4" />}
            items={results.tasks.map((t) => ({
              id: t.id,
              title: t.title ?? 'مهمة',
              subtitle: t.due_at ? `الاستحقاق: ${new Date(t.due_at).toLocaleString('ar-SA')}` : '',
              href: `/app/tasks?q=${encodeURIComponent(normalizedQuery)}`,
              badge: t.status ? taskStatusToArabic(t.status) : '',
            }))}
            moreHref={`/app/tasks?q=${encodeURIComponent(normalizedQuery)}`}
          />
        </div>
      ) : (
        <div className="rounded-lg border border-brand-border p-6 text-sm text-slate-600 dark:border-slate-700 dark:text-slate-300">
          ابدأ بالبحث عن عميل أو قضية أو مستند أو مهمة.
        </div>
      )}
    </div>
  );
}

function ResultGroup({
  title,
  icon,
  items,
  moreHref,
}: {
  title: string;
  icon: ReactNode;
  items: Array<{ id: string; title: string; subtitle: string; href: string; badge: string }>;
  moreHref: string;
}) {
  return (
    <section className="rounded-lg border border-brand-border p-4 dark:border-slate-700">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-semibold text-brand-navy dark:text-slate-100">
          <span className="text-slate-500 dark:text-slate-400">{icon}</span>
          {title}
        </h2>
        <Link href={moreHref} className={buttonVariants('ghost', 'sm')}>
          عرض المزيد
        </Link>
      </div>

      {!items.length ? (
        <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">لا توجد نتائج.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {items.map((item) => (
            <li key={item.id} className="rounded-lg border border-brand-border p-3 dark:border-slate-700">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <Link href={item.href} className="font-medium text-brand-navy hover:underline dark:text-slate-100">
                    {item.title}
                  </Link>
                  {item.subtitle ? (
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{item.subtitle}</p>
                  ) : null}
                </div>
                {item.badge ? <Badge variant="default">{item.badge}</Badge> : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function statusToArabic(status: string) {
  const map: Record<string, string> = {
    new: 'جديدة',
    in_progress: 'قيد العمل',
    on_hold: 'معلّقة',
    closed: 'مغلقة',
    archived: 'مؤرشفة',
  };
  return map[status] ?? status;
}

function taskStatusToArabic(status: string) {
  const map: Record<string, string> = {
    todo: 'للإنجاز',
    doing: 'قيد التنفيذ',
    done: 'تم',
    canceled: 'ملغي',
  };
  return map[status] ?? status;
}
