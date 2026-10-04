import { Check, X, Pencil, Trash2, Bookmark } from "lucide-react";
import { ReactNode } from "react";
import { SavedQuery } from "../../domain/schema/types";
import { IconButton } from "../ui/Button";

/** Hoverable tree row inset from the panel edge; `active` adds the accent bar. */
export const TreeRow = ({
  active,
  className = "",
  children,
}: {
  active: boolean;
  className?: string;
  children: ReactNode;
}) => {
  return (
    <div
      className={`relative flex items-stretch mx-1.5 rounded-md transition-colors ${
        active ? "bg-hovered" : "hover:bg-hovered/60"
      } ${className}`}
    >
      {active && (
        <span aria-hidden="true" className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-full bg-accent" />
      )}
      {children}
    </div>
  );
};

/** Neutral index badge (GSI1, GSI2…) for tree rows. */
export const IndexChip = ({ children }: { children: ReactNode }) => {
  return (
    <span className="font-mono text-[10px] font-medium text-muted bg-elevated px-1.25 py-px rounded shrink-0">
      {children}
    </span>
  );
};

export const EmptyHint = ({ children }: { children: ReactNode }) => {
  return <div className="px-4 py-5 text-center text-muted text-xs font-ui">{children}</div>;
}


// ---- Saved query row (nested under its entity) ----
export const QueryRow = ({
  query,
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
      <div className="flex items-center gap-1 mx-1.5 pl-10 pr-1.5 py-0.5">
        <input
        value={renameValue}
        onChange={(e) => onRenameValueChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onConfirmRename();
          if (e.key === 'Escape') onCancelRename();
        }}
        autoFocus
        aria-label="Rename query"
        className="flex-1 min-w-0 bg-inset border border-accent/50 rounded text-primary text-[12px] px-2 py-0.75 outline-none"
        spellCheck={false}
        />
        <IconButton label="Confirm rename" onClick={onConfirmRename} disabled={!renameValue.trim()}>
          <Check size={12} aria-hidden="true" />
        </IconButton>
        <IconButton label="Cancel rename" onClick={onCancelRename}>
          <X size={12} aria-hidden="true" />
        </IconButton>
      </div>
    );
  }

  return (
    <TreeRow active={isActive} className="group/q pl-10">
      <button
        type="button"
        onClick={onSelect}
        aria-current={isActive ? 'true' : undefined}
        className="flex items-center gap-2 py-1 flex-1 min-w-0 bg-transparent border-0 cursor-pointer text-left"
      >
        <Bookmark
          size={11}
          aria-hidden="true"
          className={`shrink-0 ${isActive ? 'text-accent' : 'text-muted'}`}
        />
        <span
          className={`flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-[12px] ${
            isActive ? 'text-primary font-medium' : 'text-secondary'
            }`}
        >
          {query.name}
        </span>
        {query.target !== 'base' && <IndexChip>{query.target}</IndexChip>}
      </button>

      <div className="flex items-center gap-0.5 pr-1.5 opacity-0 group-hover/q:opacity-100 focus-within:opacity-100 transition-opacity shrink-0">
        <IconButton label={`Rename query ${query.name}`} onClick={onStartRename}>
          <Pencil size={11} aria-hidden="true" />
        </IconButton>
        <IconButton label={`Delete query ${query.name}`} danger onClick={onDelete}>
          <Trash2 size={11} aria-hidden="true" />
        </IconButton>
      </div>
    </TreeRow>
  );
}
