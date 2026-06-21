/** Selectable dark themes (Star Wars characters). `id` maps to a [data-theme] block in index.css. */
export interface ThemeDef {
  id: string;
  label: string;
}

export const THEMES: ThemeDef[] = [
  { id: 'chewbacca', label: 'Chewbacca' },
  { id: 'r2d2', label: 'R2-D2' },
  { id: 'c3po', label: 'C-3PO' },
  { id: 'vader', label: 'Darth Vader' },
  { id: 'yoda', label: 'Yoda' },
];

export const THEME_KEY = 'dynamo-viewer.theme';
export const DEFAULT_THEME = 'chewbacca';

/** Resolve the persisted theme, falling back to the default if unknown/missing. */
export function storedTheme(): string {
  const saved = window.localStorage.getItem(THEME_KEY);
  return saved && THEMES.some((t) => t.id === saved) ? saved : DEFAULT_THEME;
}

/** Apply the persisted theme to <html>. Call once before render to avoid a flash. */
export function applyStoredTheme(): void {
  document.documentElement.dataset.theme = storedTheme();
}
