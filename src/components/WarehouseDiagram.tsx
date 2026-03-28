import { ArrowRight } from 'lucide-react';
import type { PartitionGroup, ShelfTheme } from '../types/schema.ts';

interface WarehouseDiagramProps {
  group: PartitionGroup;
  theme: ShelfTheme;
  selectedEntityName: string;
  onSelect: (entityName: string) => void;
}

export function WarehouseDiagram({
  group,
  theme,
  selectedEntityName,
  onSelect,
}: WarehouseDiagramProps) {
  return (
    <div className="divide-y divide-slate-100">
      {group.entities.map((entity) => {
        const isSelected = selectedEntityName === entity.name;

        return (
          <div key={entity.name}>
            <button
              type="button"
              onClick={() => onSelect(entity.name)}
              className={`group w-full text-left transition-colors border-l-2 ${
                isSelected
                  ? 'bg-slate-50 border-amber-400'
                  : 'border-transparent hover:bg-slate-50/60 hover:border-slate-200'
              }`}
            >
              <div className="flex items-center gap-4 px-5 py-3.5">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`text-sm font-semibold ${
                        isSelected ? 'text-slate-900' : 'text-slate-700'
                      }`}
                    >
                      {entity.name}
                    </span>
                    <span className="text-[10px] text-slate-400 uppercase tracking-wide">
                      {entity.role}
                    </span>
                  </div>
                  <code className="mt-0.5 block truncate text-[11px] text-slate-400">
                    SK: {entity.sk}
                  </code>
                </div>

                <ArrowRight
                  className={`h-3.5 w-3.5 shrink-0 transition-transform ${
                    isSelected
                      ? `${theme.iconColor} translate-x-0.5`
                      : 'text-slate-300 group-hover:text-slate-400'
                  }`}
                />
              </div>
            </button>

            {entity.gsis.length > 0 && (
              <div className="border-t border-slate-100 bg-slate-50/50 px-5 py-2 pl-7">
                <div className="space-y-1">
                  {entity.gsis.map((gsi) => (
                    <div
                      key={gsi.name}
                      className="flex items-baseline gap-2 text-[11px] text-slate-500"
                    >
                      <span className="shrink-0 font-mono text-[10px] text-slate-400">GSI</span>
                      <span className="shrink-0 font-medium text-slate-600">{gsi.name}</span>
                      <code className="text-slate-400 truncate">pk:{gsi.pk}</code>
                      <code className="text-slate-400 truncate">sk:{gsi.sk}</code>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
