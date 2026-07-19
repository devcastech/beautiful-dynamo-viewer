import { useState } from 'react';
import { Panel, Group, Separator } from 'react-resizable-panels';
import { DatabaseZap, Plus, Upload } from 'lucide-react';
import { TopBar } from './components/TopBar.tsx';
import { Sidebar } from './components/Sidebar.tsx';
import { WorkspaceArea } from './components/WorkspaceArea.tsx';
import { Footer } from './components/Footer.tsx';
import { SchemaModal } from './components/SchemaModal.tsx';
import { EntityDrawer } from './components/EntityDrawer.tsx';
import { EmptyState } from './components/ui/EmptyState.tsx';
import { Button } from './components/ui/Button.tsx';
import { useSchemaStore } from './hooks/useSchemaStore.ts';
import { useAwsConnection } from './hooks/useAwsConnection.ts';
import { useWorkspace } from './hooks/useWorkspace.ts';
import { useTheme } from './hooks/useTheme.ts';
import { createSchemaRepository } from './services/storage.ts';
import { isTauriRuntime } from './services/runtime.ts';
import { alertDialog, confirmDialog, saveTextFileAs } from './services/dialog.ts';
import { parseSchemaImport } from './domain/schema/migrate.ts';
import type { Entity, TableSchema } from './domain/schema/types.ts';

const repo = createSchemaRepository();

