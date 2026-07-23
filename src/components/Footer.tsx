import { Palette, Download } from 'lucide-react';
import { Select } from './ui/Select.tsx';
import type { Theme } from '../hooks/useTheme.ts';
import type { UpdaterState } from '../hooks/useUpdater.ts';

interface FooterProps {
  theme: Theme;
  version?: string;
  updater?: UpdaterState;
}

/** Bottom status bar — version and update status on the left, theme switcher on the right. */
export function Footer({ theme, version, updater }: FooterProps) {
  return (
    <footer className="shrink-0 flex items-center justify-between gap-3 h-6.5 px-3 border-t border-line bg-surface">
      <div className="flex items-center gap-3">
        {version && (
          <span
            className="text-[11px] text-muted font-mono tabular-nums"
            title="App version"
          >
            v{version}
          </span>
        )}

        {updater?.status === 'available' && (
          <button
            type="button"
            onClick={() => void updater.install()}
            className="flex items-center gap-1.5 text-[11px] text-accent hover:underline"
          >
            <Download size={12} aria-hidden="true" />
            {updater.update?.version} available - install
          </button>
        )}

        {updater?.status === 'downloading' && (
          <div className="flex items-center gap-2 text-[11px] text-muted">
            <span>Updating… {updater.progress?.percent ?? 0}%</span>
            <div className="w-24 h-1 rounded bg-line overflow-hidden">
              <div
                className="h-full bg-accent transition-all"
                style={{ width: `${updater.progress?.percent ?? 0}%` }}
              />
            </div>
          </div>
        )}

        {updater?.status === 'error' && (
          <span className="text-[11px] text-muted">Update check failed</span>
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
