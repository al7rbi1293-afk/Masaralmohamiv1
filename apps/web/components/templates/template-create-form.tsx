'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button, buttonVariants } from '@/components/ui/button';

export function TemplateCreateForm() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [category, setCategory] = useState('عام');
  const [templateType, setTemplateType] = useState<'docx' | 'pdf'>('docx');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const canSubmit = useMemo(() => name.trim().length >= 2 && !loading, [name, loading]);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError('');

    const normalizedName = name.trim();
    if (normalizedName.length < 2) {
      setError('اسم القالب مطلوب ويجب أن لا يقل عن حرفين.');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/app/api/templates/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: normalizedName,
          category: category.trim(),
          template_type: templateType,
          description: description.trim(),
        }),
      });

      const json = (await response.json().catch(() => ({}))) as any;
      if (!response.ok) {
        setError(String(json?.error ?? 'تعذر إنشاء القالب.'));
        return;
      }

      const templateId = String(json?.template?.id ?? '');
      if (!templateId) {
        setError('تعذر إنشاء القالب.');
        return;
      }

      router.push(`/app/templates/${templateId}?success=${encodeURIComponent('تم إنشاء القالب.')}`);
      router.refresh();
    } catch {
      setError('تعذر إنشاء القالب.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 grid gap-4">
      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
          {error}
        </p>
      ) : null}

      <label className="block space-y-1 text-sm">
        <span className="font-medium text-slate-700 dark:text-slate-200">
          اسم القالب <span className="text-red-600">*</span>
        </span>
        <input
          required
          minLength={2}
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="h-11 w-full rounded-lg border border-brand-border px-3 outline-none ring-brand-emerald focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
        />
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block space-y-1 text-sm">
          <span className="font-medium text-slate-700 dark:text-slate-200">التصنيف</span>
          <input
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            className="h-11 w-full rounded-lg border border-brand-border px-3 outline-none ring-brand-emerald focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
          />
        </label>

        <label className="block space-y-1 text-sm">
          <span className="font-medium text-slate-700 dark:text-slate-200">النوع</span>
          <select
            value={templateType}
            onChange={(event) => setTemplateType(event.target.value === 'pdf' ? 'pdf' : 'docx')}
            className="h-11 w-full rounded-lg border border-brand-border bg-white px-3 outline-none ring-brand-emerald focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
          >
            <option value="docx">DOCX</option>
            <option value="pdf">PDF</option>
          </select>
        </label>
      </div>

      <label className="block space-y-1 text-sm">
        <span className="font-medium text-slate-700 dark:text-slate-200">وصف (اختياري)</span>
        <textarea
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          rows={4}
          className="w-full rounded-lg border border-brand-border px-3 py-2 outline-none ring-brand-emerald focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
        />
      </label>

      <div className="flex flex-wrap gap-3">
        <Button type="submit" variant="primary" size="md" disabled={!canSubmit}>
          {loading ? 'جارٍ إنشاء القالب...' : 'حفظ'}
        </Button>
        <Link href="/app/templates" className={buttonVariants('outline', 'md')}>
          إلغاء
        </Link>
      </div>
    </form>
  );
}

