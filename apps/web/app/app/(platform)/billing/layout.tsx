import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button';

export default function BillingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-brand-navy dark:text-slate-100">الفوترة</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            عروض الأسعار، الفواتير، والدفعات اليدوية.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link href="/app/billing/invoices" className={buttonVariants('outline', 'sm')}>
            الفواتير
          </Link>
          <Link href="/app/billing/quotes" className={buttonVariants('outline', 'sm')}>
            عروض الأسعار
          </Link>
        </div>
      </header>

      {children}
    </div>
  );
}

