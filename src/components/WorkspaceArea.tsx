import { useEffect, useState } from 'react';
import { Group, Panel, Separator } from 'react-resizable-panels';
import { Box, MousePointerClick, Terminal } from 'lucide-react';
import { EntityInspector } from './EntityInspector.tsx';
import { QueryBuilder } from './QueryBuilder.tsx';
import { QueryResults } from './QueryResults.tsx';
import { EmptyState } from './ui/EmptyState.tsx';
import { Select } from './ui/Input.tsx';
import { useQueryExecutor } from '../hooks/useQueryExecutor.ts';
import type { WorkspaceTab } from '../hooks/useWorkspace.ts';
import type { Entity, SavedQuery, SkOp, TableSchema } from '../domain/schema/types.ts';
import type { QueryParams } from '../services/dynamo.ts';

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
  const [pageSize, setPageSize] = useState<number>(25);

  const executor = useQueryExecutor();

  // Reset the builder when the selected entity changes…
  useEffect(() => {
    setSelectedTarget('base');
    setPkValues({});
    setSkOp('none');
    setSkValues({});
    setSk2Values({});
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
    executor.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadSeq]);

  if (!entity) {
    return (
      <div className="h-full flex items-center justify-center bg-surface border border-line rounded-xl">
        <EmptyState
          icon={<MousePointerClick size={28} strokeWidth={1.5} />}
          title="No entity selected"
        >
          Pick an entity from the library on the left to query it, or create one with the{' '}
          <kbd className="font-mono text-[11px] px-1.5 py-[1px] border border-line rounded">+</kbd>{' '}
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
    };
  }

  const keyAttrs = [
    schema.keys.pk,
    schema.keys.sk,
    ...schema.indexes.flatMap((d) => [d.pkAttr, ...(d.skAttr ? [d.skAttr] : [])]),
  ];

  return (
    <Group orientation="vertical" className="flex-1 min-h-0 h-full gap-1">
      {/* ===== Upper panel: tabs + content ===== */}
      <Panel defaultSize={36} minSize={12}>
        <section
          aria-label="Workspace"
          className="h-full flex flex-col overflow-hidden bg-surface border border-line rounded-xl"
        >
          {/* Tab bar + context */}
          <div
            role="tablist"
            aria-label="Workspace views"
            className="flex items-stretch border-b border-line shrink-0 bg-canvas/60"
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
            <div className="flex-1 flex items-center justify-end px-4 gap-2 min-w-0">
              <span className="micro-label shrink-0">entity</span>
              <span className="font-mono text-[12px] text-primary truncate" title={entity.name}>
                {entity.name}
              </span>
            </div>
          </div>

          {/* Tab content — both stay mounted so builder inputs survive */}
          <div
            role="tabpanel"
            id="panel-query"
            aria-labelledby="tab-query"
            hidden={tab !== 'query'}
            className={tab === 'query' ? 'flex-1 overflow-y-auto dot-grid' : ''}
          >
            <div className="px-5 py-4">
              <QueryBuilder
                schema={schema}
                entity={entity}
                tableName={tableName}
                selectedTarget={selectedTarget}
                pkValues={pkValues}
                skOp={skOp}
                skValues={skValues}
                sk2Values={sk2Values}
                onChangeTarget={setSelectedTarget}
                onChangePkValues={setPkValues}
                onChangeSkOp={setSkOp}
                onChangeSkValues={setSkValues}
                onChangeSk2Values={setSk2Values}
                onSubmit={handleSubmit}
                executeDisabledReason={executeDisabledReason}
                onSaveQuery={(name) =>
                  onSaveQuery({ id: crypto.randomUUID(), name, ...snapshotQuery() })
                }
                onUpdateQuery={
                  activeQuery
                    ? () => onUpdateQuery({ ...activeQuery, ...snapshotQuery() })
                    : undefined
                }
                activeQueryName={activeQuery?.name}
              />
            </div>
          </div>

          <div
            role="tabpanel"
            id="panel-entity"
            aria-labelledby="tab-entity"
            hidden={tab !== 'entity'}
            className={tab === 'entity' ? 'flex-1 overflow-hidden dot-grid' : ''}
          >
            <EntityInspector schema={schema} entity={entity} onEdit={onEditEntity} />
          </div>
        </section>
      </Panel>

      <Separator className="h-1 my-0 cursor-row-resize hover:bg-accent/40 transition-colors rounded" />

      {/* ===== Lower panel: results ===== */}
      <Panel defaultSize={64} minSize={10} collapsible collapsedSize={0}>
        <section
          aria-labelledby="results-header"
          className="h-full flex flex-col overflow-hidden bg-surface border border-line rounded-xl"
        >
          <div className="py-2 px-4 border-b border-line bg-canvas/60 shrink-0 flex items-center gap-2">
            <span id="results-header" className="micro-label text-[12px]">
              Results
            </span>
            <div className="ml-auto flex items-center gap-1.5">
              <label htmlFor="page-size" className="micro-label">page</label>
              <Select
                id="page-size"
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="text-[11px] px-1.5 py-[2px]"
              >
                {[10, 25, 50, 100].map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </Select>
            </div>
            <span aria-live="polite" className="sr-only">
              {executor.result.status === 'loading' && 'Query running…'}
              {executor.result.status === 'success' && `Query complete: ${executor.result.data.length} items`}
              {executor.result.status === 'error' && `Query failed: ${executor.result.error ?? ''}`}
            </span>
          </div>
          <div className="flex-1 overflow-y-auto py-3 px-4">
            <QueryResults
              result={executor.result}
              keyAttrs={keyAttrs}
              onNext={executor.hasNext ? executor.next : undefined}
              onPrev={executor.hasPrev ? executor.prev : undefined}
            />
          </div>
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
      className={`flex items-center gap-1.5 py-2.5 px-4 font-mono text-xs border-0 border-b-2 bg-transparent cursor-pointer transition-colors -mb-px ${
        active
          ? 'font-semibold border-b-accent text-accent'
          : 'font-normal border-b-transparent text-muted hover:text-secondary'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
