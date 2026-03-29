import { startTransition, useEffect, useState } from 'react';
import { EntityBrowser } from './components/EntityBrowser.tsx';
import { EntityInspector } from './components/EntityInspector.tsx';
import { QueryPlayground } from './components/QueryPlayground.tsx';
import { schemaData } from './data/schema.ts';
import { buildPartitionGroups } from './utils/warehouse.ts';
const { invoke } = await import('@tauri-apps/api/core');

export default function App() {
  const [activeTableIdx, setActiveTableIdx] = useState(0);
  const [selectedEntityByGroup, setSelectedEntityByGroup] = useState<Record<string, string>>({});
  const [queryPattern, setQueryPattern] = useState<string | undefined>(undefined);
  const [awsProfiles, setAwsProfiles] = useState<string[]>([]);

  const activeTable = schemaData.tables[activeTableIdx];
  const partitionGroups = buildPartitionGroups(activeTable);

  // Derive the active entity from selectedEntityByGroup across all groups
  const activeEntityName = Object.values(selectedEntityByGroup).find(Boolean) ?? null;
  const activeEntity =
    activeTable.entities.find((e) => e.name === activeEntityName) ?? activeTable.entities[0];

  const totalGsis = activeTable.entities.reduce((t, e) => t + e.gsis.length, 0);
  const totalPatterns = activeTable.entities.reduce((t, e) => t + e.accessPatterns.length, 0);

  function handleSelectTable(index: number) {
    startTransition(() => {
      setActiveTableIdx(index);
      setSelectedEntityByGroup({});
      setQueryPattern(undefined);
    });
  }

  function handleSelectEntity(groupId: string, entityName: string) {
    startTransition(() => {
      // Clear other groups' selection so only one entity is active
      setSelectedEntityByGroup({ [groupId]: entityName });
      setQueryPattern(undefined);
    });
  }

  function handleUsePattern(pattern: string) {
    setQueryPattern(pattern);
  }

  useEffect(() => {
    async function getProfiles() {
      const result = await invoke('list_aws_profiles');
      setAwsProfiles(result as string[]);
    }
    getProfiles().then();
  }, []);

  const handleProfile = async (profile: string) => {
    if (!profile) {
      alert('Please select profile');
      return;
    }
    const result = await invoke('set_aws_profile', {
      profile,
      region: 'us-east-1',
    });
    alert(JSON.stringify(result));
    console.log(result);
  };

  return (
    <div className="flex flex-col h-screen bg-canvas overflow-hidden">
      {/* Top bar */}
      <header className="flex items-center gap-4 px-4 h-11  shrink-0">
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

        <div className="flex gap-2">
          <label htmlFor="table-select">table</label>
          {schemaData.tables.length === 1 ? (
            <span className="font-mono text-xs text-secondary">{activeTable.table}</span>
          ) : (
            <select
              id="table-select"
              value={activeTableIdx}
              onChange={(e) => handleSelectTable(Number(e.target.value))}
              className="bg-elevated border border-line rounded-[5px] text-primary font-mono text-xs px-2 py-[3px] cursor-pointer outline-none"
            >
              {schemaData.tables.map((t, i) => (
                <option key={t.table} value={i}>
                  {t.table}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="flex gap-2">
          <label htmlFor="aws-profile">aws profile</label>
          <select
            onChange={(e) => {
              handleProfile(e.target.value);
            }}
            name="aws-profile"
            id="aws-profile"
            className="bg-elevated border border-line rounded-[5px] text-primary font-mono text-xs px-2 py-[3px] cursor-pointer outline-none"
          >
            <option>Select a profile</option>
            {awsProfiles.map((p, i) => (
              <option key={p+i} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>

        {/* Stats */}
        <div className="ml-auto flex gap-3 items-center">
          <StatPill label="entities" value={activeTable.entities.length} />
          <StatPill label="GSIs" value={totalGsis} />
          <StatPill label="patterns" value={totalPatterns} />
        </div>
      </header>

      {/* 3-column body */}
      <div className="flex flex-1 overflow-hidden min-h-0 gap-2 p-2">
        {/* Left: Entity Browser */}
        <div className="w-[260px] shrink-0 border border-line bg-surface overflow-hidden flex flex-col rounded-2xl">
          <EntityBrowser
            groups={partitionGroups}
            selectedEntityByGroup={selectedEntityByGroup}
            onSelect={handleSelectEntity}
          />
        </div>

        {/* Center: Schema */}
        <div className="flex-1 min-w-0 border border-line bg-canvas overflow-hidden flex flex-col rounded-2xl">
          <ColHeader label="SCHEMA" />
          <div className="flex-1 overflow-hidden">
            <EntityInspector
              key={activeEntity.name}
              entity={activeEntity}
              onUsePattern={handleUsePattern}
            />
          </div>
        </div>

        {/* Right: Query Playground */}
        <div className="dot-grid flex-1 min-w-0 border border-line overflow-hidden flex flex-col rounded-2xl">
          <ColHeader label="QUERY" glassy />
          <div className="flex-1 overflow-hidden">
            <QueryPlayground
              key={`${activeEntity.name}::${queryPattern}`}
              entity={activeEntity}
              tableName={activeTable.table}
              initialPattern={queryPattern}
            />
          </div>
        </div>
      </div>
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
    <div
      className={`px-4 py-2 border-b border-line shrink-0 ${glassy ? 'bg-[rgba(19,22,32,0.85)]' : 'bg-surface'}`}
    >
      <span className="font-mono text-[11px] font-semibold tracking-[0.1em] text-muted uppercase">
        {label}
      </span>
    </div>
  );
}
