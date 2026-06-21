import { useMemo, useState, type ReactNode } from 'react';
import { Bookmark, Boxes, ChevronDown, Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import { IconButton } from './ui/Button.tsx';
import { PatternChipLabel } from './ui/PatternDisplay.tsx';
import {
  accentByPartitionKey,
  buildPartitionGroups,
  getPartitionChipLabel,
} from '../domain/schema/grouping.ts';
import type { Entity, IndexPattern, SavedQuery, TableSchema } from '../domain/schema/types.ts';

interface SidebarProps {
  schema: TableSchema;
  selectedEntityName: string | null;
  activeQueryId: string | null;
  onSelectEntity: (name: string) => void;
  onSelectIndex: (entityName: string, indexName: string) => void;
  onSelectQuery: (query: SavedQuery) => void;
  onAddEntity: (partitionKey: string) => void;
  onEditEntity: (name: string) => void;
  onDeleteEntity: (name: string) => void;
  onRenameQuery: (id: string, name: string) => void;
  onDeleteQuery: (id: string) => void;
}

/** A node in an expanded entity: its index patterns, then its saved queries. */
type EntityChild =
  | { kind: 'index'; pattern: IndexPattern }
  | { kind: 'query'; query: SavedQuery };

export function Sidebar({
  schema,
  selectedEntityName,
  activeQueryId,
  onSelectEntity,
  onSelectIndex,
  onSelectQuery,
  onAddEntity,
  onEditEntity,
  onDeleteEntity,
  onRenameQuery,
  onDeleteQuery,
}: SidebarProps) {
  const [search, setSearch] = useState('');
  const [entitiesOpen, setEntitiesOpen] = useState(true);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [collapsedEntities, setCollapsedEntities] = useState<Record<string, boolean>>({});
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const groups = useMemo(() => buildPartitionGroups(schema), [schema]);
  const accents = useMemo(() => accentByPartitionKey(groups), [groups]);

  const queriesByEntity = useMemo(() => {
    const map: Record<string, SavedQuery[]> = {};
    for (const q of schema.queries) (map[q.entityName] ??= []).push(q);
    for (const key in map) map[key].sort((a, b) => a.name.localeCompare(b.name));
    return map;
  }, [schema.queries]);

  const term = search.trim().toLowerCase();

  // Entities (with their visible queries) grouped by partition, filtered by the search term.
  const tree = useMemo(() => {
    return groups
      .map((group) => ({
        id: group.id,
        partitionKey: group.partitionKey,
        entities: group.entities.reduce<{ entity: Entity; queries: SavedQuery[] }[]>(
          (acc, entity) => {
            const all = queriesByEntity[entity.name] ?? [];
            const entityMatches =
              !term ||
              entity.name.toLowerCase().includes(term) ||
              entity.pk.toLowerCase().includes(term) ||
              entity.sk.toLowerCase().includes(term);
            const matching = term
              ? all.filter(
                  (q) =>
                    q.name.toLowerCase().includes(term) ||
                    q.entityName.toLowerCase().includes(term),
                )
              : all;

            if (entityMatches) acc.push({ entity, queries: all });
            else if (matching.length > 0) acc.push({ entity, queries: matching });
            return acc;
          },
          [],
        ),
      }))
      .filter((group) => group.entities.length > 0);
  }, [groups, term, queriesByEntity]);

  function toggleGroup(id: string) {
    setCollapsedGroups((s) => ({ ...s, [id]: !s[id] }));
  }

  function toggleEntity(name: string) {
    setCollapsedEntities((s) => ({ ...s, [name]: !s[name] }));
  }

  function startRename(query: SavedQuery) {
    setRenamingId(query.id);
    setRenameValue(query.name);
  }

  function confirmRename(id: string) {
    const name = renameValue.trim();
    if (name) onRenameQuery(id, name);
    setRenamingId(null);
  }

  return (
    <nav
      aria-label="Library"
      className="h-full flex flex-col overflow-hidden bg-surface border border-line rounded-xl"
    >
      {/* Header: stats + search */}
      <div className="px-3 pt-3 pb-2 border-b border-line shrink-0 flex flex-col gap-2">
        <div className="flex items-center gap-2" aria-label="Schema statistics">
          <Stat value={schema.entities.length} label="entities" />
          <Dot />
          <Stat value={schema.indexes.length} label="indexes" />
          <Dot />
          <Stat value={schema.queries.length} label="queries" />
        </div>
        <div className="relative">
          <Search
            size={12}
            aria-hidden="true"
            className="absolute left-2 top-1/2 -translate-y-1/2 text-muted/60 pointer-events-none"
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter entities & queries…"
            aria-label="Filter entities and queries"
            spellCheck={false}
            className="w-full bg-canvas border border-line-dim rounded-md text-primary font-mono text-[12px] pl-6 pr-6 py-[5px] outline-none focus:border-accent/50 transition-colors placeholder:text-muted/50"
          />
          {search && (
            <IconButton
              label="Clear filter"
              onClick={() => setSearch('')}
              className="absolute right-1 top-1/2 -translate-y-1/2 p-0.5"
            >
              <X size={11} aria-hidden="true" />
            </IconButton>
          )}
        </div>
      </div>

      {/* --- Entities section (with their saved queries nested) --- */}
      <SectionHeader
        icon={<Boxes size={13} aria-hidden="true" />}
        label="Entities"
        count={schema.entities.length}
        open={entitiesOpen}
        onToggle={() => setEntitiesOpen((o) => !o)}
        action={
          <IconButton label="Add entity" onClick={() => onAddEntity('')}>
            <Plus size={13} aria-hidden="true" />
          </IconButton>
        }
      />

      {entitiesOpen && (
        <div className="overflow-y-auto flex-1 min-h-0">
          {tree.length === 0 ? (
            <EmptyHint>
              {term ? 'Nothing matches the filter.' : (
                <>
                  No entities yet.
                  <span className="block mt-1 text-muted/60">Click + to add one.</span>
                </>
              )}
            </EmptyHint>
          ) : (
            tree.map((group, groupIdx) => {
              const accent = accents[group.partitionKey];
              const groupCollapsed = !term && (collapsedGroups[group.id] ?? false);
              const label = getPartitionChipLabel(group.partitionKey);

              return (
                <div key={group.id} className="animate-cascade" style={{ animationDelay: `${Math.min(groupIdx * 30, 150)}ms` }}>
                  {/* Group header */}
                  <div
                    className={`group flex items-center gap-[6px] py-[6px] pl-3 pr-2 ${groupIdx > 0 ? 'border-t border-t-line-dim' : ''}`}
                  >
                    <button
                      type="button"
                      onClick={() => toggleGroup(group.id)}
                      aria-expanded={!groupCollapsed}
                      aria-label={`${groupCollapsed ? 'Expand' : 'Collapse'} ${label}`}
                      className="flex items-center gap-[6px] flex-1 min-w-0 bg-transparent border-0 cursor-pointer text-left rounded hover:bg-hovered"
                    >
                      <ChevronDown
                        width={12}
                        height={12}
                        aria-hidden="true"
                        className={`text-muted shrink-0 transition-transform duration-150 ${groupCollapsed ? '-rotate-90' : 'rotate-0'}`}
                      />
                      <span className="font-mono text-[12px] text-secondary flex-1 overflow-hidden text-ellipsis whitespace-nowrap">
                        <PatternChipLabel label={label} accent={accent} />
                      </span>
                      <span className="font-mono text-[12px] text-muted shrink-0" aria-hidden="true">
                        {group.entities.length}
                      </span>
                    </button>

                    <IconButton
                      label={`Add entity with partition key ${label}`}
                      onClick={() => onAddEntity(group.partitionKey)}
                      className="opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
                    >
                      <Plus size={12} aria-hidden="true" />
                    </IconButton>
                  </div>

                  {/* Entity rows */}
                  {!groupCollapsed &&
                    group.entities.map(({ entity, queries }) => {
                      const isActive = selectedEntityName === entity.name;
                      const hasChildren = entity.indexPatterns.length > 0 || queries.length > 0;
                      const entityCollapsed = !term && (collapsedEntities[entity.name] ?? false);
                      const showChildren = hasChildren && !entityCollapsed;

                      const children: EntityChild[] = showChildren
                        ? [
                            ...entity.indexPatterns.map((pattern) => ({ kind: 'index', pattern }) as const),
                            ...queries.map((query) => ({ kind: 'query', query }) as const),
                          ]
                        : [];

                      return (
                        <div key={entity.name}>
                          {/* Entity row: chevron toggles children, body selects the entity */}
                          <div
                            className={`group/entity flex items-stretch border-l-2 pl-3 transition-colors ${
                              isActive ? 'bg-accent-dim' : 'border-l-transparent hover:bg-hovered'
                            }`}
                            style={isActive ? { borderLeftColor: accent } : undefined}
                          >
                            {hasChildren ? (
                              <button
                                type="button"
                                onClick={() => toggleEntity(entity.name)}
                                aria-expanded={!entityCollapsed}
                                aria-label={`${entityCollapsed ? 'Expand' : 'Collapse'} ${entity.name}`}
                                className="flex items-center px-0.5 bg-transparent border-0 cursor-pointer text-muted hover:text-secondary shrink-0"
                              >
                                <ChevronDown
                                  width={11}
                                  height={11}
                                  aria-hidden="true"
                                  className={`transition-transform duration-150 ${entityCollapsed ? '-rotate-90' : 'rotate-0'}`}
                                />
                              </button>
                            ) : (
                              <span className="w-[16px] shrink-0" aria-hidden="true" />
                            )}

                            <button
                              type="button"
                              onClick={() => onSelectEntity(entity.name)}
                              aria-current={isActive ? 'true' : undefined}
                              className="flex items-center gap-0 py-[6px] flex-1 min-w-0 bg-transparent border-0 cursor-pointer text-left"
                            >
                              <span className="font-mono text-[11px] text-muted shrink-0 max-w-[45%] overflow-hidden text-ellipsis whitespace-nowrap">
                                <PatternChipLabel label={getPartitionChipLabel(entity.sk)} accent={accent} />
                              </span>
                              <span aria-hidden="true" className="mx-1.5 text-[11px] text-muted/40 shrink-0">·</span>
                              <span className={`flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-[12px] font-ui ${
                                isActive ? 'font-semibold text-primary' : 'font-normal text-secondary'
                              }`}>
                                {entity.name}
                              </span>
                            </button>

                            <div className="flex items-center gap-0.5 pr-2 opacity-0 group-hover/entity:opacity-100 focus-within:opacity-100 transition-opacity shrink-0">
                              <IconButton label={`Edit entity ${entity.name}`} onClick={() => onEditEntity(entity.name)}>
                                <Pencil size={11} aria-hidden="true" />
                              </IconButton>
                              <IconButton label={`Delete entity ${entity.name}`} danger onClick={() => onDeleteEntity(entity.name)}>
                                <Trash2 size={11} aria-hidden="true" />
                              </IconButton>
                            </div>
                          </div>

                          {/* Children: index patterns, then saved queries */}
                          {children.map((child) => {
                            if (child.kind === 'index') {
                              return (
                                <button
                                  key={`i:${child.pattern.index}`}
                                  type="button"
                                  onClick={() => onSelectIndex(entity.name, child.pattern.index)}
                                  aria-label={`Query via index ${child.pattern.index} on ${entity.name}`}
                                  className="w-full flex items-center gap-1.5 py-[4px] pl-9 pr-2 bg-transparent border-0 border-l-2 border-l-transparent cursor-pointer text-left hover:bg-hovered transition-colors"
                                >
                                  <span
                                    className="font-mono text-[10px] font-semibold px-[5px] py-[1px] rounded-[3px] border shrink-0"
                                    style={{ color: accent, borderColor: `${accent}40`, background: `${accent}10` }}
                                  >
                                    {child.pattern.index}
                                  </span>
                                  <span className="font-mono text-[11px] text-muted flex-1 overflow-hidden text-ellipsis whitespace-nowrap">
                                    <PatternChipLabel label={getPartitionChipLabel(child.pattern.pk)} accent={accent} />
                                  </span>
                                </button>
                              );
                            }

                            return (
                              <QueryRow
                                key={`q:${child.query.id}`}
                                query={child.query}
                                accent={accent}
                                isActive={child.query.id === activeQueryId}
                                isRenaming={renamingId === child.query.id}
                                renameValue={renameValue}
                                onRenameValueChange={setRenameValue}
                                onStartRename={() => startRename(child.query)}
                                onConfirmRename={() => confirmRename(child.query.id)}
                                onCancelRename={() => setRenamingId(null)}
                                onSelect={() => onSelectQuery(child.query)}
                                onDelete={() => onDeleteQuery(child.query.id)}
                              />
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
    </nav>
  );
}

// ---- Header primitives ----

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <span className="flex items-baseline gap-1" aria-label={`${value} ${label}`}>
      <span aria-hidden="true" className="font-mono text-xs font-semibold text-secondary">{value}</span>
      <span aria-hidden="true" className="font-mono text-[11px] text-muted">{label}</span>
    </span>
  );
}

function Dot() {
  return <span aria-hidden="true" className="text-muted/40 text-[11px]">·</span>;
}

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
        <span className="micro-label text-[12px] flex-1">{label}</span>
        <span aria-hidden="true" className="font-mono text-[11px] text-muted/70">{count}</span>
      </button>
      {action}
    </div>
  );
}

function EmptyHint({ children }: { children: ReactNode }) {
  return <div className="px-4 py-5 text-center text-muted text-xs font-ui">{children}</div>;
}

// ---- Saved query row (nested under its entity) ----

function QueryRow({
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
}) {
  if (isRenaming) {
    return (
      <div className="flex items-center border-l-2 border-l-transparent pl-9">
        <div className="flex items-center gap-1 flex-1 min-w-0 pr-2 py-[3px]">
          <input
            value={renameValue}
            onChange={(e) => onRenameValueChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onConfirmRename();
              if (e.key === 'Escape') onCancelRename();
            }}
            autoFocus
            aria-label="Rename query"
            className="flex-1 min-w-0 bg-canvas border border-accent/50 rounded-[4px] text-primary font-mono text-xs px-2 py-[3px] outline-none"
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
        className="flex items-center gap-0 py-[4px] pl-9 flex-1 min-w-0 bg-transparent border-0 cursor-pointer text-left"
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
            className="font-mono text-[10px] px-[5px] py-[1px] rounded-[3px] shrink-0 ml-1.5"
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
