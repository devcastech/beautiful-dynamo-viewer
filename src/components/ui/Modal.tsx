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
        className="bg-surface border border-line rounded-xl shadow-2xl flex flex-col overflow-hidden animate-fade-in"
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-line bg-elevated">
          <span className="micro-label text-[12px]">{title}</span>
          <IconButton label="Close" onClick={onClose}>
            <X size={14} aria-hidden="true" />
          </IconButton>
        </div>

        <div className="px-5 py-4 flex flex-col gap-3">{children}</div>

        {footer && (
          <div className="flex justify-end gap-2 px-5 py-3 border-t border-line bg-elevated">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
