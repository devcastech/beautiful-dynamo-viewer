import { startTransition, useEffect, useMemo, useRef, useState } from "react";
import { LibrarySidebar, type SavedQueryRef } from "./components/LibrarySidebar.tsx";
import { OverflowMenu } from "./components/OverflowMenu.tsx";
import { SchemaModal } from "./components/SchemaModal.tsx";
import { WorkspaceArea, type WorkspaceTab } from "./components/WorkspaceArea.tsx";
import { schemaData } from "./data/schema.ts";
import { memoryAdapter } from "./adapters/storage/memoryAdapter.ts";
import { useSchemaStore } from "./hooks/useSchemaStore.ts";
import { buildPartitionGroups } from "./utils/warehouse.ts";
import type { DynamoTable, Entity, SavedQuery } from "./types/schema.ts";
import { Panel, Group, Separator } from "react-resizable-panels";
import { Check, CircleAlert, Download, LoaderCircle, Pencil, Plus, Trash2, Upload } from "lucide-react";

const { invoke } = await import("@tauri-apps/api/core");

const repo = memoryAdapter(schemaData.tables);

const AWS_REGIONS = [
  "us-east-1", "us-east-2", "us-west-1", "us-west-2",
  "ca-central-1",
  "eu-west-1", "eu-west-2", "eu-west-3", "eu-central-1", "eu-north-1",
  "ap-southeast-1", "ap-southeast-2", "ap-northeast-1", "ap-northeast-2",
  "ap-south-1", "sa-east-1",
];

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

  // Schema management
  const [schemaModal, setSchemaModal] = useState<"add" | "edit" | null>(null);

  // Entity edit state
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

  // Accent map: partition-key string → color
  const accentByPartitionKey = useMemo(() => {
    const map: Record<string, string> = {};
    partitionGroups.forEach((g, i) => {
      map[g.partitionKey] = GROUP_ACCENTS[i % GROUP_ACCENTS.length];
    });
    return map;
  }, [partitionGroups]);

  // Flat list of saved queries (across all entities)
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

  function handleDeleteSchema() {
    if (!window.confirm(`Delete schema "${activeSchema?.name}"? This cannot be undone.`)) return;
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

  function handleDeleteEntity(entityName: string) {
    if (!window.confirm(`Delete entity "${entityName}"?`)) return;
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
  const importInputRef = useRef<HTMLInputElement>(null);

  async function handleExportSchema() {
    if (!activeSchema) return;
    const json = JSON.stringify(activeSchema, null, 2);
    const { save } = await import("@tauri-apps/plugin-dialog");
    const path = await save({
      defaultPath: `${activeSchema.name.replace(/\s+/g, "-").toLowerCase()}.schema.json`,
      filters: [{ name: "JSON", extensions: ["json"] }],
    });
    if (!path) return; // user cancelled the dialog
    await invoke("save_text_file", { path, contents: json });
  }

  function handleImportSchema(file: File) {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string) as DynamoTable;
        if (!data.name || !data.table || !Array.isArray(data.entities)) {
          alert('Invalid schema file: must contain name, table, and entities.');
          return;
        }
        store.addSchema(data);
      } catch {
        alert('Failed to parse JSON file.');
      }
    };
    reader.readAsText(file);
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

  return (
    <div className="flex flex-col h-screen bg-canvas overflow-hidden">
      {/* Top bar */}
      <header className="flex items-center gap-3 px-4 h-12 shrink-0 border-b border-line-dim">
        {/* Brand */}
        <div className="flex items-center gap-2">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <rect x="2" y="1" width="12" height="3" rx="1" fill="var(--accent)" opacity="0.9" />
            <rect x="2" y="6" width="12" height="3" rx="1" fill="var(--accent)" opacity="0.6" />
            <rect x="2" y="11" width="12" height="3" rx="1" fill="var(--accent)" opacity="0.35" />
          </svg>
          <span className="font-mono font-semibold text-[13px] text-primary tracking-[0.02em]">
            dynamo<span className="text-accent">.</span>viewer
          </span>
        </div>

        <Divider />

        {/* ── Schema region ── */}
        <div className="flex gap-1.5 items-center" role="group" aria-label="Schema">
          <label htmlFor="schema-selector" className="shrink-0 text-[11px] text-muted font-mono uppercase tracking-[0.06em]">schema</label>
          {store.schemas.length > 1 ? (
            <select
              id="schema-selector"
              value={store.activeIdx}
              onChange={(e) => handleSelectSchema(Number(e.target.value))}
              className="bg-elevated border border-line rounded-[5px] text-primary font-mono text-xs px-2 py-[4px] cursor-pointer outline-none"
            >
              {store.schemas.map((s, i) => (
                <option key={i} value={i}>{s.name}</option>
              ))}
            </select>
          ) : (
            <span id="schema-selector" className="font-mono text-xs text-primary px-2 py-[4px] bg-elevated/60 rounded-[5px]">
              {activeSchema?.name ?? "—"}
            </span>
          )}
          <button
            type="button"
            title="New schema"
            aria-label="New schema"
            onClick={() => setSchemaModal("add")}
            className={ICON_BTN}
          >
            <Plus size={14} aria-hidden="true" />
          </button>
          <input
            ref={importInputRef}
            type="file"
            accept=".json"
            className="hidden"
            aria-hidden="true"
            tabIndex={-1}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleImportSchema(file);
              e.target.value = '';
            }}
          />
          <OverflowMenu
            ariaLabel="More schema actions"
            items={
              activeSchema
                ? [
                    { label: 'Import from JSON', icon: <Upload size={13} />, onClick: () => importInputRef.current?.click() },
                    { label: 'Edit schema', icon: <Pencil size={13} />, onClick: () => setSchemaModal('edit') },
                    { label: 'Export as JSON', icon: <Download size={13} />, onClick: handleExportSchema },
                    { label: 'Delete schema', icon: <Trash2 size={13} />, onClick: handleDeleteSchema, danger: true },
                  ]
                : [
                    { label: 'Import from JSON', icon: <Upload size={13} />, onClick: () => importInputRef.current?.click() },
                  ]
            }
          />
        </div>

        <Divider />

        {/* ── Connection region ── */}
        <div className="flex gap-3 items-center" role="group" aria-label="Connection settings">
          {/* Table name */}
          <div className="flex gap-1.5 items-center">
            <label htmlFor="table-name" className="shrink-0 text-[11px] text-muted font-mono uppercase tracking-[0.06em]">table</label>
            <input
              id="table-name"
              value={effectiveTableName}
              onChange={(e) => setTableNameOverride(e.target.value)}
              className="bg-elevated border border-line rounded-[5px] text-primary font-mono text-xs px-2 py-[4px] outline-none w-48 focus:border-accent/50 transition-colors"
              spellCheck={false}
            />
          </div>

          {/* Region */}
          <div className="flex gap-1.5 items-center">
            <label htmlFor="aws-region" className="shrink-0 text-[11px] text-muted font-mono uppercase tracking-[0.06em]">region</label>
            <select
              id="aws-region"
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              className="bg-elevated border border-line rounded-[5px] text-primary font-mono text-xs px-2 py-[4px] cursor-pointer outline-none"
            >
              {AWS_REGIONS.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>

          {/* Profile + auth status */}
          <div className="flex gap-1.5 items-center">
            <label htmlFor="aws-profile" className="shrink-0 text-[11px] text-muted font-mono uppercase tracking-[0.06em]">profile</label>
            <select
              onChange={(e) => handleProfile(e.target.value)}
              name="aws-profile"
              id="aws-profile"
              defaultValue=""
              className="bg-elevated border border-line rounded-[5px] text-primary font-mono text-xs px-2 py-[4px] cursor-pointer outline-none"
            >
              <option value="">— select —</option>
              {awsProfiles.map((p, i) => (
                <option key={p + i} value={p}>{p}</option>
              ))}
            </select>
            <AuthStatusBadge
              profile={selectedAwsProfile}
              loading={isAwsLoginInProgress}
              authed={awsLogged}
              onLogin={() => selectedAwsProfile && handleAwsSsoLogin(selectedAwsProfile)}
            />
          </div>
        </div>

        {/* Stats */}
        <div className="ml-auto flex gap-3 items-center" role="group" aria-label="Schema statistics">
          <StatPill label="entities" value={activeSchema?.entities.length ?? 0} />
          <StatPill label="GSIs" value={totalGsis} />
          <StatPill label="patterns" value={totalPatterns} />
        </div>
      </header>

      {/* Main area: sidebar + workspace */}
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
    <div className="flex items-baseline gap-1" aria-label={`${value} ${label}`}>
      <span aria-hidden="true" className="font-mono text-[13px] font-semibold text-secondary">{value}</span>
      <span aria-hidden="true" className="text-xs text-muted">{label}</span>
    </div>
  );
}

