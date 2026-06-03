import { useEffect, useState } from 'react';
import { Group, Panel, Separator } from 'react-resizable-panels';
import { Code2, Database } from 'lucide-react';
import { EntityInspector } from './EntityInspector.tsx';
import { QueryBuilder } from './QueryBuilder.tsx';
import { QueryResults } from './QueryResults.tsx';
import { useQueryExecutor } from '../hooks/useQueryExecutor.ts';
import { isTauriRuntime } from '../lib/dynamo.ts';
import type { Entity, SavedQuery, SkOp } from '../types/schema.ts';
import type { QueryParams } from '../types/query.ts';
import { alertDialog } from '../lib/dialog.ts';

export type WorkspaceTab = 'builder' | 'schema';

interface WorkspaceAreaProps {
  entity: Entity | null;
  tableName: string;
  activeTab: WorkspaceTab;
  onTabChange: (tab: WorkspaceTab) => void;

  // Saved query loading
  initialQuery: SavedQuery | null;
  activeQueryId: string | null;
  onActiveQueryChange: (id: string | null) => void;
  onSaveQuery?: (query: SavedQuery) => void;
  onUpdateQuery?: (query: SavedQuery) => void;

  // Schema edit
  isEditMode: boolean;
  isNewEntity: boolean;
  onEnterEdit: () => void;
  onSaveEntity: (entity: Entity) => void;
  onCancelEdit: () => void;
  onDeleteEntity?: () => void;
}

