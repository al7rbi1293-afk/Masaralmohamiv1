'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, buttonVariants } from '@/components/ui/button';
import type { TemplateVersionVariable } from '@/lib/templates';

type SelectOption = {
  id: string;
  label: string;
  client_id?: string;
  client_label?: string;
};

type TemplateGenerateModalProps = {
  templateId: string;
  templateName: string;
  variables: TemplateVersionVariable[];
  matters: SelectOption[];
  clients: SelectOption[];
};

type MissingField = {
  key: string;
  label_ar: string;
  help_ar?: string;
  format?: string;
};

export function TemplateGenerateModal({
  templateId,
  templateName,
  variables,
  matters,
  clients,
}: TemplateGenerateModalProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [missing, setMissing] = useState<MissingField[]>([]);

  const [matterId, setMatterId] = useState('');
  const [clientId, setClientId] = useState('');
  const [outputTitle, setOutputTitle] = useState('');
  const [values, setValues] = useState<Record<string, string>>({});

  const selectedMatter = useMemo(
    () => matters.find((m) => m.id === matterId) ?? null,
    [matters, matterId],
  );

  const effectiveClientId = selectedMatter?.client_id ? String(selectedMatter.client_id) : clientId;
  const effectiveClientLabel = selectedMatter?.client_label || '';

  const requiredClient = useMemo(
    () => variables.some((v) => v.required && v.source === 'client'),
    [variables],
  );
  const requiredMatter = useMemo(
    () => variables.some((v) => v.required && v.source === 'matter'),
    [variables],
  );

  const manualVariables = useMemo(() => variables.filter((v) => v.source === 'manual'), [variables]);

  useEffect(() => {
    if (!open) return;
    // Prefill defaults for manual fields.
    const defaults: Record<string, string> = {};
    for (const v of manualVariables) {
      const current = String(values[v.key] ?? '');
      if (current) continue;
      const def = String((v as any).defaultValue ?? '').trim();
      if (def) defaults[v.key] = def;
    }
    if (Object.keys(defaults).length) {
      setValues((prev) => ({ ...defaults, ...prev }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function updateValue(key: string, next: string) {
    setValues((prev) => ({ ...prev, [key]: next }));
  }

  function resetForm() {
    setMatterId('');
    setClientId('');
    setOutputTitle('');
    setValues({});
    setError('');
    setMessage('');
    setMissing([]);
  }

  async function submit() {
    setError('');
    setMessage('');

    const trimmedTitle = outputTitle.trim();

    if (requiredMatter && !matterId) {
      setError('اختر قضية لإكمال إنشاء المستند.');
      return;
    }

    if (requiredClient && !effectiveClientId) {
      setError('اختر موكلًا لإكمال إنشاء المستند.');
      return;
    }

    const payloadValues: Record<string, string> = {};
    for (const [key, value] of Object.entries(values)) {
      const cleanKey = String(key || '').trim();
      if (!cleanKey) continue;
      const cleanValue = String(value ?? '').trim();
      if (!cleanValue) continue;
      payloadValues[cleanKey] = cleanValue;
    }

    setBusy(true);
    try {
      const response = await fetch(`/app/api/templates/${templateId}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          matter_id: matterId || null,
          client_id: effectiveClientId || null,
          output_title: trimmedTitle || null,
          manual_values: payloadValues,
        }),
      });

      const json = (await response.json().catch(() => ({}))) as any;
      if (response.status === 422) {
        const missingRequired = Array.isArray(json?.missingRequired) ? (json.missingRequired as string[]) : [];
        const suggested = Array.isArray(json?.suggestedLabels) ? (json.suggestedLabels as any[]) : [];
        const fields: MissingField[] = missingRequired.map((key) => {
          const match = suggested.find((item) => String(item?.key ?? '') === key) ?? null;
          return {
            key,
            label_ar: match?.label_ar ? String(match.label_ar) : key,
            help_ar: match?.help_ar ? String(match.help_ar) : '',
            format: match?.format ? String(match.format) : '',
          };
        });
        setMissing(fields);
        setError(String(json?.error ?? 'يرجى تعبئة الحقول المطلوبة.'));
        return;
      }
      if (!response.ok) {
        setError(String(json?.error ?? 'تعذر إنشاء المستند من القالب.'));
        return;
      }

      const documentId = String(json?.document_id ?? '');
      if (!documentId) {
        setError('تعذر إنشاء المستند من القالب.');
        return;
      }

      setMessage('تم إنشاء المستند من القالب.');
      setOpen(false);
      resetForm();
      router.push(`/app/documents/${documentId}?success=${encodeURIComponent('تم إنشاء المستند من القالب.')}`);
      router.refresh();
    } catch {
      setError('تعذر إنشاء المستند من القالب.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button type="button" variant="primary" size="sm" onClick={() => setOpen(true)}>
        إنشاء مستند من القالب
      </Button>

      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => {
            if (!busy) {
              setOpen(false);
              resetForm();
            }
          }}
        >
          <div
            className="w-full max-w-2xl rounded-xl border border-brand-border bg-white p-5 shadow-panel dark:border-slate-700 dark:bg-slate-900"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold text-brand-navy dark:text-slate-100">إنشاء مستند من القالب</h3>
                <p className="mt-2 text-sm leading-7 text-slate-600 dark:text-slate-300">
                  سيتم إنشاء ملف DOCX وحفظه داخل المستندات. اختر ربطًا اختياريًا ثم أدخل القيم المطلوبة.
                </p>
              </div>
              <button
                type="button"
                className={buttonVariants('ghost', 'sm')}
                onClick={() => {
                  if (!busy) {
                    setOpen(false);
                    resetForm();
                  }
                }}
                disabled={busy}
              >
                إغلاق
              </button>
            </div>

            {error ? (
              <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
                {error}
              </p>
            ) : null}

            {message ? (
              <p className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-200">
                {message}
              </p>
            ) : null}

            <div className="mt-5 grid gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block space-y-1 text-sm">
                  <span className="font-medium text-slate-700 dark:text-slate-200">ربط بقضية (اختياري)</span>
                  <select
                    value={matterId}
                    onChange={(event) => {
                      const next = event.target.value;
                      setMatterId(next);
                      if (!next) {
                        setClientId('');
                      }
                    }}
                    className="h-11 w-full rounded-lg border border-brand-border bg-white px-3 outline-none ring-brand-emerald focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
                  >
                    <option value="">بدون</option>
                    {matters.map((matter) => (
                      <option key={matter.id} value={matter.id}>
                        {matter.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block space-y-1 text-sm">
                  <span className="font-medium text-slate-700 dark:text-slate-200">
                    ربط بموكل (اختياري){' '}
                    {selectedMatter?.client_label ? (
                      <span className="text-xs text-slate-500">(من القضية: {selectedMatter.client_label})</span>
                    ) : null}
                  </span>
                  <select
                    value={effectiveClientId}
                    onChange={(event) => setClientId(event.target.value)}
                    disabled={Boolean(selectedMatter?.client_id)}
                    className="h-11 w-full rounded-lg border border-brand-border bg-white px-3 outline-none ring-brand-emerald focus:ring-2 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950"
                  >
                    <option value="">بدون</option>
                    {clients.map((client) => (
                      <option key={client.id} value={client.id}>
                        {client.label}
                      </option>
                    ))}
                  </select>
                  {!selectedMatter?.client_id && effectiveClientLabel ? (
                    <p className="text-xs text-slate-500">{effectiveClientLabel}</p>
                  ) : null}
                </label>
              </div>

              <div className="rounded-lg border border-brand-border p-4 text-sm text-slate-600 dark:border-slate-700 dark:text-slate-300">
                <p className="font-semibold text-brand-navy dark:text-slate-100">التعبئة التلقائية</p>
                <p className="mt-2 leading-7">
                  سيتم تعبئة بيانات المكتب، واسم المستخدم، وتاريخ اليوم تلقائيًا. أدخل فقط الحقول اليدوية أو أي حقول
                  يطلبها النظام لإكمال إنشاء المستند.
                </p>
              </div>

              <label className="block space-y-1 text-sm">
                <span className="font-medium text-slate-700 dark:text-slate-200">عنوان المستند (اختياري)</span>
                <input
                  value={outputTitle}
                  onChange={(event) => setOutputTitle(event.target.value)}
                  placeholder={templateName}
                  className="h-11 w-full rounded-lg border border-brand-border px-3 outline-none ring-brand-emerald focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
                />
              </label>

              {manualVariables.length ? (
                <div className="rounded-lg border border-brand-border p-4 dark:border-slate-700">
                  <h4 className="font-semibold text-brand-navy dark:text-slate-100">حقول يدوية</h4>
                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                    هذه الحقول لا تُعبّأ تلقائيًا. أدخل ما يلزم منها ثم أنشئ المستند.
                  </p>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {manualVariables.map((v) => (
                      <label key={v.key} className="block space-y-1 text-sm">
                        <span className="font-medium text-slate-700 dark:text-slate-200">
                          {v.label_ar} {v.required ? <span className="text-red-600">*</span> : null}
                        </span>
                        <input
                          value={values[v.key] ?? ''}
                          onChange={(event) => updateValue(v.key, event.target.value)}
                          placeholder={v.key}
                          type={v.format === 'number' ? 'number' : v.format === 'date' ? 'date' : 'text'}
                          className="h-11 w-full rounded-lg border border-brand-border px-3 outline-none ring-brand-emerald focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
                        />
                        {v.help_ar ? <p className="text-xs text-slate-500">{v.help_ar}</p> : null}
                      </label>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  لا توجد متغيرات مطلوبة يدويًا. يمكنك إنشاء المستند مباشرة.
                </p>
              )}

              {missing.length ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/40 dark:bg-amber-950/25">
                  <h4 className="font-semibold text-amber-900 dark:text-amber-100">حقول مطلوبة لإكمال الإنشاء</h4>
                  <p className="mt-2 text-sm text-amber-800 dark:text-amber-200">
                    بعض الحقول المطلوبة لم تُعبّأ تلقائيًا. املأها ثم أعد المحاولة.
                  </p>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {missing.map((field) => (
                      <label key={field.key} className="block space-y-1 text-sm">
                        <span className="font-medium text-amber-900 dark:text-amber-100">
                          {field.label_ar} <span className="text-red-600">*</span>
                        </span>
                        <input
                          value={values[field.key] ?? ''}
                          onChange={(event) => updateValue(field.key, event.target.value)}
                          placeholder={field.key}
                          type={field.format === 'number' ? 'number' : field.format === 'date' ? 'date' : 'text'}
                          className="h-11 w-full rounded-lg border border-amber-200 bg-white px-3 outline-none ring-brand-emerald focus:ring-2 dark:border-amber-900/40 dark:bg-slate-950"
                        />
                        {field.help_ar ? <p className="text-xs text-amber-800/80 dark:text-amber-200/80">{field.help_ar}</p> : null}
                      </label>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>

            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="md"
                onClick={() => {
                  if (!busy) {
                    setOpen(false);
                    resetForm();
                  }
                }}
                disabled={busy}
              >
                إلغاء
              </Button>
              <button
                type="button"
                className={buttonVariants('primary', 'md')}
                onClick={submit}
                disabled={busy}
              >
                {busy ? 'جارٍ الإنشاء...' : 'إنشاء المستند'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
