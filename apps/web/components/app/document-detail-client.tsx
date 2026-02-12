'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { buttonVariants } from '@/components/ui/button';

type VersionRow = {
  id: string;
  version_no: number;
  file_name: string;
  file_size: number;
  mime_type: string | null;
  storage_path: string;
  created_at: string;
};

type DocumentDetailClientProps = {
  documentId: string;
  versions: VersionRow[];
};

export function DocumentDetailClient({ documentId, versions }: DocumentDetailClientProps) {
  const router = useRouter();
  const [shareExpiry, setShareExpiry] = useState<'1h' | '24h' | '7d'>('24h');
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const latest = useMemo(() => versions[0] ?? null, [versions]);

  async function createShare() {
    setError(null);
    setShareUrl(null);

    try {
      const result = await fetch('/app/api/documents/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId, expiresIn: shareExpiry }),
      }).then(async (res) => {
        const payload = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(payload?.message || 'تعذر إنشاء رابط المشاركة.');
        }
        return payload as { shareUrl: string };
      });

      setShareUrl(result.shareUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر إنشاء رابط المشاركة.');
    }
  }

  async function downloadVersion(storagePath: string) {
    setError(null);
    try {
      const result = await fetch('/app/api/documents/download-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storage_path: storagePath }),
      }).then(async (res) => {
        const payload = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(payload?.message || 'تعذر إنشاء رابط التحميل.');
        }
        return payload as { signedDownloadUrl: string };
      });

      window.open(result.signedDownloadUrl, '_blank', 'noopener,noreferrer');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر التحميل.');
    }
  }

  async function uploadNewVersion(file: File) {
    setError(null);

    const upload = await fetch('/app/api/documents/upload-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        documentId,
        fileName: file.name,
        mimeType: file.type,
        fileSize: file.size,
      }),
    }).then(async (res) => {
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload?.message || 'تعذر إنشاء رابط الرفع.');
      }
      return payload as { signedUploadUrl: string; token?: string };
    });

    const uploadHeaders: Record<string, string> = {
      'Content-Type': file.type || 'application/octet-stream',
    };
    if (upload.token) {
      uploadHeaders.Authorization = `Bearer ${upload.token}`;
    }

    const response = await fetch(upload.signedUploadUrl, {
      method: 'PUT',
      headers: uploadHeaders,
      body: file,
    });

    if (!response.ok) {
      throw new Error('تعذر رفع الملف. حاول مرة أخرى.');
    }

    router.refresh();
  }

  return (
    <div className="space-y-5">
      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
          {error}
        </p>
      ) : null}

      <section className="rounded-lg border border-brand-border bg-brand-background p-4 dark:border-slate-700 dark:bg-slate-800">
        <h2 className="text-sm font-semibold text-brand-navy dark:text-slate-100">إجراءات</h2>

        <div className="mt-3 flex flex-wrap gap-2">
          {latest ? (
            <button
              type="button"
              onClick={() => downloadVersion(latest.storage_path)}
              className={buttonVariants('primary', 'sm')}
            >
              تنزيل آخر نسخة
            </button>
          ) : null}

          <label className={`inline-flex cursor-pointer ${buttonVariants('outline', 'sm')}`}>
            <input
              type="file"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                startTransition(() => {
                  uploadNewVersion(file).catch((err) => {
                    setError(err instanceof Error ? err.message : 'تعذر رفع النسخة.');
                  });
                });
              }}
            />
            {isPending ? 'جارٍ رفع نسخة...' : 'رفع نسخة جديدة'}
          </label>
        </div>
      </section>

      <section className="rounded-lg border border-brand-border p-4 dark:border-slate-700">
        <h2 className="text-sm font-semibold text-brand-navy dark:text-slate-100">مشاركة</h2>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <label className="text-sm text-slate-700 dark:text-slate-200">
            المدة:
            <select
              value={shareExpiry}
              onChange={(e) => setShareExpiry(e.target.value as any)}
              className="ms-2 h-10 rounded-lg border border-brand-border bg-white px-2 dark:border-slate-700 dark:bg-slate-950"
            >
              <option value="1h">ساعة</option>
              <option value="24h">24 ساعة</option>
              <option value="7d">7 أيام</option>
            </select>
          </label>
          <button type="button" onClick={createShare} className={buttonVariants('outline', 'sm')}>
            إنشاء رابط
          </button>
        </div>

        {shareUrl ? (
          <div className="mt-3 rounded-lg border border-brand-border bg-brand-background p-3 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
            <p className="font-medium">رابط المشاركة:</p>
            <p dir="ltr" className="mt-1 break-all text-xs text-slate-600 dark:text-slate-300">
              {shareUrl}
            </p>
          </div>
        ) : null}
      </section>

      <section className="rounded-lg border border-brand-border p-4 dark:border-slate-700">
        <h2 className="text-sm font-semibold text-brand-navy dark:text-slate-100">الإصدارات</h2>

        <div className="mt-3 space-y-2 text-sm">
          {versions.length ? (
            versions.map((v) => (
              <article key={v.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-brand-border px-3 py-2 dark:border-slate-700">
                <div>
                  <p className="font-medium text-slate-800 dark:text-slate-100">
                    v{v.version_no} • {v.file_name}
                  </p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    {(v.file_size / 1024 / 1024).toFixed(2)} MB • {new Date(v.created_at).toLocaleString('ar-SA')}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => downloadVersion(v.storage_path)}
                  className={buttonVariants('outline', 'sm')}
                >
                  تنزيل
                </button>
              </article>
            ))
          ) : (
            <p className="text-slate-600 dark:text-slate-300">لا توجد إصدارات بعد.</p>
          )}
        </div>
      </section>
    </div>
  );
}
