import { useRef } from 'react';
import { Check, CircleAlert, Download, LoaderCircle, Pencil, Plus, Trash2, Upload } from 'lucide-react';
import { OverflowMenu } from './OverflowMenu.tsx';
import type { DynamoTable } from '../domain/schema/types.ts';

export const AWS_REGIONS = [
  "us-east-1", "us-east-2", "us-west-1", "us-west-2",
  "ca-central-1",
  "eu-west-1", "eu-west-2", "eu-west-3", "eu-central-1", "eu-north-1",
  "ap-southeast-1", "ap-southeast-2", "ap-northeast-1", "ap-northeast-2",
  "ap-south-1", "sa-east-1",
];

const ICON_BTN =
  "text-muted hover:text-primary hover:bg-elevated bg-transparent border-0 cursor-pointer p-1.5 rounded transition-colors";

interface ConnectionBarProps {
  // Schema
  schemas: DynamoTable[];
  activeSchemaIdx: number;
  activeSchemaName: string | undefined;
  hasActiveSchema: boolean;
  onSelectSchema: (idx: number) => void;
  onNewSchema: () => void;
  onImportSchema: (file: File) => void;
  onEditSchema: () => void;
  onExportSchema: () => void;
  onDeleteSchema: () => void;

  // Connection
  tableName: string;
  onTableNameChange: (name: string) => void;
  region: string;
  onRegionChange: (region: string) => void;
  awsProfiles: string[];
  selectedProfile: string | undefined;
  loginInProgress: boolean;
  authed: boolean;
  onSelectProfile: (profile: string) => void;
  onSsoLogin: () => void;

  // Stats
  entityCount: number;
  gsiCount: number;
  patternCount: number;
}

