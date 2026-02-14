'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button, buttonVariants } from '@/components/ui/button';
import { TEMPLATE_PRESETS, type TemplateVariableDefinition, type TemplatePresetId } from '@/lib/templatePresets';
import { saveDraftVariables } from '@/components/templates/template-draft-storage';

export function TemplateCreateForm() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [category, setCategory] = useState('عام');
  const [templateType, setTemplateType] = useState<'docx' | 'pdf'>('docx');
  const [description, setDescription] = useState('');
  const [presetId, setPresetId] = useState<string>('');
  const [variables, setVariables] = useState<TemplateVariableDefinition[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const canSubmit = useMemo(() => name.trim().length >= 2 && !loading, [name, loading]);

  useEffect(() => {
    if (!presetId) return;
    const preset = TEMPLATE_PRESETS.find((p) => p.id === (presetId as TemplatePresetId));
    if (!preset) return;
    setCategory(preset.category);
    setTemplateType(preset.template_type);
    setVariables(preset.variables);
  }, [presetId]);

  const hasInvalidVariable = useMemo(() => {
    return variables.some((v) => !v.key.trim() || !v.label_ar.trim());
  }, [variables]);

  function addVariableRow() {
    setVariables((prev) => [...prev, { key: '', label_ar: '', required: false, source: 'manual' }]);
  }

  function removeVariableRow(index: number) {
    setVariables((prev) => prev.filter((_, idx) => idx !== index));
  }

  function updateVariableRow(index: number, next: Partial<TemplateVariableDefinition>) {
    setVariables((prev) => prev.map((row, idx) => (idx === index ? { ...row, ...next } : row)));
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError('');

    const normalizedName = name.trim();
    if (normalizedName.length < 2) {
      setError('اسم القالب مطلوب ويجب أن لا يقل عن حرفين.');
      return;
    }

    if (hasInvalidVariable) {
      setError('يرجى تعبئة جميع حقول المتغيرات قبل الحفظ.');
      return;
    }

    const normalizedVars = variables
      .map((v) => ({
        key: v.key.trim(),
        label_ar: v.label_ar.trim(),
        required: Boolean(v.required),
        source: v.source,
      }))
      .filter((v) => v.key && v.label_ar);

    const keys = normalizedVars.map((v) => v.key.toLowerCase());
    const unique = new Set(keys);
    if (unique.size !== keys.length) {
      setError('يوجد تكرار في مفاتيح المتغيرات.');
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

      if (normalizedVars.length) {
        saveDraftVariables(templateId, normalizedVars);
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
        <span className="font-medium text-slate-700 dark:text-slate-200">اختيار قالب جاهز (اختياري)</span>
        <select
          value={presetId}
          onChange={(event) => setPresetId(event.target.value)}
          className="h-11 w-full rounded-lg border border-brand-border bg-white px-3 outline-none ring-brand-emerald focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
        >
          <option value="">بدون</option>
          {TEMPLATE_PRESETS.map((preset) => (
            <option key={preset.id} value={preset.id}>
              {preset.name_ar}
            </option>
          ))}
        </select>
        <p className="text-xs text-slate-500">
          يعبّئ التصنيف ومتغيرات القالب تلقائيًا. يمكنك تعديلها لاحقًا.
        </p>
      </label>

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

      <div className="rounded-lg border border-brand-border p-4 dark:border-slate-700">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="font-semibold text-brand-navy dark:text-slate-100">متغيرات القالب (اختياري)</p>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              سيتم حفظها محليًا الآن ثم تطبيقها عند رفع النسخة الأولى.
            </p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={addVariableRow} disabled={loading}>
            + إضافة متغير
          </Button>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="border-b border-brand-border text-slate-600 dark:border-slate-700 dark:text-slate-300">
              <tr>
                <th className="py-2 text-start font-medium">المفتاح</th>
                <th className="py-2 text-start font-medium">الاسم</th>
                <th className="py-2 text-start font-medium">المصدر</th>
                <th className="py-2 text-start font-medium">مطلوب؟</th>
                <th className="py-2 text-start font-medium">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-border dark:divide-slate-800">
              {variables.length ? (
                variables.map((row, index) => (
                  <tr key={`${row.key}-${index}`}>
                    <td className="py-2">
                      <input
                        value={row.key}
                        onChange={(event) => updateVariableRow(index, { key: event.target.value })}
                        placeholder="مثال: client.name"
                        className="h-10 w-full rounded-lg border border-brand-border px-3 outline-none ring-brand-emerald focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
                      />
                    </td>
                    <td className="py-2">
                      <input
                        value={row.label_ar}
                        onChange={(event) => updateVariableRow(index, { label_ar: event.target.value })}
                        placeholder="مثال: اسم الموكل"
                        className="h-10 w-full rounded-lg border border-brand-border px-3 outline-none ring-brand-emerald focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
                      />
                    </td>
                    <td className="py-2">
                      <select
                        value={row.source}
                        onChange={(event) =>
                          updateVariableRow(index, {
                            source:
                              event.target.value === 'client' || event.target.value === 'matter'
                                ? (event.target.value as any)
                                : 'manual',
                          })
                        }
                        className="h-10 w-full rounded-lg border border-brand-border bg-white px-3 outline-none ring-brand-emerald focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
                      >
                        <option value="manual">يدوي</option>
                        <option value="client">موكل</option>
                        <option value="matter">قضية</option>
                      </select>
                    </td>
                    <td className="py-2">
                      <label className="inline-flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
                        <input
                          type="checkbox"
                          checked={Boolean(row.required)}
                          onChange={(event) => updateVariableRow(index, { required: event.target.checked })}
                          className="h-4 w-4 accent-brand-emerald"
                        />
                        <span className="sr-only">مطلوب</span>
                      </label>
                    </td>
                    <td className="py-2">
                      <Button type="button" variant="ghost" size="sm" onClick={() => removeVariableRow(index)} disabled={loading}>
                        حذف
                      </Button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="py-4 text-center text-slate-600 dark:text-slate-300">
                    لا توجد متغيرات بعد.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

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
