import { useEffect, useState } from 'react';
import { Group, Panel, Separator } from 'react-resizable-panels';
import { Box, MousePointerClick, Terminal } from 'lucide-react';
import { EntityInspector } from './EntityInspector.tsx';
import {
  fromQueryFilters,
  toQueryFilters,
  type FilterRow,
} from './querybuilder/FiltersTable.tsx';
import { QueryResults } from './queryResults/QueryResults.tsx';
import { EmptyState } from './ui/EmptyState.tsx';
import { useQueryExecutor } from '../hooks/useQueryExecutor.ts';
import type { WorkspaceTab } from '../hooks/useWorkspace.ts';
import type { Entity, SavedQuery, SkOp, TableSchema } from '../domain/schema/types.ts';
import type { QueryParams } from '../services/dynamo.ts';
import { QueryBuilder } from './querybuilder/QueryBuilder.tsx';

interface WorkspaceAreaProps {
  schema: TableSchema;
  entity: Entity | null;
  tableName: string;
  tab: WorkspaceTab;
  onTabChange: (tab: WorkspaceTab) => void;

  /** One-shot builder hydration payload; re-applied whenever loadSeq bumps. */
  loadedQuery: SavedQuery | null;
  loadSeq: number;
  /** The saved query the builder currently mirrors (for "Update"). */
  activeQuery: SavedQuery | null;

  executeDisabledReason?: string;
  onSaveQuery: (query: SavedQuery) => void;
  onUpdateQuery: (query: SavedQuery) => void;
  onEditEntity: () => void;
}

