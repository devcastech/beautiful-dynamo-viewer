import { Palette, Download } from 'lucide-react';
import { Select } from './ui/Select.tsx';
import type { Theme } from '../hooks/useTheme.ts';

interface FooterProps {
  theme: Theme;
  updateAvailable?: boolean;
  onInstallUpdate?: () => void;
}

/** Bottom status bar — extensible (left reserved for future actions), theme switcher on the right. */
export function Footer({ theme, updateAvailable, onInstallUpdate }: FooterProps) {
  return (
    <footer className="shrink-0 flex items-center justify-between gap-3 h-6.5 px-3 border-t border-line bg-surface">
      <div className="flex items-center gap-3">
        {updateAvailable && (
          <button
            type="button"
            onClick={onInstallUpdate}
            className="flex items-center gap-1.5 text-[11px] text-accent hover:underline"
          >
            <Download size={12} aria-hidden="true" />
            Update available — install
          </button>
        )}
      </div>

      <div className="flex items-center gap-1.5">
        <Palette size={12} aria-hidden="true" className="text-muted" />
        <Select
          ariaLabel="Theme"
          value={theme.theme}
          onChange={theme.setTheme}
          options={theme.themes.map((t) => ({ value: t.id, label: t.label }))}
          align="right"
          openUp
          className="py-0.5 text-[11px] border-line-dim"
        />
      </div>
    </footer>
  );
}
