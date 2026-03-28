import type { DynamoTable } from '../types/schema.ts';

interface TableHeaderProps {
  activeTable: DynamoTable;
  partitionCount: number;
  totalGsis: number;
  totalAccessPatterns: number;
}

export function TableHeader({
  activeTable,
  partitionCount,
  totalGsis,
  totalAccessPatterns,
}: TableHeaderProps) {
  return (
    <header className="mb-6 pb-6 border-b border-slate-200">
      <h2 className="text-2xl font-bold tracking-tight text-slate-950">{activeTable.table}</h2>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-500">
        <span>{partitionCount} partitions</span>
        <span className="text-slate-300">·</span>
        <span>{activeTable.entities.length} entity types</span>
        <span className="text-slate-300">·</span>
        <span>{totalGsis} GSIs</span>
        <span className="text-slate-300">·</span>
        <span>{totalAccessPatterns} access patterns</span>
      </div>
      {activeTable.story && (
        <p className="mt-2 text-sm text-slate-400 italic">{activeTable.story}</p>
      )}
    </header>
  );
}
