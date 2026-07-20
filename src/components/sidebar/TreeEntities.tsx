import { ChevronDown, Pencil, Trash2 } from 'lucide-react';
import { PatternChipLabel } from '../ui/PatternDisplay.tsx';
import { IconButton } from '../ui/Button.tsx';
import { getPartitionChipLabel } from '../../domain/schema/grouping.ts';
import type { Entity, SavedQuery } from '../../domain/schema/types.ts';
import { QueryRow } from './utils.tsx';
import { useSidebarTree } from './TreeContext.tsx';

export type TreeGroup = {
  id: string;
  partitionKey: string;
  entities: {
    entity: Entity;
    queries: SavedQuery[];
  }[];
};

export function TreeEntities({ group, groupIdx }: { group: TreeGroup; groupIdx: number }) {
  const { accents, collapsedGroups, term, toggleGroup } = useSidebarTree();
  const accent = accents[group.partitionKey];
  const groupCollapsed = !term && (collapsedGroups[group.id] ?? false);
  const label = getPartitionChipLabel(group.partitionKey);

  return (
    <div
      className="animate-cascade pl-6"
      style={{
        animationDelay: `${Math.min(groupIdx * 30, 150)}ms`,
      }}
    >
      <div
        className={`group flex items-center gap-1.5 py-1.5 pl-0 pr-2 ${groupIdx > 0 ? 'border-t border-t-line-dim' : ''}`}
      >
        <button
          type="button"
          onClick={() => toggleGroup(group.id)}
          aria-expanded={!groupCollapsed}
          aria-label={`${groupCollapsed ? 'Expand' : 'Collapse'} ${label}`}
          className="flex items-center gap-1.5 flex-1 min-w-0 bg-transparent border-0 cursor-pointer text-left rounded hover:bg-hovered"
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
      </div>

      {!groupCollapsed &&
        group.entities.map(({ entity, queries }) => (
          <EntityTreeItem key={entity.name} entity={entity} queries={queries} accent={accent} />
        ))}
    </div>
  );
}

function EntityTreeItem({
  entity,
  queries,
  accent,
}: {
  entity: Entity;
  queries: SavedQuery[];
  accent: string;
}) {
  const {
    selectedEntityName,
    activeQueryId,
    collapsedEntities,
    term,
    toggleEntity,
    onSelectEntity,
    onSelectIndex,
    onSelectQuery,
    onEditEntity,
    onDeleteEntity,
    onDeleteQuery,
    renamingId,
    renameValue,
    onRenameValueChange,
    onStartRename,
    onConfirmRename,
    onCancelRename,
  } = useSidebarTree();
  const isActive = selectedEntityName === entity.name;
  const hasChildren = entity.indexPatterns.length > 0 || queries.length > 0;
  const entityCollapsed = !term && (collapsedEntities[entity.name] ?? false);
  const showChildren = hasChildren && !entityCollapsed;

  return (
    <div>
      <div
        className={`group/entity flex items-stretch border-l-2 pl-6 transition-colors ${
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
          <span className="w-4 shrink-0" aria-hidden="true" />
        )}

        <button
          type="button"
          onClick={() => onSelectEntity(entity.name)}
          aria-current={isActive ? 'true' : undefined}
          className="flex items-center gap-0 py-1.5 flex-1 min-w-0 bg-transparent border-0 cursor-pointer text-left"
        >
          <span className="font-mono text-[11px] text-muted shrink-0 max-w-[45%] overflow-hidden text-ellipsis whitespace-nowrap">
            <PatternChipLabel label={getPartitionChipLabel(entity.sk)} accent={accent} />
          </span>
          <span aria-hidden="true" className="mx-1.5 text-[11px] text-muted/40 shrink-0">
            ·
          </span>
          <span
            className={`flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-[12px] font-ui ${
              isActive ? 'font-semibold text-primary' : 'font-normal text-secondary'
            }`}
          >
            {entity.name}
          </span>
        </button>

        <div className="flex items-center gap-0.5 pr-2 opacity-0 group-hover/entity:opacity-100 focus-within:opacity-100 transition-opacity shrink-0">
          <IconButton
            label={`Edit entity ${entity.name}`}
            onClick={() => onEditEntity(entity.name)}
          >
            <Pencil size={11} aria-hidden="true" />
          </IconButton>
          <IconButton
            label={`Delete entity ${entity.name}`}
            danger
            onClick={() => onDeleteEntity(entity.name)}
          >
            <Trash2 size={11} aria-hidden="true" />
          </IconButton>
        </div>
      </div>

      {showChildren && (
        <>
          {entity.indexPatterns.map((pattern) => (
            <button
              key={`i:${pattern.index}`}
              type="button"
              onClick={() => onSelectIndex(entity.name, pattern.index)}
              aria-label={`Query via index ${pattern.index} on ${entity.name}`}
              className="w-full flex items-center gap-1.5 py-1 pl-9 pr-2 bg-transparent border-0 border-l-2 border-l-transparent cursor-pointer text-left hover:bg-hovered transition-colors"
            >
              <span
                className="font-mono text-[10px] font-semibold px-1.25 py-px rounded-0.75 border shrink-0"
                style={{
                  color: accent,
                  borderColor: `${accent}40`,
                  background: `${accent}10`,
                }}
              >
                {pattern.index}
              </span>
              <span className="font-mono text-[11px] text-muted flex-1 overflow-hidden text-ellipsis whitespace-nowrap">
                <PatternChipLabel label={getPartitionChipLabel(pattern.pk)} accent={accent} />
              </span>
            </button>
          ))}

          {queries.map((query) => (
            <QueryRow
              key={`q:${query.id}`}
              query={query}
              accent={accent}
              isActive={query.id === activeQueryId}
              isRenaming={renamingId === query.id}
              renameValue={renameValue}
              onRenameValueChange={onRenameValueChange}
              onStartRename={() => onStartRename(query)}
              onConfirmRename={() => onConfirmRename(query.id)}
              onCancelRename={onCancelRename}
              onSelect={() => onSelectQuery(query)}
              onDelete={() => onDeleteQuery(query.id)}
            />
          ))}
        </>
      )}
    </div>
  );
}
