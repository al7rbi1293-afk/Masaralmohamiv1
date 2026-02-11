import Link from 'next/link';
import { navLinks, siteConfig } from '@/lib/site';
import { Container } from '../ui/container';
import { buttonVariants } from '../ui/button';
import { ThemeToggle } from './theme-toggle';

export function Navbar() {
  return (
    <header className="sticky top-0 z-40 border-b border-brand-border/80 bg-white/95 backdrop-blur dark:border-slate-700 dark:bg-slate-950/95">
      <Container className="py-3">
        <div className="flex items-center justify-between gap-4">
          <Link
            href="/"
            className="text-lg font-bold tracking-tight text-brand-navy dark:text-slate-100"
          >
            {siteConfig.nameAr}
          </Link>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link href="/contact" className={buttonVariants('primary', 'sm')}>
              جرّب مجانًا
            </Link>
          </div>
        </div>

        <nav
          aria-label="التنقل الرئيسي"
          className="mt-3 flex items-center gap-4 overflow-x-auto pb-1 text-sm md:mt-2 md:justify-center md:overflow-visible md:pb-0"
        >
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="whitespace-nowrap font-medium text-slate-700 transition hover:text-brand-navy dark:text-slate-200"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </Container>
    </header>
  );
}
