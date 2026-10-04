import type { ReactNode } from 'react';

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  children?: ReactNode;
  actions?: ReactNode;
}

export function EmptyState({ icon, title, children, actions }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center text-center gap-2 px-6 py-10 animate-fade-in">
      {icon && <div className="text-muted mb-1" aria-hidden="true">{icon}</div>}
      <p className="text-[14px] font-medium text-primary m-0">{title}</p>
      {children && <div className="text-xs text-muted leading-relaxed max-w-sm">{children}</div>}
      {actions && <div className="flex items-center gap-2 mt-3">{actions}</div>}
    </div>
  );
}
