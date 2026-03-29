import { useState } from 'react';
import type { PartitionGroup } from '../types/schema.ts';
import { getPartitionChipLabel } from '../utils/warehouse.ts';
import { ChevronDown } from 'lucide-react';

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
}

export function EntityBrowser({ groups, selectedEntityByGroup, onSelect }: EntityBrowserProps) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  function toggleGroup(id: string) {
    setCollapsed((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  const selectedEntityName = Object.values(selectedEntityByGroup).find(Boolean);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Column header */}
      <div className="px-4 py-2 border-b border-line bg-surface shrink-0">
        <span className="font-mono text-[11px] font-semibold tracking-[0.1em] text-muted uppercase">
          ENTITIES
        </span>
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
              <button
                type="button"
                onClick={() => toggleGroup(group.id)}
                className={`w-full flex items-center gap-[7px] py-[7px] px-3 bg-transparent border-0 ${groupIdx > 0 ? 'border-t border-t-line-dim' : ''} cursor-pointer text-left transition-colors hover:bg-hovered`}
              >
                {/* Collapse arrow */}
                <ChevronDown width={14} height={14} className={`text-muted inline-block leading-none transition-transform duration-150 ${isCollapsed ? '-rotate-90' : 'rotate-0'}`}/>

                {/* Color dot */}
                <span
                  className="w-[6px] h-[6px] rounded-full shrink-0"
                  style={{ background: accent }}
                />

                {/* PK pattern */}
                <span className="font-mono text-[11px] text-secondary flex-1 overflow-hidden text-ellipsis whitespace-nowrap">
                  {renderPatternLabel(label, accent)}
                </span>

                {/* Entity count */}
                <span className="font-mono text-[11px] text-muted shrink-0">
                  {group.entities.length}
                </span>
              </button>

              {/* Entities */}
              {!isCollapsed && group.entities.map((entity) => {
                const isActive = selectedEntityName === entity.name;
                return (
                  <button
                    key={entity.name}
                    type="button"
                    onClick={() => onSelect(group.id, entity.name)}
                    className={`w-full flex items-center gap-2 py-[6px] pr-3 pl-[26px] border-0 border-l-2 cursor-pointer text-left transition-colors ${
                      isActive
                        ? 'bg-accent-dim'
                        : 'border-l-transparent hover:bg-hovered'
                    }`}
                    style={isActive ? { borderLeftColor: accent } : undefined}
                  >
                    {/* Entity name */}
                    <span className={`flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-xs font-ui ${
                      isActive ? 'font-semibold text-primary' : 'font-normal text-secondary'
                    }`}>
                      {entity.name}
                    </span>

                    {/* GSI count badge */}
                    {entity.gsis.length > 0 && (
                      <span className="font-mono text-[11px] px-1.5 py-[2px] rounded-[3px] bg-elevated text-muted border border-line shrink-0">
                        {entity.gsis.length} GSI
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Render a partition key pattern with {vars} highlighted in accent color */
function renderPatternLabel(label: string, accent: string) {
  // label uses {variable} notation from getPartitionChipLabel
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
