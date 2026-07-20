import { useMemo, useState } from "react";
import { Boxes, Plus, Search, X } from "lucide-react";
import { IconButton } from "../ui/Button.tsx";
import { accentByPartitionKey, buildPartitionGroups } from "../../domain/schema/grouping.ts";
import type { Entity, SavedQuery, TableSchema } from "../../domain/schema/types.ts";
import { Dot, EmptyHint, SectionHeader, Stat } from "./utils.tsx";
import { SidebarTreeProvider } from "./TreeContext.tsx";
import { TreeEntities, type TreeGroup } from "./TreeEntities.tsx";

type TreeEntity = { entity: Entity; queries: SavedQuery[] };

interface SidebarProps {
  schema: TableSchema;
  selectedEntityName: string | null;
  activeQueryId: string | null;
  onSelectEntity: (name: string) => void;
  onSelectIndex: (entityName: string, indexName: string) => void;
  onSelectQuery: (query: SavedQuery) => void;
  onAddEntity: (partitionKey: string) => void;
  onEditEntity: (name: string) => void;
  onDeleteEntity: (name: string) => void;
  onRenameQuery: (id: string, name: string) => void;
  onDeleteQuery: (id: string) => void;
}

export function Sidebar({
  schema,
  selectedEntityName,
  activeQueryId,
  onSelectEntity,
  onSelectIndex,
  onSelectQuery,
  onAddEntity,
  onEditEntity,
  onDeleteEntity,
  onRenameQuery,
  onDeleteQuery,
}: SidebarProps) {
  const [search, setSearch] = useState("");
  const [entitiesOpen, setEntitiesOpen] = useState(true);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [collapsedEntities, setCollapsedEntities] = useState<Record<string, boolean>>({});
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const groups = useMemo(() => buildPartitionGroups(schema), [schema]);
  const accents = useMemo(() => accentByPartitionKey(groups), [groups]);

  const queriesByEntity = useMemo(() => {
    const queries: Record<string, SavedQuery[]> = {};
    for (const query of schema.queries) (queries[query.entityName] ??= []).push(query);
    for (const entityName in queries) {
      queries[entityName].sort((left, right) => left.name.localeCompare(right.name));
    }
    return queries;
  }, [schema.queries]);

  const term = search.trim().toLowerCase();
  const tree = useMemo<TreeGroup[]>(() => {
    return groups
      .map((group) => ({
        id: group.id,
        partitionKey: group.partitionKey,
        entities: group.entities.reduce<TreeEntity[]>(
          (entities, entity) => {
            const allQueries = queriesByEntity[entity.name] ?? [];
            const entityMatches =
              !term ||
              entity.name.toLowerCase().includes(term) ||
              entity.pk.toLowerCase().includes(term) ||
              entity.sk.toLowerCase().includes(term);
            const matchingQueries = term
              ? allQueries.filter(
                  (query) =>
                    query.name.toLowerCase().includes(term) ||
                    query.entityName.toLowerCase().includes(term),
                )
              : allQueries;

            if (entityMatches) entities.push({ entity, queries: allQueries });
            else if (matchingQueries.length > 0) entities.push({ entity, queries: matchingQueries });
            return entities;
          },
          [],
        ),
      }))
      .filter((group) => group.entities.length > 0);
  }, [groups, queriesByEntity, term]);

  function startRename(query: SavedQuery) {
    setRenamingId(query.id);
    setRenameValue(query.name);
  }

  function confirmRename(id: string) {
    const name = renameValue.trim();
    if (name) onRenameQuery(id, name);
    setRenamingId(null);
  }

  return (
    <SidebarTreeProvider
      value={{
        selectedEntityName,
        activeQueryId,
        term,
        accents,
        collapsedGroups,
        collapsedEntities,
        renamingId,
        renameValue,
        toggleGroup: (id) => setCollapsedGroups((current) => ({ ...current, [id]: !current[id] })),
        toggleEntity: (name) => setCollapsedEntities((current) => ({ ...current, [name]: !current[name] })),
        onAddEntity,
        onSelectEntity,
        onSelectIndex,
        onSelectQuery,
        onEditEntity,
        onDeleteEntity,
        onDeleteQuery,
        onRenameValueChange: setRenameValue,
        onStartRename: startRename,
        onConfirmRename: confirmRename,
        onCancelRename: () => setRenamingId(null),
      }}
    >
      <nav aria-label="Library" className="h-full flex flex-col overflow-hidden bg-surface border border-line rounded-xl">
        <div className="px-3 pt-3 pb-2 border-b border-line shrink-0 flex flex-col gap-2">
          <div className="flex items-center gap-2" aria-label="Schema statistics">
            <Stat value={schema.entities.length} label="entities" />
            <Dot />
            <Stat value={schema.indexes.length} label="indexes" />
            <Dot />
            <Stat value={schema.queries.length} label="queries" />
          </div>
          <div className="relative">
            <Search
              size={12}
              aria-hidden="true"
              className="absolute left-2 top-1/2 -translate-y-1/2 text-muted/60 pointer-events-none"
            />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Filter entities & queries…"
              aria-label="Filter entities and queries"
              spellCheck={false}
              className="w-full bg-canvas border border-line-dim rounded-md text-primary font-mono text-[12px] pl-6 pr-6 py-1.25 outline-none focus:border-accent/50 transition-colors placeholder:text-muted/50"
            />
            {search && (
              <IconButton
                label="Clear filter"
                onClick={() => setSearch("")}
                className="absolute right-1 top-1/2 -translate-y-1/2 p-0.5"
              >
                <X size={11} aria-hidden="true" />
              </IconButton>
            )}
          </div>
        </div>

        <SectionHeader
          icon={<Boxes size={13} aria-hidden="true" />}
          label="Entities"
          count={schema.entities.length}
          open={entitiesOpen}
          onToggle={() => setEntitiesOpen((open) => !open)}
          action={
            <IconButton label="Add entity" onClick={() => onAddEntity("")}>
              <Plus size={13} aria-hidden="true" />
            </IconButton>
          }
        />

        {entitiesOpen && (
          <div className="overflow-y-auto flex-1 min-h-0">
            {tree.length === 0 ? (
              <EmptyHint>
                {term ? (
                  "Nothing matches the filter."
                ) : (
                  <>
                    No entities yet.
                    <span className="block mt-1 text-muted/60">Click + to add one.</span>
                  </>
                )}
              </EmptyHint>
            ) : (
              tree.map((group, groupIdx) => <TreeEntities key={group.id} group={group} groupIdx={groupIdx} />)
            )}
          </div>
        )}
      </nav>
    </SidebarTreeProvider>
  );
}
