import type { InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from 'react';

const FIELD_CLS =
  'bg-canvas border border-line rounded-md text-primary font-mono text-xs px-2 py-[5px] outline-none w-full focus:border-accent/50 transition-colors placeholder:text-muted/50';

export function Input({ className = '', ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input spellCheck={false} className={`${FIELD_CLS} ${className}`} {...rest} />;
}

export function TextArea({ className = '', ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea spellCheck={false} className={`${FIELD_CLS} resize-none ${className}`} {...rest} />;
}

interface FieldProps {
  label: string;
  required?: boolean;
  hint?: string;
  children: ReactNode;
}

export function Field({ label, required, hint, children }: FieldProps) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline gap-1">
        <span className="micro-label">{label}</span>
        {required && <span className="text-accent text-[12px]" aria-hidden="true">*</span>}
      </div>
      {hint && <span className="text-[12px] text-muted/70 font-ui">{hint}</span>}
      {children}
    </div>
  );
}
