'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button, buttonVariants } from '@/components/ui/button';
import { saveDraftVariables } from '@/components/templates/template-draft-storage';

type TemplateVariableSource = 'client' | 'matter' | 'org' | 'user' | 'computed' | 'manual';
type TemplateVariableFormat = 'text' | 'date' | 'number' | 'id';
type TemplateVariableTransform = 'upper' | 'lower' | 'none';

type TemplateVariableDefinition = {
  key: string;
  label_ar: string;
  required: boolean;
  source: TemplateVariableSource;
  path?: string;
  format?: TemplateVariableFormat;
  transform?: TemplateVariableTransform;
  defaultValue?: string;
  help_ar?: string;
};

type TemplatePreset = {
  code: string;
  name_ar: string;
  category: string;
  variables: TemplateVariableDefinition[];
};

export function TemplateCreateForm() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [category, setCategory] = useState('عام');
  const [description, setDescription] = useState('');
  const [presetCode, setPresetCode] = useState<string>('');
  const [presets, setPresets] = useState<TemplatePreset[]>([]);
  const [variables, setVariables] = useState<TemplateVariableDefinition[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const canSubmit = useMemo(() => name.trim().length >= 2 && !loading, [name, loading]);

  useEffect(() => {
    let cancelled = false;

    async function loadPresets() {
      try {
        const response = await fetch('/api/templates/presets', { method: 'GET' });
        const json = (await response.json().catch(() => ({}))) as any;
        if (!response.ok) return;
        if (!cancelled) {
          const items = Array.isArray(json?.presets) ? (json.presets as any[]) : [];
          setPresets(
            items.map((p) => ({
              code: String(p.code ?? ''),
              name_ar: String(p.name_ar ?? ''),
              category: String(p.category ?? ''),
              variables: Array.isArray(p.variables) ? (p.variables as TemplateVariableDefinition[]) : [],
            })),
          );
        }
      } catch {
        // ignore presets fetch errors (optional UX)
      }
    }

    void loadPresets();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!presetCode) return;
    const preset = presets.find((p) => p.code === presetCode) ?? null;
    if (!preset) return;
    setCategory(preset.category || 'عام');
    setVariables(
      Array.isArray(preset.variables)
        ? preset.variables.map((v) => ({
            key: String(v.key ?? ''),
            label_ar: String(v.label_ar ?? ''),
            required: Boolean(v.required),
            source: (v.source as TemplateVariableSource) || 'manual',
            path: String(v.path ?? ''),
            format: (v.format as TemplateVariableFormat) || 'text',
            transform: (v.transform as TemplateVariableTransform) || 'none',
            defaultValue: String(v.defaultValue ?? ''),
            help_ar: String(v.help_ar ?? ''),
          }))
        : [],
    );
  }, [presetCode, presets]);

  const hasInvalidVariable = useMemo(() => {
    return variables.some((v) => {
      if (!v.key.trim() || !v.label_ar.trim()) return true;
      if (v.source === 'client' || v.source === 'matter' || v.source === 'org' || v.source === 'user') {
        return !String(v.path ?? '').trim();
      }
      return false;
    });
  }, [variables]);

  function addVariableRow() {
    setVariables((prev) => [
      ...prev,
      {
        key: '',
        label_ar: '',
        required: false,
        source: 'manual',
        path: '',
        format: 'text',
        transform: 'none',
        defaultValue: '',
        help_ar: '',
      },
    ]);
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

    const keyPattern = /^[A-Za-z][A-Za-z0-9_]*(\.[A-Za-z0-9_]+)+$/;
    const normalizedVars = variables
      .map((v) => ({
        key: v.key.trim(),
        label_ar: v.label_ar.trim(),
        required: Boolean(v.required),
        source: v.source,
        path: String(v.path ?? '').trim(),
        format: (v.format ?? 'text') as TemplateVariableFormat,
        transform: (v.transform ?? 'none') as TemplateVariableTransform,
        defaultValue: String(v.defaultValue ?? '').trim(),
        help_ar: String(v.help_ar ?? '').trim(),
      }))
      .filter((v) => v.key && v.label_ar && keyPattern.test(v.key));

    if (
      normalizedVars.some((v) => {
        if (v.source === 'client' || v.source === 'matter' || v.source === 'org' || v.source === 'user') {
          return !v.path;
        }
        return false;
      })
    ) {
      setError('يرجى تحديد المسار (path) لمصادر الموكل/القضية/المكتب/المستخدم.');
      return;
    }

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
          description: description.trim(),
          preset_code: presetCode || undefined,
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
          value={presetCode}
          onChange={(event) => setPresetCode(event.target.value)}
          className="h-11 w-full rounded-lg border border-brand-border bg-white px-3 outline-none ring-brand-emerald focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
        >
          <option value="">بدون</option>
          {presets.map((preset) => (
            <option key={preset.code} value={preset.code}>
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

      <label className="block space-y-1 text-sm">
        <span className="font-medium text-slate-700 dark:text-slate-200">التصنيف</span>
        <input
          value={category}
          onChange={(event) => setCategory(event.target.value)}
          className="h-11 w-full rounded-lg border border-brand-border px-3 outline-none ring-brand-emerald focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
        />
      </label>

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
                <th className="py-2 text-start font-medium">المسار</th>
                <th className="py-2 text-start font-medium">النوع</th>
                <th className="py-2 text-start font-medium">تحويل</th>
                <th className="py-2 text-start font-medium">مطلوب؟</th>
                <th className="py-2 text-start font-medium">افتراضي</th>
                <th className="py-2 text-start font-medium">مساعدة</th>
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
                              event.target.value === 'client' ||
                              event.target.value === 'matter' ||
                              event.target.value === 'org' ||
                              event.target.value === 'user' ||
                              event.target.value === 'computed'
                                ? (event.target.value as TemplateVariableSource)
                                : 'manual',
                          })
                        }
                        className="h-10 w-full rounded-lg border border-brand-border bg-white px-3 outline-none ring-brand-emerald focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
                      >
                        <option value="manual">يدوي</option>
                        <option value="client">موكل</option>
                        <option value="matter">قضية</option>
                        <option value="org">مكتب</option>
                        <option value="user">مستخدم</option>
                        <option value="computed">محسوب</option>
                      </select>
                    </td>
                    <td className="py-2">
                      <input
                        value={row.path ?? ''}
                        onChange={(event) => updateVariableRow(index, { path: event.target.value })}
                        placeholder={row.source === 'manual' || row.source === 'computed' ? '—' : 'مثال: name'}
                        disabled={row.source === 'manual' || row.source === 'computed'}
                        className="h-10 w-full rounded-lg border border-brand-border px-3 outline-none ring-brand-emerald focus:ring-2 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950"
                      />
                    </td>
                    <td className="py-2">
                      <select
                        value={row.format ?? 'text'}
                        onChange={(event) => updateVariableRow(index, { format: event.target.value as TemplateVariableFormat })}
                        className="h-10 w-full rounded-lg border border-brand-border bg-white px-3 outline-none ring-brand-emerald focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
                      >
                        <option value="text">نص</option>
                        <option value="date">تاريخ</option>
                        <option value="number">رقم</option>
                        <option value="id">معرّف</option>
                      </select>
                    </td>
                    <td className="py-2">
                      <select
                        value={row.transform ?? 'none'}
                        onChange={(event) => updateVariableRow(index, { transform: event.target.value as TemplateVariableTransform })}
                        className="h-10 w-full rounded-lg border border-brand-border bg-white px-3 outline-none ring-brand-emerald focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
                      >
                        <option value="none">بدون</option>
                        <option value="upper">Upper</option>
                        <option value="lower">Lower</option>
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
                      <input
                        value={row.defaultValue ?? ''}
                        onChange={(event) => updateVariableRow(index, { defaultValue: event.target.value })}
                        placeholder={row.source === 'manual' ? 'قيمة افتراضية' : '—'}
                        disabled={row.source !== 'manual'}
                        className="h-10 w-full rounded-lg border border-brand-border px-3 outline-none ring-brand-emerald focus:ring-2 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950"
                      />
                    </td>
                    <td className="py-2">
                      <input
                        value={row.help_ar ?? ''}
                        onChange={(event) => updateVariableRow(index, { help_ar: event.target.value })}
                        placeholder="نص مساعد"
                        className="h-10 w-full rounded-lg border border-brand-border px-3 outline-none ring-brand-emerald focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
                      />
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
                  <td colSpan={10} className="py-4 text-center text-slate-600 dark:text-slate-300">
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
