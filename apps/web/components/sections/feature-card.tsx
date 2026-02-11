import { ReactNode } from 'react';

type FeatureCardProps = {
  title: string;
  bullets: string[];
  icon?: ReactNode;
};

export function FeatureCard({ title, bullets, icon }: FeatureCardProps) {
  return (
    <article className="rounded-xl2 border border-brand-border bg-white p-6 shadow-panel dark:border-slate-700 dark:bg-slate-900">
      <div className="mb-4 flex items-center gap-2">
        {icon ? <span className="text-brand-emerald">{icon}</span> : null}
        <h3 className="text-lg font-semibold text-brand-navy dark:text-slate-100">{title}</h3>
      </div>
      <ul className="space-y-2 text-sm leading-7 text-slate-700 dark:text-slate-300">
        {bullets.map((item) => (
          <li key={item} className="flex items-start gap-2">
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-emerald" aria-hidden />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </article>
  );
}
