import { useState } from 'react';
import type { PartitionGroup } from '../types/schema.ts';
import { getShelfTheme } from '../utils/warehouse.ts';
import { EntityInspector } from './EntityInspector.tsx';
import { QueryPlayground } from './QueryPlayground.tsx';
import { WarehouseDiagram } from './WarehouseDiagram.tsx';

interface PartitionShelfProps {
  group: PartitionGroup;
  tableName: string;
  selectedEntityName?: string;
  onSelect: (groupId: string, entityName: string) => void;
}

export function PartitionShelf({ group, tableName, selectedEntityName, onSelect }: PartitionShelfProps) {
  const theme = getShelfTheme(group.domain);
  const Icon = theme.icon;
  const selectedEntity =
    group.entities.find((entity) => entity.name === selectedEntityName) ?? group.entities[0];
  const totalGsis = group.entities.reduce((total, entity) => total + entity.gsis.length, 0);
  const totalAccessPatterns = group.entities.reduce(
    (total, entity) => total + entity.accessPatterns.length,
    0,
  );

  const [activeTab, setActiveTab] = useState<'schema' | 'query'>('schema');
  const [queryPattern, setQueryPattern] = useState<string | undefined>(undefined);

  function handleUsePattern(pattern: string) {
    setQueryPattern(pattern);
    setActiveTab('query');
  }

  return (
    <section className="border border-slate-200 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3.5 border-b border-slate-200 bg-slate-50">
        <div className="flex items-center gap-2">
          <Icon className={`h-4 w-4 shrink-0 ${theme.iconColor}`} />
          <span className="text-sm font-semibold text-slate-800">{theme.title}</span>
        </div>
        <code className="text-xs text-slate-500 bg-white border border-slate-200 rounded px-1.5 py-0.5">
          PK: {group.partitionKey}
        </code>
        <span className="ml-auto text-xs text-slate-400">
          {group.entities.length} entities · {totalGsis} GSIs · {totalAccessPatterns} patterns
        </span>
      </div>

      {/* Body */}
      <div className="grid xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
        <div className="border-b xl:border-b-0 xl:border-r border-slate-200">
          <WarehouseDiagram
            group={group}
            theme={theme}
            selectedEntityName={selectedEntity.name}
            onSelect={(entityName) => onSelect(group.id, entityName)}
          />
        </div>

        {/* Right panel with tabs */}
        <div className="flex flex-col overflow-hidden">
          <div className="flex gap-0.5 border-b border-slate-200 px-4">
            <button
              type="button"
              onClick={() => setActiveTab('schema')}
              className={`px-3 py-2.5 text-xs transition-colors -mb-px border-b-2 ${
                activeTab === 'schema'
                  ? 'border-slate-900 text-slate-900 font-medium'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
            >
              Schema
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('query')}
              className={`px-3 py-2.5 text-xs transition-colors -mb-px border-b-2 ${
                activeTab === 'query'
                  ? 'border-slate-900 text-slate-900 font-medium'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
            >
              Query
            </button>
          </div>

          {activeTab === 'schema' ? (
            <EntityInspector
              entity={selectedEntity}
              theme={theme}
              onUsePattern={handleUsePattern}
            />
          ) : (
            <QueryPlayground
              entity={selectedEntity}
              tableName={tableName}
              initialPattern={queryPattern}
            />
          )}
        </div>
      </div>
    </section>
  );
}
