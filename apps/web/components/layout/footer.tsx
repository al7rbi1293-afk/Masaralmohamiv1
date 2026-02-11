import Link from 'next/link';
import { footerLinks, siteConfig } from '@/lib/site';
import { Container } from '../ui/container';

export function Footer() {
  return (
    <footer className="border-t border-brand-border bg-white py-8 dark:border-slate-700 dark:bg-slate-950">
      <Container className="space-y-4 text-center">
        <nav aria-label="روابط التذييل" className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-sm">
          {footerLinks.map((link, index) => (
            <span key={link.href} className="inline-flex items-center gap-3">
              {index > 0 ? (
                <span className="text-slate-400" aria-hidden>
                  |
                </span>
              ) : null}
              <Link
                href={link.href}
                className="text-slate-600 transition hover:text-brand-navy dark:text-slate-300"
              >
                {link.label}
              </Link>
            </span>
          ))}
        </nav>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          © {new Date().getFullYear()} {siteConfig.nameAr}
        </p>
      </Container>
    </footer>
  );
}
