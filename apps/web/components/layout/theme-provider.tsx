'use client';

import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

type Props = {
  children: ReactNode;
};

type Theme = 'light' | 'dark';

type ThemeContextValue = {
  resolvedTheme: Theme;
  setTheme: (theme: Theme) => void;
};

const THEME_STORAGE_KEY = 'masar-theme';

const ThemeContext = createContext<ThemeContextValue | null>(null);

function resolveInitialTheme(): Theme {
  if (typeof window === 'undefined') {
    return 'light';
  }

  const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (storedTheme === 'light' || storedTheme === 'dark') {
    return storedTheme;
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function ThemeProvider({ children }: Props) {
  const [resolvedTheme, setResolvedTheme] = useState<Theme>('light');
  const [hasStoredPreference, setHasStoredPreference] = useState(false);

  useEffect(() => {
    const nextTheme = resolveInitialTheme();
    const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);

    setResolvedTheme(nextTheme);
    setHasStoredPreference(storedTheme === 'light' || storedTheme === 'dark');
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', resolvedTheme === 'dark');
    root.style.colorScheme = resolvedTheme;

    if (hasStoredPreference) {
      window.localStorage.setItem(THEME_STORAGE_KEY, resolvedTheme);
    }
  }, [hasStoredPreference, resolvedTheme]);

  useEffect(() => {
    if (hasStoredPreference) {
      return;
    }

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (event: MediaQueryListEvent) => {
      setResolvedTheme(event.matches ? 'dark' : 'light');
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, [hasStoredPreference]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      resolvedTheme,
      setTheme: (theme) => {
        setHasStoredPreference(true);
        setResolvedTheme(theme);
      },
    }),
    [resolvedTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }

  return context;
}
