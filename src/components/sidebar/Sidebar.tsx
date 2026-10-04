import { useMemo, useState } from "react";
import { Plus, Search, X } from "lucide-react";
import { IconButton } from "../ui/Button.tsx";
import { buildPartitionGroups } from "../../domain/schema/grouping.ts";
import type { Entity, SavedQuery, TableSchema } from "../../domain/schema/types.ts";
import { EmptyHint } from "./utils.tsx";
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
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [collapsedEntities, setCollapsedEntities] = useState<Record<string, boolean>>({});
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const groups = useMemo(() => buildPartitionGroups(schema), [schema]);

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
      <nav aria-label="Library" className="h-full flex flex-col overflow-hidden bg-surface">
        <div className="px-2.5 pt-2.5 pb-2 shrink-0 flex items-center gap-1">
          <div className="relative flex-1 min-w-0">
            <Search
              size={12}
              aria-hidden="true"
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none"
            />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search"
              aria-label="Filter entities and queries"
              spellCheck={false}
              className="w-full bg-inset border border-transparent rounded-md text-primary text-[12px] pl-7 pr-6 py-1.25 outline-none focus:border-line transition-colors placeholder:text-muted"
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
          <IconButton label="Add entity" onClick={() => onAddEntity("")} className="p-1.5 shrink-0">
            <Plus size={14} aria-hidden="true" />
          </IconButton>
        </div>

        <div className="overflow-y-auto flex-1 min-h-0 pb-3">
          {tree.length === 0 ? (
            <EmptyHint>
              {term ? (
                "Nothing matches the filter."
              ) : (
                <>
                  No entities yet.
                  <span className="block mt-1 text-muted">Click + to add one.</span>
                </>
              )}
            </EmptyHint>
          ) : (
            tree.map((group, groupIdx) => <TreeEntities key={group.id} group={group} groupIdx={groupIdx} />)
          )}
        </div>
      </nav>
    </SidebarTreeProvider>
  );
}
