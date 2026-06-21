import { Palette } from 'lucide-react';
import { Select } from './ui/Select.tsx';
import type { Theme } from '../hooks/useTheme.ts';

interface FooterProps {
  theme: Theme;
}

/** Bottom status bar — extensible (left reserved for future actions), theme switcher on the right. */
export function Footer({ theme }: FooterProps) {
  return (
    <footer className="shrink-0 flex items-center justify-between gap-3 h-[26px] px-3 border-t border-line bg-surface">
      {/* Reserved for future quick-access actions (Bruno-style status bar). */}
      <div className="flex items-center gap-3" />

      <div className="flex items-center gap-1.5">
        <Palette size={12} aria-hidden="true" className="text-muted" />
        <Select
          ariaLabel="Theme"
          value={theme.theme}
          onChange={theme.setTheme}
          options={theme.themes.map((t) => ({ value: t.id, label: t.label }))}
          align="right"
          openUp
          className="py-[2px] text-[11px] border-line-dim"
        />
      </div>
    </footer>
  );
}
