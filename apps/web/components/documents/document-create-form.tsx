'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button, buttonVariants } from '@/components/ui/button';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

type Option = { id: string; label: string };

type DocumentCreateFormProps = {
  matters: Option[];
  clients: Option[];
  initialMatterId?: string;
  initialClientId?: string;
};

export function DocumentCreateForm({
  matters,
  clients,
  initialMatterId = '',
  initialClientId = '',
}: DocumentCreateFormProps) {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [matterId, setMatterId] = useState(initialMatterId);
  const [clientId, setClientId] = useState(initialClientId);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const canSubmit = useMemo(() => title.trim().length >= 2 && !!file && !loading, [title, file, loading]);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError('');

    const normalizedTitle = title.trim();
    if (normalizedTitle.length < 2) {
      setError('العنوان مطلوب ويجب أن لا يقل عن حرفين.');
      return;
    }

    if (!file) {
      setError('يرجى اختيار ملف.');
      return;
    }

    setLoading(true);
    try {
      // 1) Create document record (RLS).
      const createResponse = await fetch('/app/api/documents/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: normalizedTitle,
          matter_id: matterId || null,
          client_id: clientId || null,
        }),
      });

      const createJson = (await createResponse.json().catch(() => ({}))) as any;
      if (!createResponse.ok) {
        setError(String(createJson?.error ?? 'تعذر إنشاء المستند.'));
        return;
      }

      const documentId = String(createJson?.document?.id ?? '');
      if (!documentId) {
        setError('تعذر إنشاء المستند.');
        return;
      }

      // 2) Request signed upload URL/token.
      const uploadUrlResponse = await fetch('/app/api/documents/upload-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          document_id: documentId,
          file_name: file.name,
          file_size: file.size,
          mime_type: file.type,
        }),
      });

      const uploadJson = (await uploadUrlResponse.json().catch(() => ({}))) as any;
      if (!uploadUrlResponse.ok) {
        setError(String(uploadJson?.error ?? 'تعذر رفع الملف. تحقق من الاتصال.'));
        return;
      }

      const bucket = String(uploadJson.bucket ?? 'documents');
      const storagePath = String(uploadJson.storage_path ?? '');
      const versionNo = Number(uploadJson.version_no ?? 1);
      const token = String(uploadJson.token ?? '');
      const signedUrl = String(uploadJson.signedUrl ?? '');

      if (!storagePath || !token || !signedUrl) {
        setError('تعذر رفع الملف. تحقق من الاتصال.');
        return;
      }

      // 3) Upload file using signed URL/token (client side).
      const supabase = getSupabaseBrowserClient();
      const storageApi: any = supabase.storage.from(bucket);

      let uploadOk = false;

      if (typeof storageApi.uploadToSignedUrl === 'function') {
        const { error: uploadError } = await storageApi.uploadToSignedUrl(storagePath, token, file, {
          contentType: file.type || undefined,
        });
        uploadOk = !uploadError;
      } else {
        const putResponse = await fetch(signedUrl, {
          method: 'PUT',
          headers: {
            'Content-Type': file.type || 'application/octet-stream',
          },
          body: file,
        });
        uploadOk = putResponse.ok;
      }

      if (!uploadOk) {
        setError('تعذر رفع الملف. تحقق من الاتصال.');
        return;
      }

      // 4) Commit upload to DB (RLS).
      const commitResponse = await fetch('/app/api/documents/commit-upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          document_id: documentId,
          version_no: versionNo,
          storage_path: storagePath,
          file_name: file.name,
          file_size: file.size,
          mime_type: file.type,
        }),
      });

      const commitJson = (await commitResponse.json().catch(() => ({}))) as any;
      if (!commitResponse.ok) {
        setError(String(commitJson?.error ?? 'تعذر حفظ النسخة.'));
        return;
      }

      router.push(
        `/app/documents/${documentId}?success=${encodeURIComponent('تم إنشاء المستند.')}&success2=${encodeURIComponent(
          'تم رفع النسخة الأولى.',
        )}`,
      );
      router.refresh();
    } catch {
      setError('تعذر رفع الملف. تحقق من الاتصال.');
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
          العنوان <span className="text-red-600">*</span>
        </span>
        <input
          required
          minLength={2}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          className="h-11 w-full rounded-lg border border-brand-border px-3 outline-none ring-brand-emerald focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
        />
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block space-y-1 text-sm">
          <span className="font-medium text-slate-700 dark:text-slate-200">ربط بقضية (اختياري)</span>
          <select
            value={matterId}
            onChange={(event) => setMatterId(event.target.value)}
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
          <span className="font-medium text-slate-700 dark:text-slate-200">ربط بموكل (اختياري)</span>
          <select
            value={clientId}
            onChange={(event) => setClientId(event.target.value)}
            className="h-11 w-full rounded-lg border border-brand-border bg-white px-3 outline-none ring-brand-emerald focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
          >
            <option value="">بدون</option>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="block space-y-1 text-sm">
        <span className="font-medium text-slate-700 dark:text-slate-200">
          ملف <span className="text-red-600">*</span>
        </span>
        <input
          required
          type="file"
          onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          className="block w-full rounded-lg border border-brand-border bg-white px-3 py-2 text-sm text-slate-700 file:me-3 file:rounded-md file:border-0 file:bg-brand-background file:px-3 file:py-2 file:text-sm file:font-medium file:text-brand-navy hover:file:bg-slate-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:file:bg-slate-800 dark:file:text-slate-100"
        />
      </label>

      <div className="flex flex-wrap gap-3">
        <Button type="submit" variant="primary" size="md" disabled={!canSubmit}>
          {loading ? 'جارٍ إنشاء المستند ورفع الملف...' : 'حفظ ورفع'}
        </Button>
        <Link href="/app/documents" className={buttonVariants('outline', 'md')}>
          إلغاء
        </Link>
      </div>
    </form>
  );
}