export default function App() {
  const store = useSchemaStore(repo);
  const aws = useAwsConnection();
  const ws = useWorkspace();
  const theme = useTheme();

  const [schemaModal, setSchemaModal] = useState<'add' | 'edit' | null>(null);
  const [tableOverride, setTableOverride] = useState<string | undefined>(undefined);
  const [importInput, setImportInput] = useState<HTMLInputElement | null>(null);

  const schema = store.activeSchema;
  const tableName = tableOverride ?? schema?.tableName ?? '';

  const entity =
    schema?.entities.find((e) => e.name === ws.entityName) ?? schema?.entities[0] ?? null;
  const activeQuery = schema?.queries.find((q) => q.id === ws.queryId) ?? null;

  const executeDisabledReason = !isTauriRuntime()
    ? 'Query execution requires the desktop app.'
    : !aws.connected
      ? 'Connect an AWS profile to execute.'
      : tableName.trim() === ''
        ? 'Set a table name to execute.'
        : undefined;

  // ---- Schema handlers ----

  function handleSelectSchema(id: string) {
    store.setActiveId(id);
    ws.dispatch({ type: 'reset' });
    setTableOverride(undefined);
  }

  async function handleDeleteSchema() {
    if (!schema) return;
    const ok = await confirmDialog(
      `Delete schema "${schema.name}"? Its entities and saved queries go with it.`,
      'Delete schema',
    );
    if (!ok) return;
    store.deleteSchema();
    ws.dispatch({ type: 'reset' });
    setTableOverride(undefined);
  }

  async function handleImportSchema(file: File) {
    try {
      const imported = parseSchemaImport(await file.text());
      store.addSchema(imported);
      ws.dispatch({ type: 'reset' });
      setTableOverride(undefined);
    } catch (err) {
      await alertDialog(err instanceof Error ? err.message : String(err), 'Import error');
    }
  }

  async function handleExportSchema() {
    if (!schema) return;
    const json = JSON.stringify(schema, null, 2);
    const fileName = `${schema.name.replace(/\s+/g, '-').toLowerCase()}.schema.json`;
    if (isTauriRuntime()) {
      await saveTextFileAs(fileName, json);
      return;
    }
    // Browser fallback: trigger a download.
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ---- Entity handlers ----

  function handleSaveEntity(saved: Entity) {
    if (ws.draft?.kind === 'new') {
      store.addEntity(saved);
    } else if (entity) {
      store.updateEntity(entity.name, saved);
    }
    ws.dispatch({ type: 'entitySaved', name: saved.name });
  }

  async function handleDeleteEntity(entityName: string) {
    const ok = await confirmDialog(
      `Delete entity "${entityName}"? Its saved queries go with it.`,
      'Delete entity',
    );
    if (!ok) return;
    store.deleteEntity(entityName);
    ws.dispatch({ type: 'entityDeleted', name: entityName });
  }

  // ---- Render ----

  if (store.loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-canvas">
        <span className="font-mono text-xs text-muted animate-led-pulse">loading workspace…</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-canvas overflow-hidden">
      <TopBar
        schemas={store.schemas}
        activeSchema={schema}
        onSelectSchema={handleSelectSchema}
        onNewSchema={() => setSchemaModal('add')}
        onEditSchema={() => setSchemaModal('edit')}
        onImportSchema={handleImportSchema}
        onExportSchema={handleExportSchema}
        onDeleteSchema={handleDeleteSchema}
        tableName={tableName}
        onTableNameChange={setTableOverride}
        aws={aws}
      />

      {store.loadError && (
        <div className="px-4 py-2 font-mono text-[12px] text-err bg-err-dim border-b border-err/20">
          Could not load the saved workspace: {store.loadError}. Fix or remove workspace.json in the
          app data folder — saving now would start from scratch.
        </div>
      )}

      {store.saveError && (
        <div className="px-4 py-2 font-mono text-[12px] text-err bg-err-dim border-b border-err/20">
          Changes are not being saved: {store.saveError}. Your edits only live in memory — export
          the schema as a backup and check the app data folder.
        </div>
      )}

      {!schema ? (
        <main className="flex-1 flex items-center justify-center dot-grid">
          <div className="bg-surface border border-line rounded-xl px-4 py-6 w-[420px]">
            <EmptyState
              icon={<DatabaseZap size={32} strokeWidth={1.5} />}
              title="No schemas yet"
              actions={
                <>
                  <Button variant="primary" icon={<Plus size={12} />} onClick={() => setSchemaModal('add')}>
                    Create schema
                  </Button>
                  <Button icon={<Upload size={12} />} onClick={() => importInput?.click()}>
                    Import JSON
                  </Button>
                  <input
                    ref={setImportInput}
                    type="file"
                    accept=".json"
                    className="hidden"
                    aria-hidden="true"
                    tabIndex={-1}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) void handleImportSchema(file);
                      e.target.value = '';
                    }}
                  />
                </>
              }
            >
              A schema describes how one DynamoDB table is modeled: its entities, key patterns,
              indexes and saved queries. Create one from scratch or import an exported JSON.
            </EmptyState>
          </div>
        </main>
      ) : (
        <main aria-label="Workspace" className="flex flex-1 min-h-0 overflow-hidden">
          <Group className="flex-1 min-h-0 gap-1 p-2">
            <Panel defaultSize={20} minSize={14}>
              <Sidebar
                schema={schema}
                selectedEntityName={entity?.name ?? null}
                activeQueryId={ws.queryId}
                onSelectEntity={(name) => ws.dispatch({ type: 'selectEntity', name })}
                onSelectIndex={(entityName, indexName) =>
                  ws.dispatch({ type: 'selectIndex', entityName, indexName })
                }
                onSelectQuery={(query) => ws.dispatch({ type: 'selectQuery', query })}
                onAddEntity={(partitionKey) => ws.dispatch({ type: 'openNewEntity', partitionKey })}
                onEditEntity={(name) => ws.dispatch({ type: 'openEditEntity', name })}
                onDeleteEntity={(name) => void handleDeleteEntity(name)}
                onRenameQuery={(id, name) => store.renameQuery(id, name)}
                onDeleteQuery={(id) => {
                  store.deleteQuery(id);
                  ws.dispatch({ type: 'queryDeleted', id });
                }}
              />
            </Panel>
            <Separator className="w-1 cursor-col-resize hover:bg-accent/40 transition-colors rounded" />
            <Panel defaultSize={80} minSize={40}>
              <WorkspaceArea
                schema={schema}
                entity={entity}
                tableName={tableName}
                tab={ws.tab}
                onTabChange={(tab) => ws.dispatch({ type: 'setTab', tab })}
                loadedQuery={ws.loadedQuery}
                loadSeq={ws.loadSeq}
                activeQuery={activeQuery}
                executeDisabledReason={executeDisabledReason}
                onSaveQuery={(query) => {
                  store.addQuery(query);
                  ws.dispatch({ type: 'querySaved', id: query.id });
                }}
                onUpdateQuery={(query) => store.updateQuery(query)}
                onEditEntity={() => ws.dispatch({ type: 'openEditEntity' })}
              />
            </Panel>
          </Group>
        </main>
      )}

      <Footer theme={theme} />

      {schemaModal && (
        <SchemaModal
          mode={schemaModal}
          initial={schemaModal === 'edit' ? schema ?? undefined : undefined}
          onConfirm={(next: TableSchema) => {
            if (schemaModal === 'add') store.addSchema(next);
            else store.updateSchema(next);
            setSchemaModal(null);
          }}
          onClose={() => setSchemaModal(null)}
        />
      )}

      {ws.draft && schema && (
        <EntityDrawer
          schema={schema}
          entity={ws.draft.kind === 'edit' ? entity : null}
          initialPartitionKey={ws.draft.kind === 'new' ? ws.draft.partitionKey : ''}
          onSave={handleSaveEntity}
          onDelete={
            ws.draft.kind === 'edit' && entity ? () => void handleDeleteEntity(entity.name) : undefined
          }
          onClose={() => ws.dispatch({ type: 'closeDraft' })}
        />
      )}
    </div>
  );
}
