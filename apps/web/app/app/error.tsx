'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { buttonVariants } from '@/components/ui/button';

type AppErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function AppError({ error, reset }: AppErrorProps) {
  useEffect(() => {
    // The detailed error is logged by Next/Vercel; keep UI message friendly.
    // eslint-disable-next-line no-console
    console.error('app_error_boundary', error);
  }, [error]);

  return (
    <Card className="mx-auto mt-12 max-w-2xl p-6">
      <h1 className="text-xl font-bold text-brand-navy dark:text-slate-100">حدث خطأ غير متوقع</h1>
      <p className="mt-3 text-sm text-slate-700 dark:text-slate-200">
        تعذر تحميل الصفحة. حاول مرة أخرى، وإذا استمرت المشكلة تواصل معنا.
      </p>
      <div className="mt-5 flex flex-wrap gap-2">
        <button type="button" className={buttonVariants('primary', 'sm')} onClick={reset}>
          إعادة المحاولة
        </button>
        <Link href="/app" className={buttonVariants('outline', 'sm')}>
          العودة للوحة التحكم
        </Link>
        <Link href="/contact" className={buttonVariants('outline', 'sm')}>
          تواصل معنا
        </Link>
      </div>
    </Card>
  );
}

