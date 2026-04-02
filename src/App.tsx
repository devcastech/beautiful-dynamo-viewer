import { startTransition, useEffect, useState } from "react";
import { EntityBrowser } from "./components/EntityBrowser.tsx";
import { EntityInspector } from "./components/EntityInspector.tsx";
import { QueryPlayground } from "./components/QueryPlayground.tsx";
import { SchemaModal } from "./components/SchemaModal.tsx";
import { schemaData } from "./data/schema.ts";
import { memoryAdapter } from "./adapters/storage/memoryAdapter.ts";
import { useSchemaStore } from "./hooks/useSchemaStore.ts";
import { buildPartitionGroups } from "./utils/warehouse.ts";
import type { Entity, SavedQuery } from "./types/schema.ts";
import { Panel, Group, Separator } from "react-resizable-panels";
import { Check, LoaderCircle, Pencil, Plus, Trash2 } from "lucide-react";

const { invoke } = await import("@tauri-apps/api/core");

const repo = memoryAdapter(schemaData.tables);

const AWS_REGIONS = [
  "us-east-1", "us-east-2", "us-west-1", "us-west-2",
  "ca-central-1",
  "eu-west-1", "eu-west-2", "eu-west-3", "eu-central-1", "eu-north-1",
  "ap-southeast-1", "ap-southeast-2", "ap-northeast-1", "ap-northeast-2",
  "ap-south-1", "sa-east-1",
];