export function WorkspaceArea({
  schema,
  entity,
  tableName,
  tab,
  onTabChange,
  loadedQuery,
  loadSeq,
  activeQuery,
  executeDisabledReason,
  onSaveQuery,
  onUpdateQuery,
  onEditEntity,
}: WorkspaceAreaProps) {
  // Builder state lives here so it survives tab switches.
  const [selectedTarget, setSelectedTarget] = useState<'base' | string>('base');
  const [pkValues, setPkValues] = useState<Record<string, string>>({});
  const [skOp, setSkOp] = useState<SkOp>('none');
  const [skValues, setSkValues] = useState<Record<string, string>>({});
  const [sk2Values, setSk2Values] = useState<Record<string, string>>({});
  const [filters, setFilters] = useState<FilterRow[]>([]);
  const [pageSize, setPageSize] = useState<number>(10);

  const executor = useQueryExecutor();

  // Reset the builder when the selected entity changes…
  useEffect(() => {
    setSelectedTarget('base');
    setPkValues({});
    setSkOp('none');
    setSkValues({});
    setSk2Values({});
    setFilters([]);
    executor.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entity?.name, schema.id]);

  // …then hydrate it when a saved query (or index shortcut) is loaded.
  useEffect(() => {
    if (!loadedQuery) return;
    setSelectedTarget(loadedQuery.target);
    setPkValues(loadedQuery.pkValues);
    setSkOp(loadedQuery.skOp);
    setSkValues(loadedQuery.skValues);
    setSk2Values(loadedQuery.sk2Values);
    setFilters(fromQueryFilters(loadedQuery.filters ?? []));
    executor.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadSeq]);

  if (!entity) {
    return (
      <div className="h-full flex items-center justify-center bg-canvas">
        <EmptyState
          icon={<MousePointerClick size={28} strokeWidth={1.5} />}
          title="No entity selected"
        >
          Pick an entity from the library on the left to query it, or create one with the{' '}
          <kbd className="font-mono text-[11px] px-1.5 py-px bg-elevated rounded">+</kbd>{' '}
          button.
        </EmptyState>
      </div>
    );
  }

  async function handleSubmit(params: QueryParams) {
    await executor.execute({ ...params, limit: pageSize });
  }

  function snapshotQuery(): Omit<SavedQuery, 'id' | 'name'> {
    return {
      entityName: entity!.name,
      target: selectedTarget,
      pkValues: { ...pkValues },
      skOp,
      skValues: { ...skValues },
      sk2Values: { ...sk2Values },
      filters: toQueryFilters(filters),
    };
  }

  const keyAttrs = [
    schema.keys.pk,
    schema.keys.sk,
    ...schema.indexes.flatMap((d) => [d.pkAttr, ...(d.skAttr ? [d.skAttr] : [])]),
  ];

  return (
    <Group orientation="vertical" className="flex-1 min-h-0 h-full">
      {/* ===== Upper panel: tabs + content ===== */}
      <Panel defaultSize={36} minSize={12}>
        <section
          aria-label="Workspace"
          className="h-full flex flex-col overflow-hidden bg-canvas"
        >
          {/* Tab bar + context */}
          <div
            role="tablist"
            aria-label="Workspace views"
            className="flex items-stretch border-b border-line-dim bg-inset shrink-0"
          >
            <TabButton
              id="tab-query"
              controls="panel-query"
              icon={<Terminal size={13} aria-hidden="true" />}
              label="Query"
              active={tab === 'query'}
              onClick={() => onTabChange('query')}
            />
            <TabButton
              id="tab-entity"
              controls="panel-entity"
              icon={<Box size={13} aria-hidden="true" />}
              label="Entity"
              active={tab === 'entity'}
              onClick={() => onTabChange('entity')}
            />
          </div>

          {/* Tab content: both stay mounted so builder inputs survive */}
          <div
            role="tabpanel"
            id="panel-query"
            aria-labelledby="tab-query"
            hidden={tab !== 'query'}
            className={tab === 'query' ? 'flex-1 min-h-0 flex flex-col' : ''}
          >
            <QueryBuilder
              schema={schema}
              entity={entity}
              tableName={tableName}
              selectedTarget={selectedTarget}
              pkValues={pkValues}
              skOp={skOp}
              skValues={skValues}
              sk2Values={sk2Values}
              filters={filters}
              onChangeTarget={setSelectedTarget}
              onChangePkValues={setPkValues}
              onChangeSkOp={setSkOp}
              onChangeSkValues={setSkValues}
              onChangeSk2Values={setSk2Values}
              onChangeFilters={setFilters}
              onSubmit={handleSubmit}
              executeDisabledReason={executeDisabledReason}
              onSaveQuery={(name: string) =>
                onSaveQuery({ id: crypto.randomUUID(), name, ...snapshotQuery() })
              }
              onUpdateQuery={
                activeQuery
                  ? () => onUpdateQuery({ ...activeQuery, ...snapshotQuery() })
                  : undefined
              }
              activeQueryName={activeQuery?.name}
              isLoading={executor.result.status === 'loading'}
            />
          </div>

          <div
            role="tabpanel"
            id="panel-entity"
            aria-labelledby="tab-entity"
            hidden={tab !== 'entity'}
            className={tab === 'entity' ? 'flex-1 overflow-hidden' : ''}
          >
            <EntityInspector schema={schema} entity={entity} onEdit={onEditEntity} />
          </div>
        </section>
      </Panel>

      <Separator className="relative z-10 h-px bg-line-dim cursor-row-resize hover:bg-accent/60 transition-colors after:absolute after:inset-x-0 after:-inset-y-1 after:content-['']" />

      {/* ===== Lower panel: results ===== */}
      <Panel defaultSize={64} minSize={10} collapsible collapsedSize={0}>
        <section
          aria-label="Results"
          className="h-full flex flex-col overflow-hidden bg-canvas"
        >
          <span aria-live="polite" className="sr-only">
            {executor.result.status === 'loading' && 'Query running…'}
            {executor.result.status === 'success' && `Query complete: ${executor.result.data.length} items`}
            {executor.result.status === 'error' && `Query failed: ${executor.result.error ?? ''}`}
          </span>
          <QueryResults
            result={executor.result}
            keyAttrs={keyAttrs}
            pageSize={pageSize}
            onPageSizeChange={setPageSize}
            onNext={executor.hasNext ? executor.next : undefined}
            onPrev={executor.hasPrev ? executor.prev : undefined}
          />
        </section>
      </Panel>
    </Group>
  );
}

// ---- Tab button ----

function TabButton({
  id,
  controls,
  icon,
  label,
  active,
  onClick,
}: {
  id: string;
  controls: string;
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      id={id}
      aria-selected={active}
      aria-controls={controls}
      tabIndex={active ? 0 : -1}
      onClick={onClick}
      className={`flex items-center gap-1.5 py-2 px-3.5 text-[12px] border-x border-t-0 border-b first:border-l-0 cursor-pointer transition-colors -mb-px ${
        active
          ? 'font-medium bg-surface border-x-line-dim border-b-surface text-primary'
          : 'bg-transparent border-transparent text-muted hover:text-secondary'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
