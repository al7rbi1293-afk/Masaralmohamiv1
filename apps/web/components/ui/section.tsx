import { ReactNode } from 'react';
import { Container } from './container';

type SectionProps = {
  id?: string;
  title?: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
};

export function Section({
  id,
  title,
  subtitle,
  children,
  className = '',
}: SectionProps) {
  return (
    <section id={id} className={`py-14 sm:py-20 ${className}`}>
      <Container>
        {title ? (
          <header className="mb-8 max-w-3xl">
            <h2 className="text-2xl font-bold text-brand-navy sm:text-3xl dark:text-slate-100">
              {title}
            </h2>
            {subtitle ? (
              <p className="mt-3 text-base leading-7 text-slate-600 dark:text-slate-300">
                {subtitle}
              </p>
            ) : null}
          </header>
        ) : null}
        {children}
      </Container>
    </section>
  );
}
