import { useMemo, useState, type ReactNode } from 'react';
import { Bookmark, Boxes, ChevronDown, Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import { IconButton } from './ui/Button.tsx';
import { PatternChipLabel } from './ui/PatternDisplay.tsx';
import {
  accentByPartitionKey,
  buildPartitionGroups,
  getPartitionChipLabel,
} from '../domain/schema/grouping.ts';
import type { SavedQuery, TableSchema } from '../domain/schema/types.ts';

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
  const [openSections, setOpenSections] = useState({ entities: true, queries: true });
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  const groups = useMemo(() => buildPartitionGroups(schema), [schema]);
  const accents = useMemo(() => accentByPartitionKey(groups), [groups]);

  const term = search.trim().toLowerCase();
  const filteredGroups = useMemo(() => {
    if (!term) return groups;
    return groups
      .map((g) => ({
        ...g,
        entities: g.entities.filter(
          (e) =>
            e.name.toLowerCase().includes(term) ||
            e.pk.toLowerCase().includes(term) ||
            e.sk.toLowerCase().includes(term),
        ),
      }))
      .filter((g) => g.entities.length > 0);
  }, [groups, term]);

  const filteredQueries = useMemo(() => {
    const all = schema.queries;
    if (!term) return all;
    return all.filter(
      (q) => q.name.toLowerCase().includes(term) || q.entityName.toLowerCase().includes(term),
    );
  }, [schema.queries, term]);

  const accentForEntity = (entityName: string): string => {
    const entity = schema.entities.find((e) => e.name === entityName);
    return (entity && accents[entity.pk]) || 'var(--accent)';
  };

  function toggleSection(name: 'entities' | 'queries') {
    setOpenSections((s) => ({ ...s, [name]: !s[name] }));
  }

  function toggleGroup(id: string) {
    setCollapsedGroups((s) => ({ ...s, [id]: !s[id] }));
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

      {/* --- Entities section --- */}
      <SectionHeader
        icon={<Boxes size={13} aria-hidden="true" />}
        label="Entities"
        count={schema.entities.length}
        open={openSections.entities}
        onToggle={() => toggleSection('entities')}
        action={
          <IconButton label="Add entity" onClick={() => onAddEntity('')}>
            <Plus size={13} aria-hidden="true" />
          </IconButton>
        }
      />

      {openSections.entities && (
        <div className="overflow-y-auto border-b border-line-dim shrink-0" style={{ maxHeight: '55%' }}>
          {filteredGroups.length === 0 ? (
            <EmptyHint>
              {term ? 'No entities match the filter.' : (
                <>
                  No entities yet.
                  <span className="block mt-1 text-muted/60">Click + to add one.</span>
                </>
              )}
            </EmptyHint>
          ) : (
            filteredGroups.map((group, groupIdx) => {
              const accent = accents[group.partitionKey];
              const isCollapsed = !term && (collapsedGroups[group.id] ?? false);
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
                              onClick={() => onSelectEntity(entity.name)}
                              aria-current={isActive ? 'true' : undefined}
                              className="flex items-center gap-0 py-[6px] flex-1 min-w-0 bg-transparent border-0 cursor-pointer text-left"
                            >
                              <TreeBranch isLast={isLast && entity.indexPatterns.length === 0} />
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

                          {/* Index rows */}
                          {entity.indexPatterns.map((pattern, patternIdx) => {
                            const isLastPattern = patternIdx === entity.indexPatterns.length - 1;
                            const isFinal = isLast && isLastPattern;
                            return (
                              <button
                                key={pattern.index}
                                type="button"
                                onClick={() => onSelectIndex(entity.name, pattern.index)}
                                aria-label={`Query via index ${pattern.index} on ${entity.name}`}
                                className="w-full flex items-center gap-0 py-[4px] bg-transparent border-0 border-l-2 border-l-transparent cursor-pointer text-left hover:bg-hovered transition-colors"
                              >
                                <TreeBranch isLast={isFinal} />
                                <TreeSubBranch isLast={isLastPattern} />
                                <span
                                  className="font-mono text-[10px] font-semibold px-[5px] py-[1px] rounded-[3px] border shrink-0 mr-1.5"
                                  style={{ color: accent, borderColor: `${accent}40`, background: `${accent}10` }}
                                >
                                  {pattern.index}
                                </span>
                                <span className="font-mono text-[11px] text-muted flex-1 overflow-hidden text-ellipsis whitespace-nowrap">
                                  <PatternChipLabel label={getPartitionChipLabel(pattern.pk)} accent={accent} />
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
        count={schema.queries.length}
        open={openSections.queries}
        onToggle={() => toggleSection('queries')}
      />

      {openSections.queries && (
        <div className="overflow-y-auto flex-1 min-h-0">
          {filteredQueries.length === 0 ? (
            <EmptyHint>{term ? 'No queries match the filter.' : 'No saved queries yet.'}</EmptyHint>
          ) : (
            <SavedQueriesList
              queries={filteredQueries}
              accentForEntity={accentForEntity}
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

// ---- Tree connectors ----

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
  accentForEntity,
  activeQueryId,
  onSelect,
  onRename,
  onDelete,
}: {
  queries: SavedQuery[];
  accentForEntity: (entityName: string) => string;
  activeQueryId: string | null;
  onSelect: (query: SavedQuery) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
}) {
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  function startRename(query: SavedQuery) {
    setRenamingId(query.id);
    setRenameValue(query.name);
  }

  function confirmRename(query: SavedQuery) {
    const name = renameValue.trim();
    if (name) onRename(query.id, name);
    setRenamingId(null);
  }

  return (
    <ul className="flex flex-col py-1 px-1 gap-[1px] m-0 list-none" aria-label="Saved queries">
      {queries.map((query) => {
        const isActive = query.id === activeQueryId;
        const isRenaming = renamingId === query.id;
        const accent = accentForEntity(query.entityName);

        return (
          <li
            key={query.id}
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
                    if (e.key === 'Enter') confirmRename(query);
                    if (e.key === 'Escape') setRenamingId(null);
                  }}
                  autoFocus
                  aria-label="Rename query"
                  className="flex-1 bg-canvas border border-accent/50 rounded-[4px] text-primary font-mono text-xs px-2 py-[3px] outline-none"
                  spellCheck={false}
                />
                <IconButton
                  label="Confirm rename"
                  onClick={() => confirmRename(query)}
                  disabled={!renameValue.trim()}
                  className="text-accent"
                >
                  <span aria-hidden="true">✓</span>
                </IconButton>
                <IconButton label="Cancel rename" onClick={() => setRenamingId(null)}>
                  <X size={12} aria-hidden="true" />
                </IconButton>
              </div>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => onSelect(query)}
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
                    {query.name}
                  </span>
                  <span
                    className="font-mono text-[10px] text-muted/70 truncate max-w-[90px] shrink-0"
                    title={`Entity: ${query.entityName}`}
                  >
                    {query.entityName}
                  </span>
                  {query.target !== 'base' && (
                    <span
                      className="font-mono text-[10px] px-[5px] py-[1px] rounded-[3px] shrink-0"
                      style={{ color: accent, borderColor: `${accent}40`, background: `${accent}10`, border: '1px solid' }}
                    >
                      {query.target}
                    </span>
                  )}
                </button>

                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity shrink-0">
                  <IconButton label={`Rename query ${query.name}`} onClick={() => startRename(query)}>
                    <Pencil size={11} aria-hidden="true" />
                  </IconButton>
                  <IconButton label={`Delete query ${query.name}`} danger onClick={() => onDelete(query.id)}>
                    <Trash2 size={11} aria-hidden="true" />
                  </IconButton>
                </div>
              </>
            )}
          </li>
        );
      })}
    </ul>
  );
}
