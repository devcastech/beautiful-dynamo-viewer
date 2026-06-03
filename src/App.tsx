import { startTransition, useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { LibrarySidebar, type SavedQueryRef } from "./components/LibrarySidebar.tsx";
import { SchemaModal } from "./components/SchemaModal.tsx";
import { WorkspaceArea, type WorkspaceTab } from "./components/WorkspaceArea.tsx";
import { ConnectionBar } from "./components/ConnectionBar.tsx";
import { schemaData } from "./data/schema.ts";
import { memoryAdapter } from "./adapters/storage/memoryAdapter.ts";
import { useSchemaStore } from "./hooks/useSchemaStore.ts";
import { buildPartitionGroups } from "./utils/warehouse.ts";
import { confirmDialog, alertDialog } from "./lib/dialog.ts";
import type { DynamoTable, Entity, SavedQuery } from "./types/schema.ts";
import { Panel, Group, Separator } from "react-resizable-panels";

const repo = memoryAdapter(schemaData.tables);

const GROUP_ACCENTS = [
  '#F59E0B', '#10B981', '#38BDF8', '#FB923C', '#A78BFA', '#94A3B8',
];

export default function App() {
  const store = useSchemaStore(repo);

  const [selectedEntityName, setSelectedEntityName] = useState<string | null>(null);
  const [initialQuery, setInitialQuery] = useState<SavedQuery | null>(null);
  const [activeQueryId, setActiveQueryId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('builder');

  const [awsProfiles, setAwsProfiles] = useState<string[]>([]);
  const [selectedAwsProfile, setSelectedAwsProfile] = useState<string | undefined>(undefined);
  const [isAwsLoginInProgress, setIsAwsLoginInProgress] = useState<boolean>(false);
  const [awsLogged, setAwsLogged] = useState<boolean>(false);
  const [region, setRegion] = useState<string>("us-east-1");
  const [tableNameOverride, setTableNameOverride] = useState<string | undefined>(undefined);

  const [schemaModal, setSchemaModal] = useState<"add" | "edit" | null>(null);

  const [inspectorEditMode, setInspectorEditMode] = useState(false);
  const [pendingNewEntity, setPendingNewEntity] = useState<Entity | null>(null);

  const activeSchema = store.activeSchema;
  const partitionGroups = activeSchema ? buildPartitionGroups(activeSchema) : [];
  const effectiveTableName = tableNameOverride ?? activeSchema?.table ?? "";

  const activeEntity =
    activeSchema?.entities.find((e) => e.name === selectedEntityName) ??
    activeSchema?.entities[0] ??
    null;

  const displayEntity = pendingNewEntity ?? activeEntity;
  const isEditMode = pendingNewEntity !== null || inspectorEditMode;

  const totalGsis = activeSchema?.entities.reduce((t, e) => t + e.gsis.length, 0) ?? 0;
  const totalPatterns = activeSchema?.entities.reduce((t, e) => t + e.savedQueries.length, 0) ?? 0;

  const accentByPartitionKey = useMemo(() => {
    const map: Record<string, string> = {};
    partitionGroups.forEach((g, i) => {
      map[g.partitionKey] = GROUP_ACCENTS[i % GROUP_ACCENTS.length];
    });
    return map;
  }, [partitionGroups]);

  const savedQueriesRefs: SavedQueryRef[] = useMemo(() => {
    if (!activeSchema) return [];
    return activeSchema.entities.flatMap((entity) =>
      entity.savedQueries.map((q) => ({
        query: q,
        entityName: entity.name,
        accent: accentByPartitionKey[entity.pk],
      })),
    );
  }, [activeSchema, accentByPartitionKey]);

  // ---- Schema handlers ----
  function handleSelectSchema(idx: number) {
    startTransition(() => {
      store.setActiveIdx(idx);
      resetWorkspace();
      setTableNameOverride(undefined);
    });
  }

  function resetWorkspace() {
    setSelectedEntityName(null);
    setInitialQuery(null);
    setActiveQueryId(null);
    setInspectorEditMode(false);
    setPendingNewEntity(null);
    setActiveTab('builder');
  }

  async function handleDeleteSchema() {
    const ok = await confirmDialog(
      `Delete schema "${activeSchema?.name}"? This cannot be undone.`,
      'Delete schema',
    );
    if (!ok) return;
    store.deleteSchema();
    resetWorkspace();
    setTableNameOverride(undefined);
  }

  // ---- Entity / query handlers ----
  function handleSelectEntity(_groupId: string, entityName: string) {
    startTransition(() => {
      setSelectedEntityName(entityName);
      setInitialQuery(null);
      setActiveQueryId(null);
      setInspectorEditMode(false);
      setPendingNewEntity(null);
      setActiveTab('builder');
    });
  }

  function handleSelectGsi(_groupId: string, entityName: string, gsiName: string) {
    setSelectedEntityName(entityName);
    setInitialQuery({
      id: '',
      name: '',
      target: gsiName,
      pkValues: {},
      skOp: 'none',
      skValues: {},
      sk2Values: {},
    });
    setInspectorEditMode(false);
    setPendingNewEntity(null);
    setActiveTab('builder');
  }

  function handleSelectSavedQuery(entityName: string, query: SavedQuery) {
    setSelectedEntityName(entityName);
    setInitialQuery(query);
    setInspectorEditMode(false);
    setPendingNewEntity(null);
    setActiveTab('builder');
  }

  function handleAddEntity(partitionKey: string) {
    setPendingNewEntity({
      name: "",
      pk: partitionKey,
      sk: "",
      role: "",
      priority: 1,
      description: "",
      gsis: [],
      attributes: [],
      savedQueries: [],
    });
    setInspectorEditMode(true);
    setActiveTab('schema');
  }

  function handleEditEntity(_groupId: string, entityName: string) {
    setSelectedEntityName(entityName);
    setPendingNewEntity(null);
    setInspectorEditMode(true);
    setInitialQuery(null);
    setActiveTab('schema');
  }

  async function handleDeleteEntity(entityName: string) {
    const ok = await confirmDialog(`Delete entity "${entityName}"?`, 'Delete entity');
    if (!ok) return;
    store.deleteEntity(entityName);
    resetWorkspace();
  }

  function handleSaveEntity(entity: Entity) {
    if (pendingNewEntity !== null) {
      store.addEntity(entity);
    } else if (activeEntity) {
      store.updateEntity(activeEntity.name, entity);
    }
    setPendingNewEntity(null);
    setInspectorEditMode(false);
    setSelectedEntityName(entity.name);
    setActiveTab('builder');
  }

  function handleCancelEdit() {
    setPendingNewEntity(null);
    setInspectorEditMode(false);
    setActiveTab('builder');
  }

  function handleSaveQuery(query: SavedQuery) {
    if (!activeEntity) return;
    store.updateEntity(activeEntity.name, {
      ...activeEntity,
      savedQueries: [...activeEntity.savedQueries, query],
    });
  }

  function handleUpdateQuery(query: SavedQuery) {
    if (!activeEntity) return;
    store.updateEntity(activeEntity.name, {
      ...activeEntity,
      savedQueries: activeEntity.savedQueries.map((q) => (q.id === query.id ? query : q)),
    });
  }

  function handleDeleteQuery(entityName: string, queryId: string) {
    const entity = activeSchema?.entities.find((e) => e.name === entityName);
    if (!entity) return;
    store.updateEntity(entityName, {
      ...entity,
      savedQueries: entity.savedQueries.filter((q) => q.id !== queryId),
    });
    if (activeQueryId === queryId) {
      setActiveQueryId(null);
      setInitialQuery(null);
    }
  }

  function handleRenameQuery(entityName: string, queryId: string, name: string) {
    const entity = activeSchema?.entities.find((e) => e.name === entityName);
    if (!entity) return;
    const query = entity.savedQueries.find((q) => q.id === queryId);
    if (!query) return;
    store.updateEntity(entityName, {
      ...entity,
      savedQueries: entity.savedQueries.map((q) => (q.id === queryId ? { ...q, name } : q)),
    });
  }

  // ---- Schema import/export ----
  async function handleExportSchema() {
    if (!activeSchema) return;
    const json = JSON.stringify(activeSchema, null, 2);
    const { save } = await import("@tauri-apps/plugin-dialog");
    const path = await save({
      defaultPath: `${activeSchema.name.replace(/\s+/g, "-").toLowerCase()}.schema.json`,
      filters: [{ name: "JSON", extensions: ["json"] }],
    });
    if (!path) return;
    await invoke("save_text_file", { path, contents: json });
  }

  async function handleImportSchema(file: File) {
    const text = await file.text();
    try {
      const data = JSON.parse(text) as DynamoTable;
      if (!data.name || !data.table || !Array.isArray(data.entities)) {
        await alertDialog('Invalid schema file: must contain name, table, and entities.', 'Import error');
        return;
      }
      store.addSchema(data);
    } catch {
      await alertDialog('Failed to parse JSON file.', 'Import error');
    }
  }

  // ---- AWS handlers ----
  useEffect(() => {
    invoke<string[]>("list_aws_profiles").then(setAwsProfiles);
  }, []);

  async function handleSelectProfile(profile: string) {
    if (!profile) return;
    setSelectedAwsProfile(profile);
    setIsAwsLoginInProgress(true);
    const isValid = await invoke<boolean>("check_aws_profile", { profile });
    if (!isValid) {
      setAwsLogged(false);
      setIsAwsLoginInProgress(false);
      return;
    }
    setIsAwsLoginInProgress(false);
    setAwsLogged(true);
    await invoke("set_aws_profile", { profile, region });
  }

  async function handleSsoLogin() {
    if (!selectedAwsProfile) return;
    setIsAwsLoginInProgress(true);
    await invoke("aws_sso_login", { profile: selectedAwsProfile });
    setIsAwsLoginInProgress(false);
    await handleSelectProfile(selectedAwsProfile);
  }

  return (
    <div className="flex flex-col h-screen bg-canvas overflow-hidden">
      <ConnectionBar
        schemas={store.schemas}
        activeSchemaIdx={store.activeIdx}
        activeSchemaName={activeSchema?.name}
        hasActiveSchema={!!activeSchema}
        onSelectSchema={handleSelectSchema}
        onNewSchema={() => setSchemaModal("add")}
        onImportSchema={handleImportSchema}
        onEditSchema={() => setSchemaModal("edit")}
        onExportSchema={handleExportSchema}
        onDeleteSchema={handleDeleteSchema}
        tableName={effectiveTableName}
        onTableNameChange={setTableNameOverride}
        region={region}
        onRegionChange={setRegion}
        awsProfiles={awsProfiles}
        selectedProfile={selectedAwsProfile}
        loginInProgress={isAwsLoginInProgress}
        authed={awsLogged}
        onSelectProfile={handleSelectProfile}
        onSsoLogin={handleSsoLogin}
        entityCount={activeSchema?.entities.length ?? 0}
        gsiCount={totalGsis}
        patternCount={totalPatterns}
      />

      <main aria-label="Workspace" className="flex flex-1 min-h-0 overflow-hidden">
        <Group className="flex-1 min-h-0 gap-1 p-2">
          <Panel defaultSize={20} minSize={14}>
            <LibrarySidebar
              groups={partitionGroups}
              savedQueries={savedQueriesRefs}
              selectedEntityName={activeEntity?.name ?? null}
              activeQueryId={activeQueryId}
              onSelectEntity={handleSelectEntity}
              onSelectGsi={handleSelectGsi}
              onSelectQuery={handleSelectSavedQuery}
              onAddEntity={handleAddEntity}
              onEditEntity={handleEditEntity}
              onDeleteEntity={handleDeleteEntity}
              onRenameQuery={handleRenameQuery}
              onDeleteQuery={handleDeleteQuery}
            />
          </Panel>
          <Separator className="w-1 cursor-col-resize hover:bg-accent/40 transition-colors rounded" />
          <Panel defaultSize={80} minSize={40}>
            <WorkspaceArea
              entity={displayEntity}
              tableName={effectiveTableName}
              activeTab={activeTab}
              onTabChange={setActiveTab}
              initialQuery={initialQuery}
              activeQueryId={activeQueryId}
              onActiveQueryChange={setActiveQueryId}
              onSaveQuery={!isEditMode ? handleSaveQuery : undefined}
              onUpdateQuery={!isEditMode ? handleUpdateQuery : undefined}
              isEditMode={isEditMode}
              isNewEntity={pendingNewEntity !== null}
              onEnterEdit={() => { setInspectorEditMode(true); setActiveTab('schema'); }}
              onSaveEntity={handleSaveEntity}
              onCancelEdit={handleCancelEdit}
              onDeleteEntity={activeEntity ? () => handleDeleteEntity(activeEntity.name) : undefined}
            />
          </Panel>
        </Group>
      </main>

      {schemaModal && (
        <SchemaModal
          mode={schemaModal}
          initial={schemaModal === "edit" ? activeSchema ?? undefined : undefined}
          onConfirm={(s) => {
            if (schemaModal === "add") store.addSchema(s);
            else store.updateSchema(s);
            setSchemaModal(null);
          }}
          onClose={() => setSchemaModal(null)}
        />
      )}
    </div>
  );
}
