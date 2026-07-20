import { useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { IconButton } from './Button.tsx';

interface DrawerProps {
  title: string;
  subtitle?: string;
  onClose: () => void;
  footer?: ReactNode;
  children: ReactNode;
}

/** Right-side overlay panel for focused editing without losing the workspace behind. */
export function Drawer({ title, subtitle, onClose, footer, children }: DrawerProps) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-40 flex justify-end bg-black/50 animate-backdrop-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="h-full w-120 max-w-[92vw] bg-surface border-l border-line shadow-2xl flex flex-col animate-drawer-in"
      >
        <div className="flex items-center gap-2 px-5 py-3 border-b border-line bg-elevated shrink-0">
          <div className="flex flex-col min-w-0">
            <span className="micro-label text-[12px]">{title}</span>
            {subtitle && (
              <span className="font-mono text-[13px] text-primary truncate">{subtitle}</span>
            )}
          </div>
          <IconButton label="Close" onClick={onClose} className="ml-auto">
            <X size={14} aria-hidden="true" />
          </IconButton>
        </div>

        <div className="flex-1 overflow-y-auto">{children}</div>

        {footer && (
          <div className="flex items-center gap-2 px-5 py-3 border-t border-line bg-elevated shrink-0">
            {footer}
          </div>
        )}
      </aside>
    </div>
  );
}
