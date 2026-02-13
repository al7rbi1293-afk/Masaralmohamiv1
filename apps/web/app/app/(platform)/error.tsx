'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { buttonVariants } from '@/components/ui/button';

type PlatformErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function PlatformError({ error, reset }: PlatformErrorProps) {
  useEffect(() => {
    // Intentionally lightweight; server logs already capture most endpoint errors.
    // eslint-disable-next-line no-console
    console.error('platform_error', error);
  }, [error]);

  return (
    <Card className="p-6">
      <h1 className="text-xl font-bold text-brand-navy dark:text-slate-100">حدث خطأ</h1>
      <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
        تعذر تحميل هذه الصفحة. جرّب إعادة المحاولة، وإذا استمرت المشكلة تواصل معنا.
      </p>

      <div className="mt-5 flex flex-wrap gap-2">
        <button type="button" className={buttonVariants('primary', 'sm')} onClick={() => reset()}>
          إعادة المحاولة
        </button>
        <Link href="/app" className={buttonVariants('outline', 'sm')}>
          العودة للوحة التحكم
        </Link>
      </div>

      {error?.message ? (
        <details className="mt-5 rounded-lg border border-brand-border bg-brand-background px-3 py-2 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-800/40 dark:text-slate-200">
          <summary className="cursor-pointer font-medium">تفاصيل</summary>
          <p className="mt-2 whitespace-pre-wrap">{error.message}</p>
        </details>
      ) : null}
    </Card>
  );
}

