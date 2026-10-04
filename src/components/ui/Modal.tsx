import { useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { IconButton } from './Button.tsx';

interface ModalProps {
  title: string;
  onClose: () => void;
  footer?: ReactNode;
  children: ReactNode;
  width?: number;
}

export function Modal({ title, onClose, footer, children, width = 440 }: ModalProps) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 animate-backdrop-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        style={{ width }}
        className="bg-surface border border-line-dim rounded-xl shadow-2xl flex flex-col overflow-hidden animate-fade-in"
      >
        <div className="flex items-center justify-between px-5 pt-4 pb-1">
          <span className="text-[14px] font-semibold text-primary">{title}</span>
          <IconButton label="Close" onClick={onClose}>
            <X size={14} aria-hidden="true" />
          </IconButton>
        </div>

        <div className="px-5 py-4 flex flex-col gap-3">{children}</div>

        {footer && (
          <div className="flex justify-end gap-2 px-5 py-3 border-t border-line-dim">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
