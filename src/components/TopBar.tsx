import { useRef } from 'react';
import { Download, Pencil, Plus, Trash2, Upload } from 'lucide-react';
import { OverflowMenu } from './ui/OverflowMenu.tsx';
import { IconButton } from './ui/Button.tsx';
import { Select } from './ui/Select.tsx';
import { ConnectionMenu } from './ConnectionMenu.tsx';
import { type AwsConnection } from '../hooks/useAwsConnection.ts';
import type { TableSchema } from '../domain/schema/types.ts';

interface TopBarProps {
  schemas: TableSchema[];
  activeSchema: TableSchema | null;
  onSelectSchema: (id: string) => void;
  onNewSchema: () => void;
  onEditSchema: () => void;
  onImportSchema: (file: File) => void;
  onExportSchema: () => void;
  onDeleteSchema: () => void;

  /** Effective table name being queried (schema's tableName or a manual override). */
  tableName: string;
  onTableNameChange: (name: string) => void;

  aws: AwsConnection;
}

export function TopBar({
  schemas,
  activeSchema,
  onSelectSchema,
  onNewSchema,
  onEditSchema,
  onImportSchema,
  onExportSchema,
  onDeleteSchema,
  tableName,
  onTableNameChange,
  aws,
}: TopBarProps) {
  const importInputRef = useRef<HTMLInputElement>(null);

  return (
    <header className="flex items-center gap-3 px-4 h-12 shrink-0 border-b border-line-dim bg-surface/60">
      {/* Brand */}
      <div className="flex items-center gap-2 shrink-0">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <rect x="2" y="1" width="12" height="3" rx="1" fill="var(--accent)" opacity="0.9" />
          <rect x="2" y="6" width="12" height="3" rx="1" fill="var(--accent)" opacity="0.55" />
          <rect x="2" y="11" width="12" height="3" rx="1" fill="var(--accent)" opacity="0.3" />
        </svg>
        <span className="font-mono font-semibold text-[13px] text-primary tracking-[0.02em]">
          dynamo<span className="text-accent">.</span>viewer
        </span>
      </div>

      <Divider />

      {/* Schema region */}
      <div className="flex gap-1.5 items-center min-w-0" role="group" aria-label="Schema">
        <span className="micro-label shrink-0">schema</span>
        <Select
          ariaLabel="Active schema"
          value={activeSchema?.id ?? ''}
          onChange={onSelectSchema}
          options={schemas.map((s) => ({ value: s.id, label: s.name }))}
          placeholder="—"
          disabled={schemas.length === 0}
          className="max-w-44"
        />
        <IconButton label="New schema" onClick={onNewSchema} className="p-1.5">
          <Plus size={14} aria-hidden="true" />
        </IconButton>
        <input
          ref={importInputRef}
          type="file"
          accept=".json"
          className="hidden"
          aria-hidden="true"
          tabIndex={-1}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onImportSchema(file);
            e.target.value = '';
          }}
        />
        <OverflowMenu
          ariaLabel="More schema actions"
          items={
            activeSchema
              ? [
                  { label: 'Import from JSON', icon: <Upload size={13} />, onClick: () => importInputRef.current?.click() },
                  { label: 'Edit schema', icon: <Pencil size={13} />, onClick: onEditSchema },
                  { label: 'Export as JSON', icon: <Download size={13} />, onClick: onExportSchema },
                  { label: 'Delete schema', icon: <Trash2 size={13} />, onClick: onDeleteSchema, danger: true },
                ]
              : [
                  { label: 'Import from JSON', icon: <Upload size={13} />, onClick: () => importInputRef.current?.click() },
                ]
          }
        />
      </div>

      <ConnectionMenu aws={aws} tableName={tableName} onTableNameChange={onTableNameChange} />
    </header>
  );
}

function Divider() {
  return <div className="w-px h-5 bg-line-dim shrink-0" aria-hidden="true" />;
}
