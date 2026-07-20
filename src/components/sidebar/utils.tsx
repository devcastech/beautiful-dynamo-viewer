import { ChevronDown, X, Pencil, Trash2, Bookmark, } from "lucide-react";
import { ReactNode } from "react";
import { SavedQuery } from "../../domain/schema/types";
import { IconButton } from "../ui/Button";

export const Stat = ({ value, label }: { value: number; label: string }) => {
  return (
    <span className="flex items-baseline gap-1" aria-label={`${value} ${label}`}>
      <span aria-hidden="true" className="font-mono text-xs font-semibold text-secondary">{value}</span>
      <span aria-hidden="true" className="font-mono text-[11px] text-muted">{label}</span>
    </span>
  );
}

export const Dot = () => {
  return <span aria-hidden="true" className="text-muted/40 text-[11px]">·</span>;
}

export const SectionHeader = ({
  icon,
  label,
  count,
  open,
  onToggle,
  action,
}: {
  icon: ReactNode;
  label: string;
  count: number;
  open: boolean;
  onToggle: () => void;
  action?: ReactNode;
}) => {
  return (
    <div className="flex items-center gap-1 px-0 py-2 border-b border-line bg-surface shrink-0">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-label={`${open ? 'Collapse' : 'Expand'} ${label} section`}
        className="flex items-center gap-1.5 flex-1 bg-transparent border-0 cursor-pointer text-left rounded p-0.5 hover:text-primary text-muted transition-colors"
      >
        <ChevronDown
        width={11}
        height={11}
        aria-hidden="true"
        className={`shrink-0 transition-transform duration-150 ${open ? 'rotate-0' : '-rotate-90'}`}
        />
        <span aria-hidden="true" className="shrink-0">{icon}</span>
        <span className="micro-label text-[12px] flex-1">{label}</span>
        <span aria-hidden="true" className="font-mono text-[11px] text-muted/70">{count}</span>
      </button>
      {action}
    </div>
  );
}


export const EmptyHint = ({ children }: { children: ReactNode }) => {
  return <div className="px-4 py-5 text-center text-muted text-xs font-ui">{children}</div>;
}


// ---- Saved query row (nested under its entity) ----
export const QueryRow = ({
  query,
  accent,
  isActive,
  isRenaming,
  renameValue,
  onRenameValueChange,
  onStartRename,
  onConfirmRename,
  onCancelRename,
  onSelect,
  onDelete,
}: {
  query: SavedQuery;
  accent: string;
  isActive: boolean;
  isRenaming: boolean;
  renameValue: string;
  onRenameValueChange: (value: string) => void;
  onStartRename: () => void;
  onConfirmRename: () => void;
  onCancelRename: () => void;
  onSelect: () => void;
  onDelete: () => void;
}) => {
  if (isRenaming) {
    return (
      <div className="flex items-center border-l-2 border-l-transparent pl-9">
        <div className="flex items-center gap-1 flex-1 min-w-0 pr-2 py-0.75">
          <input
          value={renameValue}
          onChange={(e) => onRenameValueChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onConfirmRename();
            if (e.key === 'Escape') onCancelRename();
          }}
          autoFocus
          aria-label="Rename query"
          className="flex-1 min-w-0 bg-canvas border border-accent/50 rounded-sm text-primary font-mono text-xs px-2 py-0.75 outline-none"
          spellCheck={false}
          />
          <IconButton label="Confirm rename" onClick={onConfirmRename} disabled={!renameValue.trim()} className="text-accent">
            <span aria-hidden="true">✓</span>
          </IconButton>
          <IconButton label="Cancel rename" onClick={onCancelRename}>
            <X size={12} aria-hidden="true" />
          </IconButton>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`group/q flex items-stretch border-l-2 transition-colors ${
        isActive ? 'bg-accent-dim' : 'border-l-transparent hover:bg-hovered'
        }`}
      style={isActive ? { borderLeftColor: accent } : undefined}
    >
      <button
        type="button"
        onClick={onSelect}
        aria-current={isActive ? 'true' : undefined}
        className="flex items-center gap-0 py-1 pl-9 flex-1 min-w-0 bg-transparent border-0 cursor-pointer text-left"
      >
        <Bookmark size={11} aria-hidden="true" className="shrink-0 mr-1.5" style={{ color: accent }} />
        <span
          className={`flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-[12px] font-ui ${
            isActive ? 'text-accent font-medium' : 'text-secondary'
            }`}
        >
          {query.name}
        </span>
        {query.target !== 'base' && (
          <span
            className="font-mono text-[10px] px-1.25 py-px rounded-0.75 shrink-0 ml-1.5"
            style={{ color: accent, borderColor: `${accent}40`, background: `${accent}10`, border: '1px solid' }}
          >
            {query.target}
          </span>
        )}
      </button>

      <div className="flex items-center gap-0.5 pr-2 opacity-0 group-hover/q:opacity-100 focus-within:opacity-100 transition-opacity shrink-0">
        <IconButton label={`Rename query ${query.name}`} onClick={onStartRename}>
          <Pencil size={11} aria-hidden="true" />
        </IconButton>
        <IconButton label={`Delete query ${query.name}`} danger onClick={onDelete}>
          <Trash2 size={11} aria-hidden="true" />
        </IconButton>
      </div>
    </div>
  );
}
