import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'ghost' | 'danger';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-accent border-accent text-canvas font-semibold hover:brightness-110',
  ghost: 'bg-transparent border-line-dim text-secondary hover:text-primary hover:bg-hovered',
  danger: 'bg-transparent border-transparent text-err/80 hover:text-err hover:bg-err-dim',
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  icon?: ReactNode;
}

export function Button({ variant = 'ghost', icon, children, className = '', ...rest }: ButtonProps) {
  return (
    <button
      type="button"
      className={`inline-flex items-center gap-1.5 text-[12px] font-medium px-3 py-1.25 rounded-md border cursor-pointer transition-all disabled:opacity-40 disabled:cursor-not-allowed ${VARIANTS[variant]} ${className}`}
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
        danger ? 'text-muted hover:text-err hover:bg-err-dim' : 'text-muted hover:text-primary hover:bg-hovered'
      } ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