function Divider() {
  return <div className="w-px h-5 bg-line-dim shrink-0" aria-hidden="true" />;
}

function AuthStatusBadge({
  profile,
  loading,
  authed,
  onLogin,
}: {
  profile: string | undefined;
  loading: boolean;
  authed: boolean;
  onLogin: () => void;
}) {
  if (loading) {
    return (
      <div className="flex items-center gap-1 px-2 py-[3px] rounded-[5px] bg-elevated border border-line" aria-live="polite">
        <LoaderCircle width={11} height={11} className="animate-spin text-muted" aria-hidden="true" />
        <span className="font-mono text-[10px] text-muted">checking…</span>
      </div>
    );
  }
  if (!profile) {
    return (
      <span className="font-mono text-[10px] text-muted/60 px-1.5" aria-label="No profile selected">
        not connected
      </span>
    );
  }
  if (authed) {
    return (
      <div className="flex items-center gap-1 px-2 py-[3px] rounded-[5px] bg-[rgba(16,185,129,0.08)] border border-[rgba(16,185,129,0.25)]" aria-live="polite">
        <Check width={11} height={11} className="text-ok" aria-hidden="true" />
        <span className="font-mono text-[10px] text-ok">connected</span>
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={onLogin}
      aria-label={`Sign in to AWS profile ${profile}`}
      className="flex items-center gap-1 font-mono text-[10px] text-accent hover:bg-accent-dim bg-transparent border border-accent-line rounded-[5px] px-2 py-[3px] cursor-pointer transition-colors"
    >
      <CircleAlert width={11} height={11} aria-hidden="true" />
      sign in
    </button>
  );
}

const ICON_BTN =
  "text-muted hover:text-primary hover:bg-elevated bg-transparent border-0 cursor-pointer p-1.5 rounded transition-colors";
