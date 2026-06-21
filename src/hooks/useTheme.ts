import { useState } from 'react';
import { THEMES, THEME_KEY, storedTheme } from '../themes.ts';

/** Active theme selection, persisted to localStorage and reflected on <html data-theme>. */
export function useTheme() {
  const [theme, setThemeState] = useState<string>(() => storedTheme());

  function setTheme(id: string) {
    setThemeState(id);
    document.documentElement.dataset.theme = id;
    window.localStorage.setItem(THEME_KEY, id);
  }

  return { theme, setTheme, themes: THEMES };
}

export type Theme = ReturnType<typeof useTheme>;
