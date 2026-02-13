'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

type ClientItem = {
  id: string;
  name: string;
  type: 'person' | 'company';
  status: 'active' | 'archived';
};

type MatterItem = {
  id: string;
  title: string;
  status: 'new' | 'in_progress' | 'on_hold' | 'closed' | 'archived';
  is_private: boolean;
  client_id: string;
  summary: string | null;
};

type DocumentItem = {
  id: string;
  title: string;
  matter_id: string | null;
  client_id: string | null;
  description: string | null;
};

type TaskItem = {
  id: string;
  title: string;
  status: 'todo' | 'doing' | 'done' | 'canceled';
  due_at: string | null;
  matter_id: string | null;
  description: string | null;
};

type SearchGroup<T> = {
  items: T[];
  total?: number;
};

type SearchResponse = {
  q: string;
  message?: string;
  clients: SearchGroup<ClientItem>;
  matters: SearchGroup<MatterItem>;
  documents: SearchGroup<DocumentItem>;
  tasks: SearchGroup<TaskItem>;
};

const matterStatusLabel: Record<MatterItem['status'], string> = {
  new: 'جديدة',
  in_progress: 'قيد العمل',
  on_hold: 'معلّقة',
  closed: 'مغلقة',
  archived: 'مؤرشفة',
};

const taskStatusLabel: Record<TaskItem['status'], string> = {
  todo: 'للإنجاز',
  doing: 'قيد التنفيذ',
  done: 'تم',
  canceled: 'ملغي',
};

const clientTypeLabel: Record<ClientItem['type'], string> = {
  person: 'فرد',
  company: 'شركة',
};

const clientStatusLabel: Record<ClientItem['status'], string> = {
  active: 'نشط',
  archived: 'مؤرشف',
};

