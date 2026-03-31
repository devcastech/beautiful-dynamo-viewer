import { useEffect, useRef, useState, type ReactNode } from 'react';
import { X } from 'lucide-react';
import type { DynamoTable } from '../types/schema.ts';

interface SchemaModalProps {
  mode: 'add' | 'edit';
  initial?: DynamoTable;
  onConfirm: (schema: DynamoTable) => void;
  onClose: () => void;
}

export function SchemaModal({ mode, initial, onConfirm, onClose }: SchemaModalProps) {
  const [name, setName] = useState(initial?.name ?? '');
  const [table, setTable] = useState(initial?.table ?? '');
  const [story, setStory] = useState(initial?.story ?? '');
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    nameRef.current?.focus();
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  function handleConfirm() {
    if (!name.trim() || !table.trim()) return;
    onConfirm({
      ...(initial ?? { entities: [] }),
      name: name.trim(),
      table: table.trim(),
      story: story.trim(),
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-surface border border-line rounded-xl shadow-2xl w-[440px] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-line bg-elevated">
          <span className="font-mono text-[11px] font-semibold tracking-[0.1em] uppercase text-muted">
            {mode === 'add' ? 'New Schema' : 'Edit Schema'}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="text-muted hover:text-primary transition-colors cursor-pointer bg-transparent border-0"
          >
            <X size={14} />
          </button>
        </div>

        {/* Form */}
        <div className="px-5 py-4 flex flex-col gap-3">
          <Field label="Schema name" required>
            <input
              ref={nameRef}
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleConfirm(); }}
              placeholder="e.g. MyService Prod"
              className={INPUT_CLS}
              spellCheck={false}
            />
          </Field>

          <Field label="DynamoDB table" required hint="Connection param — actual table name to query">
            <input
              value={table}
              onChange={(e) => setTable(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleConfirm(); }}
              placeholder="e.g. MyServiceTable-prod"
              className={INPUT_CLS}
              spellCheck={false}
            />
          </Field>

          <Field label="Description">
            <textarea
              value={story}
              onChange={(e) => setStory(e.target.value)}
              placeholder="What data lives here and how to read it…"
              rows={3}
              className={`${INPUT_CLS} resize-none`}
              spellCheck={false}
            />
          </Field>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-5 py-3 border-t border-line bg-elevated">
          <button
            type="button"
            onClick={onClose}
            className="font-mono text-xs text-muted hover:text-primary px-3 py-1.5 rounded-[5px] bg-transparent border border-line cursor-pointer transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!name.trim() || !table.trim()}
            className="font-mono text-xs text-primary px-3 py-1.5 rounded-[5px] bg-accent-dim border border-accent-line cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {mode === 'add' ? 'Create' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline gap-1">
        <span className="font-mono text-[11px] font-semibold text-muted uppercase tracking-[0.08em]">
          {label}
        </span>
        {required && <span className="text-accent text-[11px]">*</span>}
      </div>
      {hint && <span className="text-[11px] text-muted/70 font-ui">{hint}</span>}
      {children}
    </div>
  );
}

const INPUT_CLS =
  'bg-canvas border border-line rounded-[5px] text-primary font-mono text-xs px-2 py-[5px] outline-none w-full focus:border-accent/50 transition-colors';
