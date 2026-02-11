import { ReactNode } from 'react';

type PortalPageProps = {
  title: string;
  description?: string;
  children: ReactNode;
};

export function PortalPage({ title, description, children }: PortalPageProps) {
  return (
    <section className="rounded-xl2 border border-brand-border bg-white p-6 shadow-panel dark:border-slate-700 dark:bg-slate-900">
      <header className="mb-5 border-b border-brand-border pb-4 dark:border-slate-700">
        <h1 className="text-2xl font-bold text-brand-navy dark:text-slate-100">{title}</h1>
        {description ? (
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{description}</p>
        ) : null}
      </header>
      {children}
    </section>
  );
}
