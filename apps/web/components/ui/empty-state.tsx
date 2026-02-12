import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button';

type EmptyStateProps = {
  title: string;
  message: string;
  backHref?: string;
  backLabel?: string;
};

export function EmptyState({
  title,
  message,
  backHref = '/app',
  backLabel = 'العودة للوحة التحكم',
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
      <h1 className="text-xl font-bold text-brand-navy dark:text-slate-100">{title}</h1>
      <p className="max-w-md text-sm text-slate-600 dark:text-slate-300">{message}</p>
      <Link href={backHref} className={buttonVariants('outline', 'sm')}>
        {backLabel}
      </Link>
    </div>
  );
}

