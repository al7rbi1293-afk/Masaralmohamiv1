'use client';

import { useEffect } from 'react';

type GlobalErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    // Keep the fallback lightweight and log client-side for diagnostics.
    // eslint-disable-next-line no-console
    console.error('global_error', error);
  }, [error]);

  return (
    <html lang="ar" dir="rtl">
      <body className="bg-slate-950 text-slate-100">
        <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-start justify-center px-6 py-16">
          <p className="text-sm font-medium text-emerald-300">تعذر تحميل الصفحة</p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight">حدث خطأ غير متوقع</h1>
          <p className="mt-4 max-w-prose text-sm leading-6 text-slate-300">
            تمت محاولة تسجيل الخطأ تلقائياً. أعد المحاولة، وإذا استمرت المشكلة فارجع إلى الصفحة الرئيسية.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => reset()}
              className="rounded-md bg-emerald-500 px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-emerald-400"
            >
              إعادة المحاولة
            </button>
            <a
              href="/"
              className="rounded-md border border-slate-700 px-4 py-2 text-sm font-medium text-slate-100 transition hover:bg-slate-900"
            >
              العودة للرئيسية
            </a>
          </div>

          {error?.message ? (
            <details className="mt-6 w-full rounded-lg border border-slate-800 bg-slate-900/60 px-4 py-3 text-sm text-slate-300">
              <summary className="cursor-pointer font-medium text-slate-100">تفاصيل الخطأ</summary>
              <p className="mt-3 whitespace-pre-wrap">{error.message}</p>
            </details>
          ) : null}
        </main>
      </body>
    </html>
  );
}