export function GlobalSearchClient() {
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [results, setResults] = useState<SearchResponse | null>(null);

  const latestRequest = useRef(0);

  const normalizedQ = useMemo(() => q.replace(/\s+/g, ' ').trim(), [q]);
  const canSearch = normalizedQ.length >= 2;

  async function runSearch(query: string) {
    const requestId = latestRequest.current + 1;
    latestRequest.current = requestId;

    setLoading(true);
    setError('');

    try {
      const response = await fetch(`/app/api/search?q=${encodeURIComponent(query)}`, {
        method: 'GET',
      });
      const json = (await response.json().catch(() => ({}))) as any;

      if (latestRequest.current !== requestId) return;

      if (!response.ok) {
        setError(String(json?.error ?? 'تعذر البحث. حاول مرة أخرى.'));
        setResults(null);
        return;
      }

      setResults(json as SearchResponse);
    } catch {
      if (latestRequest.current !== requestId) return;
      setError('تعذر البحث. حاول مرة أخرى.');
      setResults(null);
    } finally {
      if (latestRequest.current === requestId) {
        setLoading(false);
      }
    }
  }

  useEffect(() => {
    if (!canSearch) {
      setResults(null);
      setError('');
      setLoading(false);
      return;
    }

    const handle = window.setTimeout(() => {
      runSearch(normalizedQ);
    }, 300);

    return () => window.clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [normalizedQ, canSearch]);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSearch) {
      setError('اكتب كلمتين على الأقل للبحث.');
      setResults(null);
      return;
    }
    runSearch(normalizedQ);
  }

  const noResults =
    results &&
    !results.clients.items.length &&
    !results.matters.items.length &&
    !results.documents.items.length &&
    !results.tasks.items.length;

  return (
    <div className="space-y-5">
      <form onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <label className="block">
          <span className="sr-only">بحث</span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="ابحث عن عميل، قضية، مستند، مهمة..."
            className="h-11 w-full rounded-lg border border-brand-border px-3 outline-none ring-brand-emerald focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
          />
        </label>
        <Button type="submit" variant="outline" size="md" disabled={loading}>
          {loading ? 'جارٍ البحث...' : 'بحث'}
        </Button>
      </form>

      {!canSearch ? (
        <p className="text-sm text-slate-600 dark:text-slate-300">اكتب كلمتين على الأقل للبحث.</p>
      ) : null}

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
          {error}
        </p>
      ) : null}

      {results?.message ? (
        <p className="rounded-lg border border-brand-border bg-brand-background px-3 py-2 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-800/40 dark:text-slate-200">
          {results.message}
        </p>
      ) : null}

      {loading && !results ? (
        <p className="text-sm text-slate-600 dark:text-slate-300">جارٍ البحث...</p>
      ) : null}

      {noResults ? (
        <p className="rounded-lg border border-brand-border px-3 py-3 text-sm text-slate-600 dark:border-slate-700 dark:text-slate-300">
          لا توجد نتائج.
        </p>
      ) : null}

      {results ? (
        <div className="space-y-6">
          <ResultGroup
            title="العملاء"
            count={results.clients.total ?? results.clients.items.length}
          >
            {results.clients.items.map((client) => (
              <ResultItem
                key={client.id}
                href={`/app/clients/${client.id}`}
                title={client.name}
                meta={`${clientTypeLabel[client.type]} · ${clientStatusLabel[client.status]}`}
              />
            ))}
          </ResultGroup>

          <ResultGroup
            title="القضايا"
            count={results.matters.total ?? results.matters.items.length}
          >
            {results.matters.items.map((matter) => (
              <ResultItem
                key={matter.id}
                href={`/app/matters/${matter.id}`}
                title={matter.title}
                meta={`${matterStatusLabel[matter.status]}${matter.is_private ? ' · خاصة' : ''}`}
                description={matter.summary}
                badges={
                  matter.is_private ? <Badge variant="warning">خاصة</Badge> : null
                }
              />
            ))}
          </ResultGroup>

          <ResultGroup
            title="المستندات"
            count={results.documents.total ?? results.documents.items.length}
          >
            {results.documents.items.map((doc) => (
              <ResultItem
                key={doc.id}
                href={`/app/documents/${doc.id}`}
                title={doc.title}
                meta={doc.matter_id ? 'مرتبط بقضية' : 'بدون قضية'}
                description={doc.description}
              />
            ))}
          </ResultGroup>

          <ResultGroup
            title="المهام"
            count={results.tasks.total ?? results.tasks.items.length}
          >
            {results.tasks.items.map((task) => {
              const due = task.due_at ? new Date(task.due_at) : null;
              const metaParts = [taskStatusLabel[task.status]];
              if (due) metaParts.push(`استحقاق: ${due.toLocaleDateString('ar-SA')}`);
              return (
                <ResultItem
                  key={task.id}
                  href={`/app/tasks?q=${encodeURIComponent(task.title)}`}
                  title={task.title}
                  meta={metaParts.join(' · ')}
                  description={task.description}
                />
              );
            })}
          </ResultGroup>
        </div>
      ) : null}
    </div>
  );
}

function ResultGroup({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-brand-border p-4 dark:border-slate-700">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-brand-navy dark:text-slate-100">{title}</h2>
        <span className="text-xs text-slate-500 dark:text-slate-400">{count}</span>
      </div>
      <div className="mt-3 space-y-2">{children}</div>
    </section>
  );
}

function ResultItem({
  href,
  title,
  meta,
  description,
  badges,
}: {
  href: string;
  title: string;
  meta: string;
  description?: string | null;
  badges?: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="block rounded-lg border border-brand-border px-3 py-3 transition hover:bg-brand-background dark:border-slate-700 dark:hover:bg-slate-800/50"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-medium text-brand-navy dark:text-slate-100">{title}</p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{meta}</p>
        </div>
        {badges ? <div className="shrink-0">{badges}</div> : null}
      </div>
      {description ? (
        <p className="mt-2 line-clamp-2 text-sm text-slate-700 dark:text-slate-200">
          {description}
        </p>
      ) : null}
      <span className="mt-2 inline-flex text-xs text-brand-emerald">فتح</span>
    </Link>
  );
}
