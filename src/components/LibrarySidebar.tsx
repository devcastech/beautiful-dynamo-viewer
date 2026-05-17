import { useState, type ReactNode } from 'react';
import { Bookmark, Boxes, ChevronDown, Pencil, Plus, Trash2, X } from 'lucide-react';
import type { PartitionGroup, SavedQuery } from '../types/schema.ts';
import { getPartitionChipLabel } from '../utils/warehouse.ts';

const GROUP_ACCENTS = [
  '#F59E0B', '#10B981', '#38BDF8', '#FB923C', '#A78BFA', '#94A3B8',
];

export interface SavedQueryRef {
  query: SavedQuery;
  entityName: string;
  accent?: string;
}

interface LibrarySidebarProps {
  groups: PartitionGroup[];
  savedQueries: SavedQueryRef[];
  selectedEntityName: string | null;
  activeQueryId: string | null;
  onSelectEntity: (groupId: string, entityName: string) => void;
  onSelectGsi?: (groupId: string, entityName: string, gsiName: string) => void;
  onSelectQuery: (entityName: string, query: SavedQuery) => void;
  onAddEntity?: (partitionKey: string) => void;
  onEditEntity?: (groupId: string, entityName: string) => void;
  onDeleteEntity?: (entityName: string) => void;
  onRenameQuery: (entityName: string, queryId: string, name: string) => void;
  onDeleteQuery: (entityName: string, queryId: string) => void;
}

