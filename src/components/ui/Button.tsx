import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'ghost' | 'danger';

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-accent border-accent text-canvas font-semibold hover:shadow-[0_0_16px_var(--accent-glow)]',
  ghost:
    'bg-transparent border-line text-muted hover:text-primary hover:border-line hover:bg-elevated',
  danger:
    'bg-transparent border-line text-err/80 hover:text-err hover:border-err/40 hover:bg-err-dim',
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  icon?: ReactNode;
}

export function Button({ variant = 'ghost', icon, children, className = '', ...rest }: ButtonProps) {
  return (
    <button
      type="button"
      className={`inline-flex items-center gap-1.5 font-mono text-xs px-3 py-1.5 rounded-md border cursor-pointer transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none ${VARIANTS[variant]} ${className}`}
      {...rest}
    >
      {icon && <span aria-hidden="true" className="shrink-0 inline-flex">{icon}</span>}
      {children}
    </button>
  );
}

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  danger?: boolean;
  children: ReactNode;
}

/** Square icon-only button; `label` doubles as tooltip and aria-label. */
export function IconButton({ label, danger = false, children, className = '', ...rest }: IconButtonProps) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      className={`inline-flex items-center justify-center bg-transparent border-0 cursor-pointer p-1 rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
        danger ? 'text-muted hover:text-err' : 'text-muted hover:text-accent'
      } ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
