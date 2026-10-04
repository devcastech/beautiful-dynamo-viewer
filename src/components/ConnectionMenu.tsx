import { useRef, useState } from 'react';
import { ChevronDown, CircleAlert, LoaderCircle } from 'lucide-react';
import { Select } from './ui/Select.tsx';
import { Input } from './ui/Input.tsx';
import { useDismiss } from '../hooks/useDismiss.ts';
import { AWS_REGIONS, type AwsConnection } from '../hooks/useAwsConnection.ts';

interface ConnectionMenuProps {
  aws: AwsConnection;
  tableName: string;
  onTableNameChange: (name: string) => void;
}

export function ConnectionMenu({ aws, tableName, onTableNameChange }: ConnectionMenuProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useDismiss(open, containerRef, () => setOpen(false), triggerRef);

  const regionOptions = AWS_REGIONS.map((r) => ({ value: r, label: r }));
  const profileOptions = aws.profiles.map((p) => ({ value: p, label: p }));
  const status = chipStatus(aws);

  return (
    <div ref={containerRef} className="relative ml-auto">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label="AWS connection"
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center gap-2 px-2.5 py-1 rounded-md border-0 cursor-pointer transition-colors ${
          open ? 'bg-hovered' : 'bg-transparent hover:bg-hovered'
        }`}
      >
        <span className={`text-[12px] truncate max-w-50 ${status.className}`}>
          {status.text}
        </span>
        <ChevronDown
          size={13}
          aria-hidden="true"
          className={`shrink-0 text-muted transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="AWS connection settings"
          className="absolute right-0 top-full mt-1 z-30 w-72 bg-elevated border border-line-dim rounded-lg shadow-xl p-3 flex flex-col gap-3 animate-fade-in"
        >
          <Row label="Table">
            <Input
              aria-label="DynamoDB table name"
              value={tableName}
              onChange={(e) => onTableNameChange(e.target.value)}
              placeholder="table-name"
            />
          </Row>

          <Row label="Region">
            <Select
              ariaLabel="AWS region"
              value={aws.region}
              onChange={(v) => void aws.selectRegion(v)}
              options={regionOptions}
              className="w-full"
            />
          </Row>
          <Row label="Profile">
            <Select
              ariaLabel="AWS profile"
              value={aws.profile ?? ''}
              onChange={(v) => void aws.selectProfile(v)}
              options={profileOptions}
              placeholder={profileOptions.length ? 'Select a profile' : 'No profiles found'}
              disabled={profileOptions.length === 0}
              className="w-full"
            />
          </Row>


          <div className="pt-1 border-t border-line-dim">
            <StatusRow aws={aws} />
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="field-label">{label}</span>
      {children}
    </label>
  );
}

/** Chip label + text color encoding the connection state. */
function chipStatus(aws: AwsConnection): { text: string; className: string } {
  if (aws.status === 'checking') return { text: 'Checking…', className: 'text-muted' };
  if (!aws.profile) return { text: 'Offline', className: 'text-muted' };
  if (aws.status === 'authed') {
    return { text: `${aws.profile} · ${aws.region}`, className: 'text-secondary' };
  }
  // Has a profile but not authenticated → needs action.
  return { text: `${aws.profile} · Sign in`, className: 'text-accent' };
}

function StatusRow({ aws }: { aws: AwsConnection }) {
  if (aws.status === 'checking') {
    return (
      <span className="flex items-center gap-1.5 text-[12px] text-muted" aria-live="polite">
        <LoaderCircle width={11} height={11} className="animate-spin" aria-hidden="true" />
        Checking…
      </span>
    );
  }
  if (!aws.profile) {
    return (
      <span className="text-[12px] text-muted">Select a profile to connect.</span>
    );
  }
  if (aws.status === 'authed') {
    return (
      <span className="text-[12px] text-ok" aria-live="polite">Connected</span>
    );
  }
  return (
    <button
      type="button"
      onClick={() => void aws.ssoLogin()}
      aria-label={`Sign in to AWS profile ${aws.profile}`}
      className="flex items-center gap-1.5 text-[12px] text-accent hover:bg-accent-dim bg-transparent border border-accent-line rounded-md px-2 py-0.75 cursor-pointer transition-colors"
    >
      <CircleAlert width={11} height={11} aria-hidden="true" />
      Sign in
    </button>
  );
}