export function LibrarySidebar({
  groups,
  savedQueries,
  selectedEntityName,
  activeQueryId,
  onSelectEntity,
  onSelectGsi,
  onSelectQuery,
  onAddEntity,
  onEditEntity,
  onDeleteEntity,
  onRenameQuery,
  onDeleteQuery,
}: LibrarySidebarProps) {
  const [openSections, setOpenSections] = useState<{ entities: boolean; queries: boolean }>({
    entities: true,
    queries: true,
  });
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  function toggleSection(name: 'entities' | 'queries') {
    setOpenSections((s) => ({ ...s, [name]: !s[name] }));
  }

  function toggleGroup(id: string) {
    setCollapsedGroups((s) => ({ ...s, [id]: !s[id] }));
  }

  const totalEntities = groups.reduce((sum, g) => sum + g.entities.length, 0);

  return (
    <nav
      aria-label="Library"
      className="h-full flex flex-col overflow-hidden bg-surface border border-line rounded-2xl"
    >
      {/* --- Entities section --- */}
      <SectionHeader
        icon={<Boxes size={13} aria-hidden="true" />}
        label="Entities"
        count={totalEntities}
        open={openSections.entities}
        onToggle={() => toggleSection('entities')}
        action={
          onAddEntity ? (
            <SectionAction
              title="Add entity"
              onClick={(e) => { e.stopPropagation(); onAddEntity(''); }}
              icon={<Plus size={13} aria-hidden="true" />}
              label="Add entity"
            />
          ) : null
        }
      />

      {openSections.entities && (
        <div className="overflow-y-auto border-b border-line-dim shrink-0" style={{ maxHeight: '55%' }}>
          {groups.length === 0 ? (
            <EmptyHint>
              No entities yet.
              {onAddEntity && <span className="block mt-1 text-muted/60">Click + to add one.</span>}
            </EmptyHint>
          ) : (
            groups.map((group, groupIdx) => {
              const accent = GROUP_ACCENTS[groupIdx % GROUP_ACCENTS.length];
              const isCollapsed = collapsedGroups[group.id] ?? false;
              const label = getPartitionChipLabel(group.partitionKey);

              return (
                <div key={group.id}>
                  {/* Group header */}
                  <div
                    className={`group flex items-center gap-[6px] py-[6px] pl-3 pr-2 ${groupIdx > 0 ? 'border-t border-t-line-dim' : ''}`}
                  >
                    <button
                      type="button"
                      onClick={() => toggleGroup(group.id)}
                      aria-expanded={!isCollapsed}
                      aria-label={`${isCollapsed ? 'Expand' : 'Collapse'} ${label}`}
                      className="flex items-center gap-[6px] flex-1 min-w-0 bg-transparent border-0 cursor-pointer text-left rounded hover:bg-hovered"
                    >
                      <ChevronDown
                        width={12}
                        height={12}
                        aria-hidden="true"
                        className={`text-muted shrink-0 transition-transform duration-150 ${isCollapsed ? '-rotate-90' : 'rotate-0'}`}
                      />
                      <span
                        aria-hidden="true"
                        className="w-[6px] h-[6px] rounded-full shrink-0"
                        style={{ background: accent }}
                      />
                      <span className="font-mono text-[11px] text-secondary flex-1 overflow-hidden text-ellipsis whitespace-nowrap">
                        {renderPatternLabel(label, accent)}
                      </span>
                      <span className="font-mono text-[11px] text-muted shrink-0" aria-hidden="true">
                        {group.entities.length}
                      </span>
                    </button>

                    {onAddEntity && (
                      <button
                        type="button"
                        title="Add entity with this partition key"
                        aria-label={`Add entity with partition key ${label}`}
                        onClick={() => onAddEntity(group.partitionKey)}
                        className="opacity-0 group-hover:opacity-100 focus:opacity-100 text-muted hover:text-accent bg-transparent border-0 cursor-pointer p-1 rounded transition-opacity"
                      >
                        <Plus size={12} aria-hidden="true" />
                      </button>
                    )}
                  </div>

                  {/* Entities */}
                  {!isCollapsed &&
                    group.entities.map((entity, entityIdx) => {
                      const isActive = selectedEntityName === entity.name;
                      const isLast = entityIdx === group.entities.length - 1;
                      return (
                        <div key={entity.name}>
                          <div
                            className={`group/entity flex items-stretch border-l-2 transition-colors ${
                              isActive ? 'bg-accent-dim' : 'border-l-transparent hover:bg-hovered'
                            }`}
                            style={isActive ? { borderLeftColor: accent } : undefined}
                          >
                            <button
                              type="button"
                              onClick={() => onSelectEntity(group.id, entity.name)}
                              aria-current={isActive ? 'true' : undefined}
                              className="flex items-center gap-0 py-[6px] flex-1 min-w-0 bg-transparent border-0 cursor-pointer text-left"
                            >
                              <TreeBranch isLast={isLast && entity.gsis.length === 0} />
                              <span className="font-mono text-[10px] text-muted shrink-0 max-w-[45%] overflow-hidden text-ellipsis whitespace-nowrap">
                                {renderPatternLabel(entity.sk, accent)}
                              </span>
                              <span aria-hidden="true" className="mx-1.5 text-[10px] text-muted/40 shrink-0">·</span>
                              <span className={`flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-[11px] font-ui ${
                                isActive ? 'font-semibold text-primary' : 'font-normal text-secondary'
                              }`}>
                                {entity.name}
                              </span>
                            </button>

                            {(onEditEntity || onDeleteEntity) && (
                              <div className="flex items-center gap-0.5 pr-2 opacity-0 group-hover/entity:opacity-100 focus-within:opacity-100 transition-opacity shrink-0">
                                {onEditEntity && (
                                  <button
                                    type="button"
                                    title="Edit entity"
                                    aria-label={`Edit entity ${entity.name}`}
                                    onClick={() => onEditEntity(group.id, entity.name)}
                                    className="text-muted hover:text-accent bg-transparent border-0 cursor-pointer p-1 rounded transition-colors"
                                  >
                                    <Pencil size={11} aria-hidden="true" />
                                  </button>
                                )}
                                {onDeleteEntity && (
                                  <button
                                    type="button"
                                    title="Delete entity"
                                    aria-label={`Delete entity ${entity.name}`}
                                    onClick={() => onDeleteEntity(entity.name)}
                                    className="text-muted hover:text-red-400 bg-transparent border-0 cursor-pointer p-1 rounded transition-colors"
                                  >
                                    <Trash2 size={11} aria-hidden="true" />
                                  </button>
                                )}
                              </div>
                            )}
                          </div>

                          {/* GSI rows */}
                          {entity.gsis.map((gsi, gsiIdx) => {
                            const isLastGsi = gsiIdx === entity.gsis.length - 1;
                            const isFinal = isLast && isLastGsi;
                            return (
                              <button
                                key={gsi.name}
                                type="button"
                                onClick={() => onSelectGsi?.(group.id, entity.name, gsi.name)}
                                aria-label={`Query via index ${gsi.name} on ${entity.name}`}
                                className="w-full flex items-center gap-0 py-[4px] bg-transparent border-0 border-l-2 border-l-transparent cursor-pointer text-left hover:bg-hovered transition-colors"
                              >
                                <TreeBranch isLast={isFinal} />
                                <TreeSubBranch isLast={isLastGsi} />
                                <span
                                  className="font-mono text-[9px] font-semibold px-[5px] py-[1px] rounded-[3px] border shrink-0 mr-1.5"
                                  style={{ color: accent, borderColor: `${accent}40`, background: `${accent}10` }}
                                >
                                  {gsi.name}
                                </span>
                                <span className="font-mono text-[10px] text-muted flex-1 overflow-hidden text-ellipsis whitespace-nowrap">
                                  {renderPatternLabel(gsi.pk, accent)}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      );
                    })}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* --- Saved queries section --- */}
      <SectionHeader
        icon={<Bookmark size={12} aria-hidden="true" />}
        label="Saved queries"
        count={savedQueries.length}
        open={openSections.queries}
        onToggle={() => toggleSection('queries')}
      />

      {openSections.queries && (
        <div className="overflow-y-auto flex-1 min-h-0">
          {savedQueries.length === 0 ? (
            <EmptyHint>No saved queries yet.</EmptyHint>
          ) : (
            <SavedQueriesList
              queries={savedQueries}
              activeQueryId={activeQueryId}
              onSelect={onSelectQuery}
              onRename={onRenameQuery}
              onDelete={onDeleteQuery}
            />
          )}
        </div>
      )}
    </nav>
  );
}

// ---- Section primitives ----

function SectionHeader({
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
}) {
  return (
    <div className="flex items-center gap-1 px-3 py-2 border-b border-line bg-surface shrink-0">
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
        <span className="font-mono text-[11px] font-semibold tracking-[0.08em] uppercase flex-1">
          {label}
        </span>
        <span aria-hidden="true" className="font-mono text-[10px] text-muted/70">
          {count}
        </span>
      </button>
      {action}
    </div>
  );
}

function SectionAction({
  title,
  onClick,
  icon,
  label,
}: {
  title: string;
  onClick: (e: React.MouseEvent) => void;
  icon: ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={label}
      onClick={onClick}
      className="text-muted hover:text-accent bg-transparent border-0 cursor-pointer p-1 rounded transition-colors"
    >
      {icon}
    </button>
  );
}

function EmptyHint({ children }: { children: ReactNode }) {
  return (
    <div className="px-4 py-5 text-center text-muted text-xs font-ui">
      {children}
    </div>
  );
}

// ---- Tree helpers ----

function TreeBranch({ isLast }: { isLast: boolean }) {
  return (
    <span aria-hidden="true" className="relative shrink-0 w-[26px] self-stretch">
      <span
        className="absolute left-[14px] top-0 w-px bg-line-dim"
        style={{ bottom: isLast ? '50%' : '0' }}
      />
      <span className="absolute left-[14px] top-1/2 w-[10px] h-px bg-line-dim -translate-y-px" />
    </span>
  );
}

function TreeSubBranch({ isLast }: { isLast: boolean }) {
  return (
    <span aria-hidden="true" className="relative shrink-0 w-[18px] self-stretch">
      <span
        className="absolute left-0 top-0 w-px bg-line-dim"
        style={{ bottom: isLast ? '50%' : '0' }}
      />
      <span className="absolute left-0 top-1/2 w-[10px] h-px bg-line-dim -translate-y-px" />
    </span>
  );
}

// ---- Saved queries list ----

function SavedQueriesList({
  queries,
  activeQueryId,
  onSelect,
  onRename,
  onDelete,
}: {
  queries: SavedQueryRef[];
  activeQueryId: string | null;
  onSelect: (entityName: string, query: SavedQuery) => void;
  onRename: (entityName: string, queryId: string, name: string) => void;
  onDelete: (entityName: string, queryId: string) => void;
}) {
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  function startRename(ref: SavedQueryRef) {
    setRenamingId(ref.query.id);
    setRenameValue(ref.query.name);
  }

  function confirmRename(ref: SavedQueryRef) {
    const name = renameValue.trim();
    if (name) onRename(ref.entityName, ref.query.id, name);
    setRenamingId(null);
  }

  return (
    <ul className="flex flex-col py-1 px-1 gap-[1px]" aria-label="Saved queries">
      {queries.map((ref) => {
        const isActive = ref.query.id === activeQueryId;
        const isRenaming = renamingId === ref.query.id;
        const accent = ref.accent ?? 'var(--accent)';

        return (
          <li
            key={ref.query.id}
            className={`group flex items-center gap-1.5 px-2 py-[5px] rounded-[5px] transition-colors ${
              isActive ? 'bg-accent-dim' : 'hover:bg-hovered'
            }`}
          >
            {isRenaming ? (
              <div className="flex items-center gap-1 flex-1">
                <input
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') confirmRename(ref);
                    if (e.key === 'Escape') setRenamingId(null);
                  }}
                  autoFocus
                  aria-label="Rename query"
                  className="flex-1 bg-canvas border border-accent/50 rounded-[4px] text-primary font-mono text-xs px-2 py-[3px] outline-none"
                  spellCheck={false}
                />
                <button
                  type="button"
                  onClick={() => confirmRename(ref)}
                  disabled={!renameValue.trim()}
                  aria-label="Confirm rename"
                  className="text-accent bg-transparent border-0 cursor-pointer p-1 rounded disabled:opacity-40"
                >
                  <span aria-hidden="true">✓</span>
                </button>
                <button
                  type="button"
                  onClick={() => setRenamingId(null)}
                  aria-label="Cancel rename"
                  className="text-muted hover:text-primary bg-transparent border-0 cursor-pointer p-1 rounded"
                >
                  <X size={12} aria-hidden="true" />
                </button>
              </div>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => onSelect(ref.entityName, ref.query)}
                  aria-current={isActive ? 'true' : undefined}
                  className="flex items-center gap-1.5 flex-1 min-w-0 bg-transparent border-0 cursor-pointer text-left"
                >
                  <span
                    aria-hidden="true"
                    className="w-[5px] h-[5px] rounded-full shrink-0"
                    style={{ background: accent }}
                  />
                  <span
                    className={`flex-1 font-ui text-xs leading-normal truncate ${
                      isActive ? 'text-accent font-medium' : 'text-secondary'
                    }`}
                  >
                    {ref.query.name}
                  </span>
                  <span
                    className="font-mono text-[9px] text-muted/70 truncate max-w-[90px] shrink-0"
                    title={`Entity: ${ref.entityName}`}
                  >
                    {ref.entityName}
                  </span>
                  {ref.query.target !== 'base' && (
                    <span
                      className="font-mono text-[9px] px-[5px] py-[1px] rounded-[3px] shrink-0"
                      style={{ color: accent, borderColor: `${accent}40`, background: `${accent}10`, border: '1px solid' }}
                    >
                      {ref.query.target}
                    </span>
                  )}
                </button>

                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity shrink-0">
                  <button
                    type="button"
                    title="Rename query"
                    aria-label={`Rename query ${ref.query.name}`}
                    onClick={() => startRename(ref)}
                    className="bg-transparent border-0 cursor-pointer p-1 text-muted hover:text-primary rounded transition-colors"
                  >
                    <Pencil size={11} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    title="Delete query"
                    aria-label={`Delete query ${ref.query.name}`}
                    onClick={() => onDelete(ref.entityName, ref.query.id)}
                    className="bg-transparent border-0 cursor-pointer p-1 text-muted hover:text-red-400 rounded transition-colors"
                  >
                    <Trash2 size={11} aria-hidden="true" />
                  </button>
                </div>
              </>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** Render a key pattern with {vars} highlighted in accent color */
function renderPatternLabel(label: string, accent: string) {
  const parts = label.split(/(\{[^}]+\})/g);
  return (
    <span>
      {parts.map((part, i) => {
        const isVar = part.startsWith('{') && part.endsWith('}');
        return (
          <span key={i} style={{ color: isVar ? accent : 'var(--text-muted)' }}>
            {part}
          </span>
        );
      })}
    </span>
  );
}
