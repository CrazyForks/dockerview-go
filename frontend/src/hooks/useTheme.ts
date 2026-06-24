import { useState, useEffect, useCallback } from 'react';

export type Theme = 'light' | 'dark';

function getInitialTheme(): Theme {
  const stored = localStorage.getItem('dockerview-theme');
  if (stored === 'dark' || stored === 'light') return stored;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(theme: Theme) {
  document.documentElement.setAttribute('data-theme', theme);
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(getInitialTheme);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  // Listen for system theme changes when user hasn't set a preference
  useEffect(() => {
    const stored = localStorage.getItem('dockerview-theme');
    if (stored === 'dark' || stored === 'light') return;

    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => {
      const newTheme: Theme = e.matches ? 'dark' : 'light';
      setThemeState(newTheme);
      applyTheme(newTheme);
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState(prev => {
      const next: Theme = prev === 'dark' ? 'light' : 'dark';
      localStorage.setItem('dockerview-theme', next);
      return next;
    });
  }, []);

  return { theme, toggleTheme };
}
