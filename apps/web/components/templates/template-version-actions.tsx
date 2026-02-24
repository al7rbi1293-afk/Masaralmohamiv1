'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import type { TemplateVersion, TemplateVersionVariable } from '@/lib/templates';
import { loadDraftVariables } from '@/components/templates/template-draft-storage';

type TemplateVersionActionsProps = {
  templateId: string;
  latestVersion: TemplateVersion | null;
  defaultVariables: TemplateVersionVariable[];
};

export function TemplateVersionActions({ templateId, latestVersion, defaultVariables }: TemplateVersionActionsProps) {
  const router = useRouter();
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const draftVariables = useMemo(() => loadDraftVariables(templateId), [templateId]);
  const effectiveVariables = defaultVariables.length ? defaultVariables : draftVariables;

  async function downloadLatest() {
    if (!latestVersion?.storage_path) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const response = await fetch('/app/api/templates/download-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storage_path: latestVersion.storage_path }),
      });
      const json = (await response.json().catch(() => ({}))) as any;
      if (!response.ok) {
        setError(String(json?.error ?? 'تعذر تجهيز رابط التنزيل.'));
        return;
      }
      const url = String(json?.signedDownloadUrl ?? '');
      if (!url) {
        setError('تعذر تجهيز رابط التنزيل.');
        return;
      }
      window.open(url, '_blank', 'noreferrer');
    } catch {
      setError('تعذر تجهيز رابط التنزيل.');
    } finally {
      setBusy(false);
    }
  }

  async function uploadNewVersion() {
    setError('');
    setMessage('');

    if (!uploadFile) {
      setError('يرجى اختيار ملف.');
      return;
    }

    setBusy(true);
    try {
      const uploadUrlResponse = await fetch('/app/api/templates/upload-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          template_id: templateId,
          file_name: uploadFile.name,
          file_size: uploadFile.size,
          mime_type: uploadFile.type,
          variables: effectiveVariables,
        }),
      });

      const uploadJson = (await uploadUrlResponse.json().catch(() => ({}))) as any;
      if (!uploadUrlResponse.ok) {
        setError(String(uploadJson?.error ?? 'تعذر رفع الملف. تحقق من الاتصال.'));
        return;
      }

      const bucket = String(uploadJson.bucket ?? 'templates');
      const storagePath = String(uploadJson.storage_path ?? '');
      const versionNo = Number(uploadJson.version_no ?? 1);
      const token = String(uploadJson.token ?? '');
      const signedUrl = String(uploadJson.signedUrl ?? '');

      if (!storagePath || !token || !signedUrl) {
        setError('تعذر رفع الملف. تحقق من الاتصال.');
        return;
      }

      const supabase = getSupabaseBrowserClient();
      const storageApi: any = supabase.storage.from(bucket);

      let uploadOk = false;
      if (typeof storageApi.uploadToSignedUrl === 'function') {
        const { error: uploadError } = await storageApi.uploadToSignedUrl(storagePath, token, uploadFile, {
          contentType: uploadFile.type || undefined,
        });
        uploadOk = !uploadError;
      } else {
        const putResponse = await fetch(signedUrl, {
          method: 'PUT',
          headers: { 'Content-Type': uploadFile.type || 'application/octet-stream' },
          body: uploadFile,
        });
        uploadOk = putResponse.ok;
      }

      if (!uploadOk) {
        setError('تعذر رفع الملف. تحقق من الاتصال.');
        return;
      }

      const commitResponse = await fetch('/app/api/templates/commit-upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          template_id: templateId,
          version_no: versionNo,
          storage_path: storagePath,
          file_name: uploadFile.name,
          file_size: uploadFile.size,
          mime_type: uploadFile.type,
          variables: effectiveVariables,
        }),
      });

      const commitJson = (await commitResponse.json().catch(() => ({}))) as any;
      if (!commitResponse.ok) {
        setError(String(commitJson?.error ?? 'تعذر حفظ النسخة.'));
        return;
      }

      setMessage('تم رفع نسخة القالب.');
      setUploadFile(null);
      router.refresh();
    } catch {
      setError('تعذر رفع الملف. تحقق من الاتصال.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
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

      <div className="flex flex-wrap gap-3">
        <Button type="button" variant="outline" size="sm" disabled={busy || !latestVersion?.storage_path} onClick={downloadLatest}>
          تنزيل آخر نسخة
        </Button>
      </div>

      <div className="grid gap-3 rounded-lg border border-brand-border p-3 dark:border-slate-700 sm:grid-cols-[1fr_auto]">
        <label className="block">
          <span className="sr-only">رفع نسخة جديدة</span>
          <input
            type="file"
            onChange={(event) => setUploadFile(event.target.files?.[0] ?? null)}
            className="block w-full rounded-lg border border-brand-border bg-white px-3 py-2 text-sm text-slate-700 file:me-3 file:rounded-md file:border-0 file:bg-brand-background file:px-3 file:py-2 file:text-sm file:font-medium file:text-brand-navy hover:file:bg-slate-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:file:bg-slate-800 dark:file:text-slate-100"
          />
        </label>
        <Button type="button" variant="primary" size="sm" disabled={busy || !uploadFile} onClick={uploadNewVersion}>
          {busy ? 'جارٍ الرفع...' : 'رفع نسخة جديدة'}
        </Button>
      </div>
    </div>
  );
}
