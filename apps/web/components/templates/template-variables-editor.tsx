'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import type { TemplateVersion, TemplateVersionVariable } from '@/lib/templates';
import { clearDraftVariables, loadDraftVariables, saveDraftVariables } from '@/components/templates/template-draft-storage';

type TemplateVariablesEditorProps = {
  templateId: string;
  latestVersion: TemplateVersion | null;
};

const sourceLabel: Record<TemplateVersionVariable['source'], string> = {
  client: 'موكل',
  matter: 'قضية',
  org: 'مكتب',
  user: 'مستخدم',
  computed: 'محسوب',
  manual: 'يدوي',
};

export function TemplateVariablesEditor({ templateId, latestVersion }: TemplateVariablesEditorProps) {
  const router = useRouter();
  const [variables, setVariables] = useState<TemplateVersionVariable[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (latestVersion) {
      setVariables(Array.isArray(latestVersion.variables) ? latestVersion.variables : []);
      clearDraftVariables(templateId);
      return;
    }

    setVariables(loadDraftVariables(templateId));
  }, [latestVersion, templateId]);

  const hasInvalid = useMemo(() => {
    return variables.some((v) => {
      if (!v.key.trim() || !v.label_ar.trim()) return true;
      if (v.source === 'client' || v.source === 'matter' || v.source === 'org' || v.source === 'user') {
        return !String(v.path ?? '').trim();
      }
      return false;
    });
  }, [variables]);

  function addRow() {
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

  function removeRow(index: number) {
    setVariables((prev) => prev.filter((_, idx) => idx !== index));
  }

  function updateRow(index: number, next: Partial<TemplateVersionVariable>) {
    setVariables((prev) =>
      prev.map((row, idx) => (idx === index ? { ...row, ...next } : row)),
    );
  }

  async function save() {
    setError('');
    setMessage('');

    const normalized = variables.map((v) => ({
      key: v.key.trim(),
      label_ar: v.label_ar.trim(),
      required: Boolean(v.required),
      source: v.source,
      path: String(v.path ?? '').trim(),
      format: (v.format ?? 'text') as any,
      transform: (v.transform ?? 'none') as any,
      defaultValue: String(v.defaultValue ?? '').trim(),
      help_ar: String(v.help_ar ?? '').trim(),
    }));

    const keyPattern = /^[A-Za-z][A-Za-z0-9_]*(\.[A-Za-z0-9_]+)+$/;
    if (normalized.some((v) => !v.key || !v.label_ar || !keyPattern.test(v.key))) {
      setError('يرجى تعبئة جميع الحقول والتأكد من صيغة المفتاح (مثل: client.name).');
      return;
    }

    if (
      normalized.some((v) => {
        if (v.source === 'client' || v.source === 'matter' || v.source === 'org' || v.source === 'user') {
          return !v.path;
        }
        return false;
      })
    ) {
      setError('يرجى تحديد المسار (path) لمصادر الموكل/القضية/المكتب/المستخدم.');
      return;
    }

    const keys = normalized.map((v) => v.key.toLowerCase());
    const unique = new Set(keys);
    if (unique.size !== keys.length) {
      setError('يوجد تكرار في مفاتيح المتغيرات.');
      return;
    }

    // Draft mode: save to local storage until the first version is uploaded.
    if (!latestVersion) {
      saveDraftVariables(templateId, normalized);
      setMessage('تم حفظ المتغيرات. سيتم تطبيقها عند رفع النسخة الأولى.');
      return;
    }

    setBusy(true);
    try {
      const response = await fetch('/app/api/templates/commit-upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          template_id: templateId,
          version_no: latestVersion.version_no,
          storage_path: latestVersion.storage_path,
          file_name: latestVersion.file_name,
          file_size: latestVersion.file_size,
          mime_type: latestVersion.mime_type || '',
          variables: normalized,
        }),
      });

      const json = (await response.json().catch(() => ({}))) as any;
      if (!response.ok) {
        setError(String(json?.error ?? 'تعذر حفظ المتغيرات.'));
        return;
      }

      setMessage('تم تحديث متغيرات القالب.');
      router.refresh();
    } catch {
      setError('تعذر حفظ المتغيرات.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      {!latestVersion ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
          لم يتم رفع نسخة بعد. يمكنك تجهيز المتغيرات الآن وسيتم حفظها محليًا ثم تطبيقها عند رفع النسخة الأولى.
        </p>
      ) : null}

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

      <div className="overflow-x-auto">
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
                      onChange={(event) => updateRow(index, { key: event.target.value })}
                      placeholder="مثال: client.name"
                      className="h-10 w-full rounded-lg border border-brand-border px-3 outline-none ring-brand-emerald focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
                    />
                  </td>
                  <td className="py-2">
                    <input
                      value={row.label_ar}
                      onChange={(event) => updateRow(index, { label_ar: event.target.value })}
                      placeholder="مثال: اسم الموكل"
                      className="h-10 w-full rounded-lg border border-brand-border px-3 outline-none ring-brand-emerald focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
                    />
                  </td>
                  <td className="py-2">
                    <select
                      value={row.source}
                      onChange={(event) =>
                        updateRow(index, {
                          source:
                            event.target.value === 'client' ||
                            event.target.value === 'matter' ||
                            event.target.value === 'org' ||
                            event.target.value === 'user' ||
                            event.target.value === 'computed'
                              ? (event.target.value as any)
                              : 'manual',
                        })
                      }
                      className="h-10 w-full rounded-lg border border-brand-border bg-white px-3 outline-none ring-brand-emerald focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
                    >
                      <option value="manual">{sourceLabel.manual}</option>
                      <option value="client">{sourceLabel.client}</option>
                      <option value="matter">{sourceLabel.matter}</option>
                      <option value="org">{sourceLabel.org}</option>
                      <option value="user">{sourceLabel.user}</option>
                      <option value="computed">{sourceLabel.computed}</option>
                    </select>
                  </td>
                  <td className="py-2">
                    <input
                      value={String(row.path ?? '')}
                      onChange={(event) => updateRow(index, { path: event.target.value })}
                      placeholder={row.source === 'manual' || row.source === 'computed' ? '—' : 'مثال: name'}
                      disabled={row.source === 'manual' || row.source === 'computed'}
                      className="h-10 w-full rounded-lg border border-brand-border px-3 outline-none ring-brand-emerald focus:ring-2 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950"
                    />
                  </td>
                  <td className="py-2">
                    <select
                      value={(row.format as any) || 'text'}
                      onChange={(event) => updateRow(index, { format: event.target.value as any })}
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
                      value={(row.transform as any) || 'none'}
                      onChange={(event) => updateRow(index, { transform: event.target.value as any })}
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
                        onChange={(event) => updateRow(index, { required: event.target.checked })}
                        className="h-4 w-4 accent-brand-emerald"
                      />
                      <span className="sr-only">مطلوب</span>
                    </label>
                  </td>
                  <td className="py-2">
                    <input
                      value={String(row.defaultValue ?? '')}
                      onChange={(event) => updateRow(index, { defaultValue: event.target.value })}
                      placeholder={row.source === 'manual' ? 'قيمة افتراضية' : '—'}
                      disabled={row.source !== 'manual'}
                      className="h-10 w-full rounded-lg border border-brand-border px-3 outline-none ring-brand-emerald focus:ring-2 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950"
                    />
                  </td>
                  <td className="py-2">
                    <input
                      value={String(row.help_ar ?? '')}
                      onChange={(event) => updateRow(index, { help_ar: event.target.value })}
                      placeholder="نص مساعد (اختياري)"
                      className="h-10 w-full rounded-lg border border-brand-border px-3 outline-none ring-brand-emerald focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
                    />
                  </td>
                  <td className="py-2">
                    <Button type="button" variant="ghost" size="sm" onClick={() => removeRow(index)} disabled={busy}>
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

      <div className="flex flex-wrap gap-3">
        <Button type="button" variant="outline" size="sm" onClick={addRow} disabled={busy}>
          + إضافة متغير
        </Button>
        <Button type="button" variant="primary" size="sm" onClick={save} disabled={busy || hasInvalid}>
          {busy ? 'جارٍ الحفظ...' : 'حفظ المتغيرات'}
        </Button>
      </div>
    </div>
  );
}
