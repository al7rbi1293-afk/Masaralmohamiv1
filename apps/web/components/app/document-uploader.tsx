'use client';

import { FormEvent, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { buttonVariants } from '@/components/ui/button';

type MatterOption = {
  id: string;
  title: string;
};

type DocumentUploaderProps = {
  matters: MatterOption[];
  initialMatterId?: string;
};

export function DocumentUploader({ matters, initialMatterId = '' }: DocumentUploaderProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: '',
    folder: '/',
    tags: '',
    matterId: initialMatterId,
  });

  const tagsArray = useMemo(() => {
    return form.tags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)
      .slice(0, 20);
  }, [form.tags]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setShareUrl(null);

    const target = event.currentTarget;
    const fileInput = target.elements.namedItem('file') as HTMLInputElement | null;
    const file = fileInput?.files?.[0] ?? null;

    if (!file) {
      setError('يرجى اختيار ملف للرفع.');
      return;
    }

    if (!form.title.trim()) {
      setError('يرجى إدخال عنوان المستند.');
      return;
    }

    setLoading(true);

    try {
      const created = await fetch('/app/api/documents/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title,
          description: '',
          folder: form.folder,
          tags: tagsArray,
          matterId: form.matterId || '',
          clientId: '',
        }),
      }).then(async (res) => {
        const payload = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(payload?.message || 'تعذر إنشاء المستند.');
        }
        return payload as { documentId: string };
      });

      setCreatedId(created.documentId);

      const upload = await fetch('/app/api/documents/upload-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId: created.documentId,
          fileName: file.name,
          mimeType: file.type,
          fileSize: file.size,
        }),
      }).then(async (res) => {
        const payload = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(payload?.message || 'تعذر إنشاء رابط الرفع.');
        }
        return payload as {
          signedUploadUrl: string;
          token?: string;
          storage_path: string;
          versionNo: number;
        };
      });

      const uploadHeaders: Record<string, string> = {
        'Content-Type': file.type || 'application/octet-stream',
      };
      if (upload.token) {
        uploadHeaders.Authorization = `Bearer ${upload.token}`;
      }

      const uploadResponse = await fetch(upload.signedUploadUrl, {
        method: 'PUT',
        headers: uploadHeaders,
        body: file,
      });

      if (!uploadResponse.ok) {
        throw new Error('تعذر رفع الملف. حاول مرة أخرى.');
      }

      // Optional: Create a quick share link (24h) after upload.
      try {
        const share = await fetch('/app/api/documents/share', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ documentId: created.documentId, expiresIn: '24h' }),
        }).then(async (res) => (res.ok ? res.json() : null));

        if (share?.shareUrl) {
          setShareUrl(share.shareUrl as string);
        }
      } catch {
        // ignore
      }

      router.push(`/app/documents/${created.documentId}?uploaded=1`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'حدث خطأ غير متوقع.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-5">
      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
          {error}
        </p>
      ) : null}

      <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
        <label className="block space-y-1 text-sm sm:col-span-2">
          <span className="font-medium text-slate-700 dark:text-slate-200">عنوان المستند</span>
          <input
            value={form.title}
            onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
            className="h-11 w-full rounded-lg border border-brand-border px-3 outline-none ring-brand-emerald focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
            placeholder="مثال: لائحة دعوى / وكالة / عقد..."
          />
        </label>

        <label className="block space-y-1 text-sm">
          <span className="font-medium text-slate-700 dark:text-slate-200">المجلد</span>
          <input
            value={form.folder}
            onChange={(e) => setForm((prev) => ({ ...prev, folder: e.target.value }))}
            className="h-11 w-full rounded-lg border border-brand-border px-3 outline-none ring-brand-emerald focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
            placeholder="/"
          />
        </label>

        <label className="block space-y-1 text-sm">
          <span className="font-medium text-slate-700 dark:text-slate-200">القضية (اختياري)</span>
          <select
            value={form.matterId}
            onChange={(e) => setForm((prev) => ({ ...prev, matterId: e.target.value }))}
            className="h-11 w-full rounded-lg border border-brand-border bg-white px-3 outline-none ring-brand-emerald focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
          >
            <option value="">بدون ربط</option>
            {matters.map((matter) => (
              <option key={matter.id} value={matter.id}>
                {matter.title}
              </option>
            ))}
          </select>
        </label>

        <label className="block space-y-1 text-sm sm:col-span-2">
          <span className="font-medium text-slate-700 dark:text-slate-200">وسوم (اختياري)</span>
          <input
            value={form.tags}
            onChange={(e) => setForm((prev) => ({ ...prev, tags: e.target.value }))}
            className="h-11 w-full rounded-lg border border-brand-border px-3 outline-none ring-brand-emerald focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
            placeholder="مثال: وكالة, عقد, جلسة"
          />
          <p className="text-xs text-slate-500 dark:text-slate-400">افصل الوسوم بفاصلة.</p>
        </label>

        <label className="block space-y-1 text-sm sm:col-span-2">
          <span className="font-medium text-slate-700 dark:text-slate-200">الملف</span>
          <input
            required
            name="file"
            type="file"
            className="block w-full rounded-lg border border-brand-border bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
          />
        </label>

        <div className="flex flex-wrap gap-3 sm:col-span-2">
          <button type="submit" disabled={loading} className={buttonVariants('primary', 'md')}>
            {loading ? 'جارٍ الرفع...' : 'رفع المستند'}
          </button>
          <button
            type="button"
            onClick={() => router.push('/app/documents')}
            className={buttonVariants('outline', 'md')}
          >
            إلغاء
          </button>
        </div>

        {createdId ? (
          <p className="text-xs text-slate-500 dark:text-slate-400 sm:col-span-2">
            تم إنشاء المستند: <span dir="ltr">{createdId}</span>
          </p>
        ) : null}

        {shareUrl ? (
          <div className="rounded-lg border border-brand-border bg-brand-background p-3 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 sm:col-span-2">
            <p className="font-medium">رابط مشاركة (24 ساعة):</p>
            <p dir="ltr" className="mt-1 break-all text-xs text-slate-600 dark:text-slate-300">
              {shareUrl}
            </p>
          </div>
        ) : null}
      </form>
    </div>
  );
}