export function WorkspaceArea({
  entity,
  tableName,
  activeTab,
  onTabChange,
  initialQuery,
  activeQueryId,
  onActiveQueryChange,
  onSaveQuery,
  onUpdateQuery,
  isEditMode,
  isNewEntity,
  onEnterEdit,
  onSaveEntity,
  onCancelEdit,
  onDeleteEntity,
}: WorkspaceAreaProps) {
  // ---- Builder state (lives here so it persists across tab switches) ----
  const [selectedTarget, setSelectedTarget] = useState<'base' | string>('base');
  const [pkValues, setPkValues] = useState<Record<string, string>>({});
  const [skOp, setSkOp] = useState<SkOp>('none');
  const [skValues, setSkValues] = useState<Record<string, string>>({});
  const [sk2Values, setSk2Values] = useState<Record<string, string>>({});
  const [pageSize, setPageSize] = useState<number>(25);

  const executor = useQueryExecutor();

  // Reset builder state when entity changes
  useEffect(() => {
    setSelectedTarget('base');
    setPkValues({});
    setSkOp('none');
    setSkValues({});
    setSk2Values({});
    executor.reset();
    onActiveQueryChange(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entity?.name]);

  // Load query from sidebar
  useEffect(() => {
    if (!initialQuery) return;
    setSelectedTarget(initialQuery.target);
    setPkValues(initialQuery.pkValues);
    setSkOp(initialQuery.skOp);
    setSkValues(initialQuery.skValues);
    setSk2Values(initialQuery.sk2Values);
    onActiveQueryChange(initialQuery.id || null);
    executor.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQuery]);

  const activeQuery = entity && activeQueryId
    ? entity.savedQueries.find((q) => q.id === activeQueryId) ?? null
    : null;

  async function handleSubmit(params: QueryParams) {
    await executor.execute({ ...params, limit: pageSize });
  }

  function handleSaveQuery(name: string) {
    if (!onSaveQuery) return;
    const newQuery: SavedQuery = {
      id: crypto.randomUUID(),
      name,
      target: selectedTarget,
      pkValues: { ...pkValues },
      skOp,
      skValues: { ...skValues },
      sk2Values: { ...sk2Values },
    };
    onSaveQuery(newQuery);
    onActiveQueryChange(newQuery.id);
  }

  function handleUpdateQuery() {
    if (!onUpdateQuery || !activeQuery) return;
    onUpdateQuery({
      ...activeQuery,
      target: selectedTarget,
      pkValues: { ...pkValues },
      skOp,
      skValues: { ...skValues },
      sk2Values: { ...sk2Values },
    });
  }

  // ---- Empty state ----
  if (!entity) {
    return (
      <div className="h-full flex items-center justify-center bg-surface border border-line rounded-2xl">
        <div className="text-center max-w-sm px-6">
          <p className="font-mono text-sm text-secondary mb-2">No entity selected</p>
          <p className="text-xs text-muted leading-relaxed">
            Pick an entity from the library on the left, or use the <kbd className="font-mono text-[10px] px-1.5 py-[1px] border border-line rounded">+</kbd> button to create one.
          </p>
        </div>
      </div>
    );
  }

  const tauriOk = isTauriRuntime();

  return (
    <Group orientation="vertical" className="flex-1 min-h-0 h-full gap-1">
      {/* ===== Upper panel: tabs + content ===== */}
      <Panel defaultSize={32} minSize={12}>
        <section
          aria-label="Workspace"
          className="h-full flex flex-col overflow-hidden bg-surface border border-line rounded-2xl"
        >
          {/* Tab bar + context */}
          <div
            role="tablist"
            aria-label="Workspace views"
            className="flex items-stretch border-b border-line shrink-0 bg-[rgba(19,22,32,0.6)]"
          >
            <TabButton
              id="tab-builder"
              controls="panel-builder"
              icon={<Code2 size={13} aria-hidden="true" />}
              label="Builder"
              active={activeTab === 'builder'}
              onClick={() => onTabChange('builder')}
            />
            <TabButton
              id="tab-schema"
              controls="panel-schema"
              icon={<Database size={13} aria-hidden="true" />}
              label="Schema"
              active={activeTab === 'schema'}
              onClick={() => onTabChange('schema')}
            />
            <div className="flex-1 flex items-center justify-end px-4 gap-2 min-w-0">
              <span className="font-mono text-[10px] text-muted uppercase tracking-[0.08em] shrink-0">
                entity
              </span>
              <span className="font-mono text-[12px] text-primary truncate" title={entity.name}>
                {entity.name}
              </span>
            </div>
          </div>

          {/* Tab content — both mounted, hidden via display */}
          <div
            role="tabpanel"
            id="panel-builder"
            aria-labelledby="tab-builder"
            hidden={activeTab !== 'builder'}
            className={activeTab === 'builder' ? 'flex-1 overflow-y-auto dot-grid' : ''}
          >
            <div className={`px-5 py-4 ${!tauriOk ? 'opacity-40 pointer-events-none' : ''}`}>
              <QueryBuilder
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
                onSaveQuery={onSaveQuery ? handleSaveQuery : undefined}
                onUpdateQuery={onUpdateQuery && activeQueryId ? handleUpdateQuery : undefined}
                activeQueryName={activeQuery?.name}
              />
            </div>
            {!tauriOk && (
              <div className="py-3 px-5 border-t border-line bg-elevated">
                <span className="font-mono text-[11px] text-muted">
                  Query execution requires the desktop app with AWS credentials.
                </span>
              </div>
            )}
          </div>

          <div
            role="tabpanel"
            id="panel-schema"
            aria-labelledby="tab-schema"
            hidden={activeTab !== 'schema'}
            className={activeTab === 'schema' ? 'flex-1 overflow-hidden dot-grid' : ''}
          >
            <EntityInspector
              key={`${entity.name || 'new'}::${isEditMode}`}
              entity={entity}
              editMode={isEditMode}
              isNew={isNewEntity}
              onEnterEdit={onEnterEdit}
              onSave={onSaveEntity}
              onCancelEdit={onCancelEdit}
              onDelete={onDeleteEntity}
            />
          </div>
        </section>
      </Panel>

      <Separator className="h-1 my-0 cursor-row-resize hover:bg-accent/40 transition-colors rounded" />

      {/* ===== Lower panel: results ===== */}
      <Panel defaultSize={68} minSize={10} collapsible collapsedSize={0}>
        <section
          aria-labelledby="results-header"
          className="h-full flex flex-col overflow-hidden bg-surface border border-line rounded-2xl"
        >
          <div className="py-2 px-4 border-b border-line bg-[rgba(19,22,32,0.6)] shrink-0 flex items-center gap-2">
            <span id="results-header" className="font-mono text-[11px] font-semibold tracking-[0.1em] uppercase text-muted">
              Results
            </span>
            <div className="ml-auto flex items-center gap-1.5">
              <label htmlFor="page-size" className="font-mono text-[10px] text-muted uppercase tracking-[0.06em]">page</label>
              <select
                id="page-size"
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="bg-elevated border border-line rounded text-primary font-mono text-[10px] px-1.5 py-[2px] cursor-pointer outline-none"
              >
                {[10, 25, 50, 100].map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>
            <span aria-live="polite" className="font-mono text-[11px] sr-only">
              {executor.result.status === 'loading' && 'Query running…'}
              {executor.result.status === 'success' && `Query complete: ${executor.result.data.length} items`}
              {executor.result.status === 'error' && `Query failed: ${executor.result.error ?? ''}`}
            </span>
          </div>
          <div className="flex-1 overflow-y-auto py-3 px-4">
            <QueryResults
              result={executor.result}
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
