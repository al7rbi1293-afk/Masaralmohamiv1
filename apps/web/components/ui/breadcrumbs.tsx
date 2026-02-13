import Link from 'next/link';

export type BreadcrumbItem = {
  label: string;
  href?: string;
};

type BreadcrumbsProps = {
  items: BreadcrumbItem[];
  className?: string;
};

export function Breadcrumbs({ items, className = '' }: BreadcrumbsProps) {
  if (!items.length) return null;

  return (
    <nav aria-label="مسار التنقل" className={className}>
      <ol className="flex flex-wrap items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          const content =
            item.href && !isLast ? (
              <Link
                href={item.href}
                className="rounded-md px-1 py-0.5 transition hover:bg-brand-background hover:text-brand-navy dark:hover:bg-slate-800 dark:hover:text-slate-100"
              >
                {item.label}
              </Link>
            ) : (
              <span
                aria-current={isLast ? 'page' : undefined}
                className={isLast ? 'font-medium text-slate-700 dark:text-slate-200' : ''}
              >
                {item.label}
              </span>
            );

          return (
            <li key={`${item.label}-${index}`} className="flex items-center gap-2">
              {content}
              {!isLast ? <span aria-hidden="true">/</span> : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