export function ConnectionBar({
  schemas,
  activeSchemaIdx,
  activeSchemaName,
  hasActiveSchema,
  onSelectSchema,
  onNewSchema,
  onImportSchema,
  onEditSchema,
  onExportSchema,
  onDeleteSchema,
  tableName,
  onTableNameChange,
  region,
  onRegionChange,
  awsProfiles,
  selectedProfile,
  loginInProgress,
  authed,
  onSelectProfile,
  onSsoLogin,
  entityCount,
  gsiCount,
  patternCount,
}: ConnectionBarProps) {
  const importInputRef = useRef<HTMLInputElement>(null);

  return (
    <header className="flex items-center gap-3 px-4 h-12 shrink-0 border-b border-line-dim">
      {/* Brand */}
      <div className="flex items-center gap-2">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <rect x="2" y="1" width="12" height="3" rx="1" fill="var(--accent)" opacity="0.9" />
          <rect x="2" y="6" width="12" height="3" rx="1" fill="var(--accent)" opacity="0.6" />
          <rect x="2" y="11" width="12" height="3" rx="1" fill="var(--accent)" opacity="0.35" />
        </svg>
        <span className="font-mono font-semibold text-[13px] text-primary tracking-[0.02em]">
          dynamo<span className="text-accent">.</span>viewer
        </span>
      </div>

      <Divider />

      {/* Schema region */}
      <div className="flex gap-1.5 items-center" role="group" aria-label="Schema">
        <label htmlFor="schema-selector" className="shrink-0 text-[11px] text-muted font-mono uppercase tracking-[0.06em]">schema</label>
        {schemas.length > 1 ? (
          <select
            id="schema-selector"
            value={activeSchemaIdx}
            onChange={(e) => onSelectSchema(Number(e.target.value))}
            className="bg-elevated border border-line rounded-[5px] text-primary font-mono text-xs px-2 py-[4px] cursor-pointer outline-none"
          >
            {schemas.map((s, i) => (
              <option key={i} value={i}>{s.name}</option>
            ))}
          </select>
        ) : (
          <span id="schema-selector" className="font-mono text-xs text-primary px-2 py-[4px] bg-elevated/60 rounded-[5px]">
            {activeSchemaName ?? "—"}
          </span>
        )}
        <button
          type="button"
          title="New schema"
          aria-label="New schema"
          onClick={onNewSchema}
          className={ICON_BTN}
        >
          <Plus size={14} aria-hidden="true" />
        </button>
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
            hasActiveSchema
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

      {/* Connection region */}
      <div className="flex gap-3 items-center" role="group" aria-label="Connection settings">
        {/* Table name */}
        <div className="flex gap-1.5 items-center">
          <label htmlFor="table-name" className="shrink-0 text-[11px] text-muted font-mono uppercase tracking-[0.06em]">table</label>
          <input
            id="table-name"
            value={tableName}
            onChange={(e) => onTableNameChange(e.target.value)}
            className="bg-elevated border border-line rounded-[5px] text-primary font-mono text-xs px-2 py-[4px] outline-none w-48 focus:border-accent/50 transition-colors"
            spellCheck={false}
          />
        </div>

        {/* Region */}
        <div className="flex gap-1.5 items-center">
          <label htmlFor="aws-region" className="shrink-0 text-[11px] text-muted font-mono uppercase tracking-[0.06em]">region</label>
          <select
            id="aws-region"
            value={region}
            onChange={(e) => onRegionChange(e.target.value)}
            className="bg-elevated border border-line rounded-[5px] text-primary font-mono text-xs px-2 py-[4px] cursor-pointer outline-none"
          >
            {AWS_REGIONS.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>

        {/* Profile + auth status */}
        <div className="flex gap-1.5 items-center">
          <label htmlFor="aws-profile" className="shrink-0 text-[11px] text-muted font-mono uppercase tracking-[0.06em]">profile</label>
          <select
            onChange={(e) => onSelectProfile(e.target.value)}
            name="aws-profile"
            id="aws-profile"
            defaultValue=""
            className="bg-elevated border border-line rounded-[5px] text-primary font-mono text-xs px-2 py-[4px] cursor-pointer outline-none"
          >
            <option value="">— select —</option>
            {awsProfiles.map((p, i) => (
              <option key={p + i} value={p}>{p}</option>
            ))}
          </select>
          <AuthStatusBadge
            profile={selectedProfile}
            loading={loginInProgress}
            authed={authed}
            onLogin={onSsoLogin}
          />
        </div>
      </div>

      {/* Stats */}
      <div className="ml-auto flex gap-3 items-center" role="group" aria-label="Schema statistics">
        <StatPill label="entities" value={entityCount} />
        <StatPill label="GSIs" value={gsiCount} />
        <StatPill label="patterns" value={patternCount} />
      </div>
    </header>
  );
}

function StatPill({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-baseline gap-1" aria-label={`${value} ${label}`}>
      <span aria-hidden="true" className="font-mono text-[13px] font-semibold text-secondary">{value}</span>
      <span aria-hidden="true" className="text-xs text-muted">{label}</span>
    </div>
  );
}

function Divider() {
  return <div className="w-px h-5 bg-line-dim shrink-0" aria-hidden="true" />;
}

function AuthStatusBadge({
  profile,
  loading,
  authed,
  onLogin,
}: {
  profile: string | undefined;
  loading: boolean;
  authed: boolean;
  onLogin: () => void;
}) {
  if (loading) {
    return (
      <div className="flex items-center gap-1 px-2 py-[3px] rounded-[5px] bg-elevated border border-line" aria-live="polite">
        <LoaderCircle width={11} height={11} className="animate-spin text-muted" aria-hidden="true" />
        <span className="font-mono text-[10px] text-muted">checking…</span>
      </div>
    );
  }
  if (!profile) {
    return (
      <span className="font-mono text-[10px] text-muted/60 px-1.5" aria-label="No profile selected">
        not connected
      </span>
    );
  }
  if (authed) {
    return (
      <div className="flex items-center gap-1 px-2 py-[3px] rounded-[5px] bg-[rgba(16,185,129,0.08)] border border-[rgba(16,185,129,0.25)]" aria-live="polite">
        <Check width={11} height={11} className="text-ok" aria-hidden="true" />
        <span className="font-mono text-[10px] text-ok">connected</span>
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={onLogin}
      aria-label={`Sign in to AWS profile ${profile}`}
      className="flex items-center gap-1 font-mono text-[10px] text-accent hover:bg-accent-dim bg-transparent border border-accent-line rounded-[5px] px-2 py-[3px] cursor-pointer transition-colors"
    >
      <CircleAlert width={11} height={11} aria-hidden="true" />
      sign in
    </button>
  );
}
