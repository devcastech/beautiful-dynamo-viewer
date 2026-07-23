import { createContext, useContext, type ReactNode } from "react";
import type { SavedQuery } from "../../domain/schema/types.ts";

interface SidebarTreeContextValue {
  selectedEntityName: string | null;
  activeQueryId: string | null;
  term: string;
  accents: Record<string, string>;
  collapsedGroups: Record<string, boolean>;
  collapsedEntities: Record<string, boolean>;
  renamingId: string | null;
  renameValue: string;
  toggleGroup: (id: string) => void;
  toggleEntity: (name: string) => void;
  onAddEntity: (partitionKey: string) => void;
  onSelectEntity: (name: string) => void;
  onSelectIndex: (entityName: string, indexName: string) => void;
  onSelectQuery: (query: SavedQuery) => void;
  onEditEntity: (name: string) => void;
  onDeleteEntity: (name: string) => void;
  onDeleteQuery: (id: string) => void;
  onRenameValueChange: (value: string) => void;
  onStartRename: (query: SavedQuery) => void;
  onConfirmRename: (id: string) => void;
  onCancelRename: () => void;
}

const SidebarTreeContext = createContext<SidebarTreeContextValue | null>(null);

export function SidebarTreeProvider({
  value,
  children,
}: {
  value: SidebarTreeContextValue;
  children: ReactNode;
}) {
  return <SidebarTreeContext.Provider value={value}>{children}</SidebarTreeContext.Provider>;
}

export function useSidebarTree() {
  const context = useContext(SidebarTreeContext);
  if (!context) throw new Error("useSidebarTree must be used within SidebarTreeProvider");
  return context;
}
