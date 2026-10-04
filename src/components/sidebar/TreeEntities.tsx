import { ChevronDown, Pencil, Trash2 } from 'lucide-react';
import { PatternChipLabel } from '../ui/PatternDisplay.tsx';
import { IconButton } from '../ui/Button.tsx';
import { getPartitionChipLabel } from '../../domain/schema/grouping.ts';
import type { Entity, SavedQuery } from '../../domain/schema/types.ts';
import { IndexChip, QueryRow, TreeRow } from './utils.tsx';
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
  const { collapsedGroups, term, toggleGroup } = useSidebarTree();
  const groupCollapsed = !term && (collapsedGroups[group.id] ?? false);
  const label = getPartitionChipLabel(group.partitionKey);

  return (
    <div
      className={`animate-cascade ${groupIdx > 0 ? 'mt-2' : ''}`}
      style={{
        animationDelay: `${Math.min(groupIdx * 30, 150)}ms`,
      }}
    >
      <button
        type="button"
        onClick={() => toggleGroup(group.id)}
        aria-expanded={!groupCollapsed}
        aria-label={`${groupCollapsed ? 'Expand' : 'Collapse'} ${label}`}
        className="w-full flex items-center gap-1.5 py-1 pl-2.5 pr-3 bg-transparent border-0 cursor-pointer text-left group"
      >
        <ChevronDown
          width={12}
          height={12}
          aria-hidden="true"
          className={`text-muted shrink-0 transition-transform duration-150 ${groupCollapsed ? '-rotate-90' : 'rotate-0'}`}
        />
        <span className="font-mono text-[11px] flex-1 overflow-hidden text-ellipsis whitespace-nowrap group-hover:brightness-125">
          <PatternChipLabel label={label} />
        </span>
        <span className="text-[11px] text-muted shrink-0 tabular-nums" aria-hidden="true">
          {group.entities.length}
        </span>
      </button>

      {!groupCollapsed &&
        group.entities.map(({ entity, queries }) => (
          <EntityTreeItem key={entity.name} entity={entity} queries={queries} />
        ))}
    </div>
  );
}

function EntityTreeItem({ entity, queries }: { entity: Entity; queries: SavedQuery[] }) {
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
      <TreeRow active={isActive} className="group/entity pl-5">
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
          className="flex items-baseline gap-2 py-1.25 pl-1 flex-1 min-w-0 bg-transparent border-0 cursor-pointer text-left"
        >
          <span
            className={`shrink-0 max-w-[60%] overflow-hidden text-ellipsis whitespace-nowrap text-[13px] ${
              isActive ? 'font-medium text-primary' : 'text-secondary'
            }`}
          >
            {entity.name}
          </span>
          <span className="font-mono text-[11px] flex-1 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">
            <PatternChipLabel label={getPartitionChipLabel(entity.sk)} />
          </span>
        </button>

        <div className="flex items-center gap-0.5 pr-1.5 opacity-0 group-hover/entity:opacity-100 focus-within:opacity-100 transition-opacity shrink-0">
          <IconButton label={`Edit entity ${entity.name}`} onClick={() => onEditEntity(entity.name)}>
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
      </TreeRow>

      {showChildren && (
        <>
          {entity.indexPatterns.map((pattern) => (
            <TreeRow key={`i:${pattern.index}`} active={false} className="pl-10">
              <button
                type="button"
                onClick={() => onSelectIndex(entity.name, pattern.index)}
                aria-label={`Query via index ${pattern.index} on ${entity.name}`}
                className="w-full flex items-center gap-2 py-1 pr-3 bg-transparent border-0 cursor-pointer text-left"
              >
                <IndexChip>{pattern.index}</IndexChip>
                <span className="font-mono text-[11px] flex-1 overflow-hidden text-ellipsis whitespace-nowrap">
                  <PatternChipLabel label={getPartitionChipLabel(pattern.pk)} />
                </span>
              </button>
            </TreeRow>
          ))}

          {queries.map((query) => (
            <QueryRow
              key={`q:${query.id}`}
              query={query}
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
