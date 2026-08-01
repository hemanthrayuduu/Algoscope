// Light/dark theme persistence. Applies `data-theme` on <html>; CSS variables
// in global.css react to it.

export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'algoscope-theme';

export function getInitialTheme(): Theme {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'light' || stored === 'dark') return stored;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function applyTheme(theme: Theme): void {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem(STORAGE_KEY, theme);
}