export default function App() {
  const store = useSchemaStore(repo);

  const [selectedEntityByGroup, setSelectedEntityByGroup] = useState<Record<string, string>>({});
  const [activeQuery, setActiveQuery] = useState<SavedQuery | null>(null);
  const [awsProfiles, setAwsProfiles] = useState<string[]>([]);
  const [selectedAwsProfile, setSelectedAwsProfile] = useState<string | undefined>(undefined);
  const [isAwsLoginInProgress, setIsAwsLoginInProgress] = useState<boolean>(false);
  const [awsLogged, setAwsLogged] = useState<boolean>(false);
  const [region, setRegion] = useState<string>("us-east-1");
  const [tableNameOverride, setTableNameOverride] = useState<string | undefined>(undefined);

  // Schema management
  const [schemaModal, setSchemaModal] = useState<"add" | "edit" | null>(null);

  // Entity edit state
  const [inspectorEditMode, setInspectorEditMode] = useState(false);
  const [pendingNewEntity, setPendingNewEntity] = useState<Entity | null>(null);

  const activeSchema = store.activeSchema;
  const partitionGroups = activeSchema ? buildPartitionGroups(activeSchema) : [];
  const effectiveTableName = tableNameOverride ?? activeSchema?.table ?? "";

  const activeEntityName = Object.values(selectedEntityByGroup).find(Boolean) ?? null;
  const activeEntity =
    activeSchema?.entities.find((e) => e.name === activeEntityName) ??
    activeSchema?.entities[0] ??
    null;

  const displayEntity = pendingNewEntity ?? activeEntity;
  const isEditMode = pendingNewEntity !== null || inspectorEditMode;

  const totalGsis = activeSchema?.entities.reduce((t, e) => t + e.gsis.length, 0) ?? 0;
  const totalPatterns = activeSchema?.entities.reduce((t, e) => t + e.savedQueries.length, 0) ?? 0;

  // ---- Schema handlers ----
  function handleSelectSchema(idx: number) {
    startTransition(() => {
      store.setActiveIdx(idx);
      setSelectedEntityByGroup({});
      setActiveQuery(null);
      setTableNameOverride(undefined);
      setInspectorEditMode(false);
      setPendingNewEntity(null);
    });
  }

  function handleDeleteSchema() {
    if (!window.confirm(`Delete schema "${activeSchema?.name}"? This cannot be undone.`)) return;
    store.deleteSchema();
    setSelectedEntityByGroup({});
    setActiveQuery(null);
    setTableNameOverride(undefined);
    setInspectorEditMode(false);
    setPendingNewEntity(null);
  }

  // ---- Entity handlers ----
  function handleSelectEntity(groupId: string, entityName: string) {
    startTransition(() => {
      setSelectedEntityByGroup({ [groupId]: entityName });
      setActiveQuery(null);
      setInspectorEditMode(false);
      setPendingNewEntity(null);
    });
  }

  function handleSelectGsi(groupId: string, entityName: string, gsiName: string) {
    setSelectedEntityByGroup({ [groupId]: entityName });
    setActiveQuery({ id: '', name: '', target: gsiName, pkValues: {}, skOp: 'none', skValues: {}, sk2Values: {} });
    setInspectorEditMode(false);
    setPendingNewEntity(null);
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
  }

  function handleEditEntity(groupId: string, entityName: string) {
    setSelectedEntityByGroup({ [groupId]: entityName });
    setPendingNewEntity(null);
    setInspectorEditMode(true);
    setActiveQuery(null);
  }

  function handleDeleteEntity(entityName: string) {
    if (!window.confirm(`Delete entity "${entityName}"?`)) return;
    store.deleteEntity(entityName);
    setSelectedEntityByGroup({});
    setInspectorEditMode(false);
    setPendingNewEntity(null);
  }

  function handleSaveEntity(entity: Entity) {
    if (pendingNewEntity !== null) {
      store.addEntity(entity);
    } else if (activeEntity) {
      store.updateEntity(activeEntity.name, entity);
    }
    setPendingNewEntity(null);
    setInspectorEditMode(false);
    setSelectedEntityByGroup({});
    setActiveQuery(null);
  }

  function handleCancelEdit() {
    setPendingNewEntity(null);
    setInspectorEditMode(false);
  }

  function handleRunQuery(query: SavedQuery) {
    setActiveQuery(query);
  }

  function handleSaveQuery(query: SavedQuery) {
    if (!activeEntity) return;
    store.updateEntity(activeEntity.name, {
      ...activeEntity,
      savedQueries: [...activeEntity.savedQueries, query],
    });
  }

  // ---- AWS handlers ----
  useEffect(() => {
    async function getProfiles() {
      const result = await invoke("list_aws_profiles");
      setAwsProfiles(result as string[]);
    }
    getProfiles().then();
  }, []);

  const handleProfile = async (profile: string) => {
    if (!profile) { alert("Please select profile"); return; }
    setSelectedAwsProfile(profile);
    setIsAwsLoginInProgress(true);
    const isValidProfile = await invoke("check_aws_profile", { profile });
    if (!isValidProfile) {
      setAwsLogged(false);
      setIsAwsLoginInProgress(false);
      return;
    }
    setIsAwsLoginInProgress(false);
    setAwsLogged(true);
    await invoke("set_aws_profile", { profile, region });
  };

  const handleAwsSsoLogin = async (profile: string) => {
    setIsAwsLoginInProgress(true);
    setSelectedAwsProfile(profile);
    await invoke("aws_sso_login", { profile });
    setIsAwsLoginInProgress(false);
    handleProfile(profile);
  };

  // ---- Render ----
  const inspectorNode = displayEntity ? (
    <EntityInspector
      key={`${displayEntity.name || "new"}::${isEditMode}`}
      entity={displayEntity}
      editMode={isEditMode}
      isNew={pendingNewEntity !== null}
      onRunQuery={!isEditMode ? handleRunQuery : undefined}
      onEnterEdit={() => setInspectorEditMode(true)}
      onSave={handleSaveEntity}
      onCancelEdit={handleCancelEdit}
      onDelete={activeEntity ? () => handleDeleteEntity(activeEntity.name) : undefined}
    />
  ) : (
    <EmptyInspector />
  );

  const queryNode = displayEntity ? (
    <QueryPlayground
      key={displayEntity.name}
      entity={displayEntity}
      tableName={effectiveTableName}
      initialQuery={activeQuery}
      onSaveQuery={!isEditMode ? handleSaveQuery : undefined}
    />
  ) : (
    <EmptyInspector />
  );

  return (
    <div className="flex flex-col h-screen bg-canvas overflow-hidden">
      {/* Top bar */}
      <header className="flex items-center gap-4 px-4 h-11 shrink-0">
        {/* Brand */}
        <div className="flex items-center gap-2">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <rect x="2" y="1" width="12" height="3" rx="1" fill="var(--accent)" opacity="0.9" />
            <rect x="2" y="6" width="12" height="3" rx="1" fill="var(--accent)" opacity="0.6" />
            <rect x="2" y="11" width="12" height="3" rx="1" fill="var(--accent)" opacity="0.35" />
          </svg>
          <span className="font-mono font-semibold text-[13px] text-primary tracking-[0.02em]">
            dynamo<span className="text-accent">.</span>viewer
          </span>
        </div>

        <div className="w-px h-5 bg-line" />

        {/* Schema selector */}
        <div className="flex gap-1.5 items-center">
          <label className="shrink-0 text-xs text-muted font-mono">schema</label>
          {store.schemas.length > 1 ? (
            <select
              value={store.activeIdx}
              onChange={(e) => handleSelectSchema(Number(e.target.value))}
              className="bg-elevated border border-line rounded-[5px] text-primary font-mono text-xs px-2 py-[3px] cursor-pointer outline-none"
            >
              {store.schemas.map((s, i) => (
                <option key={i} value={i}>{s.name}</option>
              ))}
            </select>
          ) : (
            <span className="font-mono text-xs text-primary">{activeSchema?.name ?? "—"}</span>
          )}
          <button
            type="button"
            title="New schema"
            onClick={() => setSchemaModal("add")}
            className={ICON_BTN}
          >
            <Plus size={12} />
          </button>
          {activeSchema && (
            <>
              <button
                type="button"
                title="Edit schema"
                onClick={() => setSchemaModal("edit")}
                className={ICON_BTN}
              >
                <Pencil size={12} />
              </button>
              <button
                type="button"
                title="Delete schema"
                onClick={handleDeleteSchema}
                className={`${ICON_BTN} hover:text-red-400`}
              >
                <Trash2 size={12} />
              </button>
            </>
          )}
        </div>

        {/* Table name (connection param) */}
        <div className="flex gap-1.5 items-center">
          <label className="shrink-0 text-xs text-muted/60 font-mono">table</label>
          <input
            value={effectiveTableName}
            onChange={(e) => setTableNameOverride(e.target.value)}
            className="bg-elevated border border-line rounded-[5px] text-primary font-mono text-xs px-2 py-[3px] outline-none w-48 text-muted/80"
            spellCheck={false}
          />
        </div>

        <div className="flex gap-2 items-center">
          <label htmlFor="aws-region" className="shrink-0 text-xs text-muted font-mono">region</label>
          <select
            id="aws-region"
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            className="bg-elevated border border-line rounded-[5px] text-primary font-mono text-xs px-2 py-[3px] cursor-pointer outline-none"
          >
            {AWS_REGIONS.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>

        <div className="flex gap-2 items-center">
          <label htmlFor="aws-profile" className="shrink-0 text-xs text-muted font-mono">profile</label>
          <select
            onChange={(e) => handleProfile(e.target.value)}
            name="aws-profile"
            id="aws-profile"
            className="bg-elevated border border-line rounded-[5px] text-primary font-mono text-xs px-2 py-[3px] cursor-pointer outline-none"
          >
            <option value="">Select a profile</option>
            {awsProfiles.map((p, i) => (
              <option key={p + i} value={p}>{p}</option>
            ))}
          </select>
          <div className="flex justify-center items-center">
            {isAwsLoginInProgress && <LoaderCircle width="12" height="12" className="animate-spin" />}
          </div>
          {!isAwsLoginInProgress && selectedAwsProfile && (
            <div className="flex justify-center items-center">
              {awsLogged ? (
                <Check className="text-green-500" width="12" height="12" />
              ) : (
                <button onClick={() => handleAwsSsoLogin(selectedAwsProfile)}>login</button>
              )}
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="ml-auto flex gap-3 items-center">
          <StatPill label="entities" value={activeSchema?.entities.length ?? 0} />
          <StatPill label="GSIs" value={totalGsis} />
          <StatPill label="patterns" value={totalPatterns} />
        </div>
      </header>

      <Group className="gap-1">
        <Panel defaultSize="15%" minSize="150px">
          <div className="h-full shrink-0 border border-line bg-surface overflow-hidden flex flex-col rounded-2xl">
            <EntityBrowser
              groups={partitionGroups}
              selectedEntityByGroup={selectedEntityByGroup}
              onSelect={handleSelectEntity}
              onSelectGsi={handleSelectGsi}
              onAddEntity={handleAddEntity}
              onEditEntity={handleEditEntity}
              onDeleteEntity={handleDeleteEntity}
            />
          </div>
        </Panel>
        <Separator />
        <Panel defaultSize="30%" minSize="150px">
          <div className="h-full flex-1 min-w-0 border border-line bg-canvas overflow-hidden flex flex-col rounded-2xl">
            <ColHeader label="SCHEMA" />
            <div className="flex-1 overflow-hidden">{inspectorNode}</div>
          </div>
        </Panel>
        <Separator />
        <Panel minSize="150px">
          <div className="h-full dot-grid flex-1 min-w-0 border border-line overflow-hidden flex flex-col rounded-2xl">
            <ColHeader label="QUERY" glassy />
            <div className="flex-1 overflow-hidden">{queryNode}</div>
          </div>
        </Panel>
      </Group>

      {/* 3-column body */}
      <div className="flex flex-1 overflow-hidden min-h-0 gap-2 p-2">
        <div className="w-[260px] shrink-0 border border-line bg-surface overflow-hidden flex flex-col rounded-2xl">
          <EntityBrowser
            groups={partitionGroups}
            selectedEntityByGroup={selectedEntityByGroup}
            onSelect={handleSelectEntity}
            onAddEntity={handleAddEntity}
            onEditEntity={handleEditEntity}
            onDeleteEntity={handleDeleteEntity}
          />
        </div>

        <div className="flex-1 min-w-0 border border-line bg-canvas overflow-hidden flex flex-col rounded-2xl">
          <ColHeader label="SCHEMA" />
          <div className="flex-1 overflow-hidden">{inspectorNode}</div>
        </div>

        <div className="dot-grid flex-1 min-w-0 border border-line overflow-hidden flex flex-col rounded-2xl">
          <ColHeader label="QUERY" glassy />
          <div className="flex-1 overflow-hidden">{queryNode}</div>
        </div>
      </div>

      {/* Schema modal */}
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

function StatPill({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-baseline gap-1">
      <span className="font-mono text-[13px] font-semibold text-secondary">{value}</span>
      <span className="text-xs text-muted">{label}</span>
    </div>
  );
}

function ColHeader({ label, glassy }: { label: string; glassy?: boolean }) {
  return (
    <div className={`px-4 py-2 border-b border-line shrink-0 ${glassy ? "bg-[rgba(19,22,32,0.85)]" : "bg-surface"}`}>
      <span className="font-mono text-[11px] font-semibold tracking-[0.1em] text-muted uppercase">
        {label}
      </span>
    </div>
  );
}

function EmptyInspector() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-muted text-xs font-ui gap-1">
      <span className="text-muted/50">No schema loaded</span>
      <span className="text-muted/30">Create one with the + button above</span>
    </div>
  );
}

const ICON_BTN =
  "text-muted hover:text-primary bg-transparent border-0 cursor-pointer p-0.5 rounded transition-colors";
