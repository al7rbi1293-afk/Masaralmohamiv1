'use client';

import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <button
        type="button"
        className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-brand-border bg-white"
        aria-label="تبديل النمط"
      />
    );
  }

  const isDark = resolvedTheme === 'dark';

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-brand-border bg-white text-brand-navy transition hover:bg-brand-navy/5 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
      aria-label="تبديل النمط"
      title="تبديل النمط"
    >
      {isDark ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}
