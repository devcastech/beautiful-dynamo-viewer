import { useState } from 'react';
import type { PartitionGroup } from '../types/schema.ts';
import { getPartitionChipLabel } from '../utils/warehouse.ts';
import { ChevronDown, Pencil, Plus, Trash2 } from 'lucide-react';

// Accent colors for partition group headers (deterministic by index)
const GROUP_ACCENTS = [
  '#F59E0B', // amber
  '#10B981', // emerald
  '#38BDF8', // sky
  '#FB923C', // orange
  '#A78BFA', // violet
  '#94A3B8', // slate
];

interface EntityBrowserProps {
  groups: PartitionGroup[];
  selectedEntityByGroup: Record<string, string>;
  onSelect: (groupId: string, entityName: string) => void;
  onSelectGsi?: (groupId: string, entityName: string, gsiName: string) => void;
  onAddEntity?: (partitionKey: string) => void;
  onEditEntity?: (groupId: string, entityName: string) => void;
  onDeleteEntity?: (entityName: string) => void;
}

export function EntityBrowser({
  groups,
  selectedEntityByGroup,
  onSelect,
  onSelectGsi,
  onAddEntity,
  onEditEntity,
  onDeleteEntity,
}: EntityBrowserProps) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  function toggleGroup(id: string) {
    setCollapsed((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  const selectedEntityName = Object.values(selectedEntityByGroup).find(Boolean);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Column header */}
      <div className="px-4 py-2 border-b border-line bg-surface shrink-0 flex items-center justify-between">
        <span className="font-mono text-[11px] font-semibold tracking-[0.1em] text-muted uppercase">
          ENTITIES
        </span>
        {onAddEntity && (
          <button
            type="button"
            title="Add entity"
            onClick={() => onAddEntity('')}
            className="text-muted hover:text-accent bg-transparent border-0 cursor-pointer p-0.5 rounded transition-colors"
          >
            <Plus size={12} />
          </button>
        )}
      </div>

      {/* Groups list */}
      <div className="flex-1 overflow-y-auto">
        {groups.map((group, groupIdx) => {
          const isCollapsed = collapsed[group.id] ?? false;
          const accent = GROUP_ACCENTS[groupIdx % GROUP_ACCENTS.length];
          const label = getPartitionChipLabel(group.partitionKey);

          return (
            <div key={group.id}>
              {/* Group header */}
              <div
                className={`group flex items-center gap-[7px] py-[7px] px-3 ${groupIdx > 0 ? 'border-t border-t-line-dim' : ''}`}
              >
                <button
                  type="button"
                  onClick={() => toggleGroup(group.id)}
                  className="flex items-center gap-[7px] flex-1 min-w-0 bg-transparent border-0 cursor-pointer text-left transition-colors hover:bg-hovered rounded"
                >
                  <ChevronDown
                    width={14}
                    height={14}
                    className={`text-muted inline-block leading-none transition-transform duration-150 shrink-0 ${isCollapsed ? '-rotate-90' : 'rotate-0'}`}
                  />
                  <span
                    className="w-[6px] h-[6px] rounded-full shrink-0"
                    style={{ background: accent }}
                  />
                  <span className="font-mono text-[11px] text-secondary flex-1 overflow-hidden text-ellipsis whitespace-nowrap">
                    {renderPatternLabel(label, accent)}
                  </span>
                  <span className="font-mono text-[11px] text-muted shrink-0">
                    {group.entities.length}
                  </span>
                </button>

                {/* Add entity to this partition group */}
                {onAddEntity && (
                  <button
                    type="button"
                    title="Add entity with this partition key"
                    onClick={() => onAddEntity(group.partitionKey)}
                    className="opacity-0 group-hover:opacity-100 text-muted hover:text-accent bg-transparent border-0 cursor-pointer p-0.5 rounded transition-opacity"
                  >
                    <Plus size={12} />
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
                      {/* Entity row */}
                      <div
                        className={`group/entity flex items-center gap-0 border-l-2 transition-colors ${
                          isActive ? 'bg-accent-dim' : 'border-l-transparent hover:bg-hovered'
                        }`}
                        style={isActive ? { borderLeftColor: accent } : undefined}
                      >
                        <button
                          type="button"
                          onClick={() => onSelect(group.id, entity.name)}
                          className="flex items-center gap-0 py-[5px] flex-1 min-w-0 bg-transparent border-0 cursor-pointer text-left"
                        >
                          {/* Tree lines */}
                          <span className="relative shrink-0 w-[26px] self-stretch">
                            <span
                              className="absolute left-[14px] top-0 w-px bg-line-dim"
                              style={{ bottom: isLast && entity.gsis.length === 0 ? '50%' : '0' }}
                            />
                            <span className="absolute left-[14px] top-1/2 w-[10px] h-px bg-line-dim -translate-y-px" />
                          </span>

                          {/* SK pattern */}
                          <span className="font-mono text-[10px] text-muted shrink-0 max-w-[45%] overflow-hidden text-ellipsis whitespace-nowrap">
                            {renderPatternLabel(entity.sk, accent)}
                          </span>

                          <span className="mx-1.5 text-[10px] text-muted/40 shrink-0">·</span>

                          <span className={`flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-[11px] font-ui ${
                            isActive ? 'font-semibold text-primary' : 'font-normal text-secondary'
                          }`}>
                            {entity.name}
                          </span>
                        </button>

                        {/* Edit / delete actions */}
                        {(onEditEntity || onDeleteEntity) && (
                          <div className="flex items-center gap-0.5 pr-2 opacity-0 group-hover/entity:opacity-100 transition-opacity shrink-0">
                            {onEditEntity && (
                              <button type="button" title="Edit entity" onClick={(e) => { e.stopPropagation(); onEditEntity(group.id, entity.name); }} className="text-muted hover:text-accent bg-transparent border-0 cursor-pointer p-0.5 rounded transition-colors">
                                <Pencil size={11} />
                              </button>
                            )}
                            {onDeleteEntity && (
                              <button type="button" title="Delete entity" onClick={(e) => { e.stopPropagation(); onDeleteEntity(entity.name); }} className="text-muted hover:text-red-400 bg-transparent border-0 cursor-pointer p-0.5 rounded transition-colors">
                                <Trash2 size={11} />
                              </button>
                            )}
                          </div>
                        )}
                      </div>

                      {/* GSI rows */}
                      {entity.gsis.map((gsi, gsiIdx) => {
                        const isLastGsi = gsiIdx === entity.gsis.length - 1;
                        const isLastEntityAndLastGsi = isLast && isLastGsi;
                        return (
                          <button
                            key={gsi.name}
                            type="button"
                            onClick={() => onSelectGsi?.(group.id, entity.name, gsi.name)}
                            className="group/gsi w-full flex items-center gap-0 py-[3px] bg-transparent border-0 border-l-2 border-l-transparent cursor-pointer text-left hover:bg-hovered transition-colors"
                          >
                            {/* Level-1 tree line (entity indent) */}
                            <span className="relative shrink-0 w-[26px] self-stretch">
                              <span
                                className="absolute left-[14px] top-0 w-px bg-line-dim"
                                style={{ bottom: isLastEntityAndLastGsi ? '100%' : '0' }}
                              />
                            </span>
                            {/* Level-2 tree line (GSI indent) */}
                            <span className="relative shrink-0 w-[18px] self-stretch">
                              <span
                                className="absolute left-0 top-0 w-px bg-line-dim"
                                style={{ bottom: isLastGsi ? '50%' : '0' }}
                              />
                              <span className="absolute left-0 top-1/2 w-[10px] h-px bg-line-dim -translate-y-px" />
                            </span>

                            {/* GSI name badge */}
                            <span className="font-mono text-[9px] font-semibold px-[5px] py-[1px] rounded-[3px] border shrink-0 mr-1.5"
                              style={{ color: accent, borderColor: `${accent}40`, background: `${accent}10` }}>
                              {gsi.name}
                            </span>

                            {/* GSI PK pattern */}
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
        })}

        {/* Empty state */}
        {groups.length === 0 && (
          <div className="px-4 py-6 text-center text-muted text-xs font-ui">
            No entities yet.
            {onAddEntity && (
              <span className="block mt-1 text-muted/60">
                Use + in the schema header to add one.
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/** Render a partition key pattern with {vars} highlighted in accent color */
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
