import { Database } from 'lucide-react';
import type { DynamoTable } from '../types/schema.ts';
import { buildPartitionGroups } from '../utils/warehouse.ts';

interface AppSidebarProps {
  tables: DynamoTable[];
  activeTableIdx: number;
  onSelectTable: (index: number) => void;
}

export function AppSidebar({ tables, activeTableIdx, onSelectTable }: AppSidebarProps) {
  return (
    <aside className="flex h-full flex-col bg-slate-950 text-slate-300">
      {/* Brand */}
      <div className="flex items-center gap-2.5 px-5 py-4 border-b border-white/[0.06]">
        <Database className="h-4 w-4 text-amber-400 shrink-0" />
        <span className="text-sm font-semibold tracking-tight text-white">Dynamo Viewer</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <p className="px-2 mb-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-600">
          Tables
        </p>
        <div className="space-y-0.5">
          {tables.map((table, index) => {
            const groups = buildPartitionGroups(table);
            const isActive = activeTableIdx === index;

            return (
              <button
                key={table.table}
                type="button"
                onClick={() => onSelectTable(index)}
                className={`w-full text-left rounded px-2 py-2 text-sm transition-colors ${
                  isActive
                    ? 'bg-white/[0.06] text-white'
                    : 'text-slate-400 hover:bg-white/[0.03] hover:text-slate-200'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div
                    className={`h-1.5 w-1.5 rounded-full shrink-0 transition-colors ${
                      isActive ? 'bg-amber-400' : 'bg-slate-700'
                    }`}
                  />
                  <div className="min-w-0">
                    <div className="truncate font-medium">{table.table}</div>
                    <div className="text-[10px] text-slate-600 mt-0.5">
                      {groups.length} partitions · {table.entities.length} types
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </nav>
    </aside>
  );
}
