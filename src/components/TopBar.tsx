import { useRef } from 'react';
import { CircleAlert, Download, LoaderCircle, Pencil, Plus, Trash2, Upload } from 'lucide-react';
import { OverflowMenu } from './ui/OverflowMenu.tsx';
import { IconButton } from './ui/Button.tsx';
import { Input, Select } from './ui/Input.tsx';
import { AWS_REGIONS, type AwsConnection } from '../hooks/useAwsConnection.ts';
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
        <label htmlFor="schema-selector" className="micro-label shrink-0">schema</label>
        <Select
          id="schema-selector"
          value={activeSchema?.id ?? ''}
          onChange={(e) => onSelectSchema(e.target.value)}
          disabled={schemas.length === 0}
          className="max-w-44"
        >
          {schemas.length === 0 && <option value="">—</option>}
          {schemas.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </Select>
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

      <Divider />

      {/* Connection region — one visual unit: table → region → profile → status */}
      <div
        className="ml-auto flex gap-3 items-center px-3 py-1 rounded-lg border border-line-dim bg-canvas/60"
        role="group"
        aria-label="AWS connection"
      >
        <div className="flex gap-1.5 items-center">
          <label htmlFor="table-name" className="micro-label shrink-0">table</label>
          <Input
            id="table-name"
            value={tableName}
            onChange={(e) => onTableNameChange(e.target.value)}
            className="w-44 py-1"
          />
        </div>

        <div className="flex gap-1.5 items-center">
          <label htmlFor="aws-region" className="micro-label shrink-0">region</label>
          <Select
            id="aws-region"
            value={aws.region}
            onChange={(e) => void aws.selectRegion(e.target.value)}
            className="py-1"
          >
            {AWS_REGIONS.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </Select>
        </div>

        <div className="flex gap-1.5 items-center">
          <label htmlFor="aws-profile" className="micro-label shrink-0">profile</label>
          <Select
            id="aws-profile"
            value={aws.profile ?? ''}
            onChange={(e) => void aws.selectProfile(e.target.value)}
            className="py-1"
          >
            <option value="">— select —</option>
            {aws.profiles.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </Select>
        </div>

        <ConnectionStatus aws={aws} />
      </div>
    </header>
  );
}

function Divider() {
  return <div className="w-px h-5 bg-line-dim shrink-0" aria-hidden="true" />;
}

function ConnectionStatus({ aws }: { aws: AwsConnection }) {
  if (aws.status === 'checking') {
    return (
      <span className="flex items-center gap-1.5 font-mono text-[11px] text-muted" aria-live="polite">
        <LoaderCircle width={11} height={11} className="animate-spin" aria-hidden="true" />
        checking…
      </span>
    );
  }
  if (!aws.profile) {
    return (
      <span className="flex items-center gap-1.5 font-mono text-[11px] text-muted/60" aria-label="No profile selected">
        <span aria-hidden="true" className="w-[7px] h-[7px] rounded-full bg-muted/40" />
        offline
      </span>
    );
  }
  if (aws.status === 'authed') {
    return (
      <span className="flex items-center gap-1.5 font-mono text-[11px] text-ok" aria-live="polite">
        <span aria-hidden="true" className="w-[7px] h-[7px] rounded-full bg-ok shadow-[0_0_8px_var(--success)]" />
        connected
      </span>
    );
  }
  return (
    <button
      type="button"
      onClick={() => void aws.ssoLogin()}
      aria-label={`Sign in to AWS profile ${aws.profile}`}
      className="flex items-center gap-1 font-mono text-[11px] text-accent hover:bg-accent-dim bg-transparent border border-accent-line rounded-md px-2 py-[3px] cursor-pointer transition-colors"
    >
      <CircleAlert width={11} height={11} aria-hidden="true" />
      sign in
    </button>
  );
}
