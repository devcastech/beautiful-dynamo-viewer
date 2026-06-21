import { useReducer } from 'react';
import type { SavedQuery } from '../domain/schema/types.ts';

export type WorkspaceTab = 'query' | 'entity';

/** Entity form opened in the drawer: a brand-new entity or the selected one. */
export type EntityDraft = { kind: 'new'; partitionKey: string } | { kind: 'edit' } | null;

interface WorkspaceState {
  /** Selected entity (null = nothing selected yet). */
  entityName: string | null;
  tab: WorkspaceTab;
  /** Saved query currently mirrored by the builder, if any. */
  queryId: string | null;
  /** One-shot payload to hydrate the builder; bump of loadSeq re-applies it. */
  loadedQuery: SavedQuery | null;
  loadSeq: number;
  draft: EntityDraft;
}

type WorkspaceAction =
  | { type: 'reset' }
  | { type: 'selectEntity'; name: string }
  | { type: 'selectIndex'; entityName: string; indexName: string }
  | { type: 'selectQuery'; query: SavedQuery }
  | { type: 'setTab'; tab: WorkspaceTab }
  | { type: 'openNewEntity'; partitionKey: string }
  | { type: 'openEditEntity'; name?: string }
  | { type: 'closeDraft' }
  | { type: 'entitySaved'; name: string }
  | { type: 'entityDeleted'; name: string }
  | { type: 'queryDeleted'; id: string }
  | { type: 'querySaved'; id: string };

export const initialWorkspaceState: WorkspaceState = {
  entityName: null,
  tab: 'query',
  queryId: null,
  loadedQuery: null,
  loadSeq: 0,
  draft: null,
};

export function workspaceReducer(state: WorkspaceState, action: WorkspaceAction): WorkspaceState {
  switch (action.type) {
    case 'reset':
      return initialWorkspaceState;

    case 'selectEntity':
      return { ...initialWorkspaceState, entityName: action.name, loadSeq: state.loadSeq };

    case 'selectIndex':
      return {
        ...initialWorkspaceState,
        entityName: action.entityName,
        loadedQuery: {
          id: '',
          name: '',
          entityName: action.entityName,
          target: action.indexName,
          pkValues: {},
          skOp: 'none',
          skValues: {},
          sk2Values: {},
        },
        loadSeq: state.loadSeq + 1,
      };

    case 'selectQuery':
      return {
        ...initialWorkspaceState,
        entityName: action.query.entityName,
        queryId: action.query.id || null,
        loadedQuery: action.query,
        loadSeq: state.loadSeq + 1,
      };

    case 'setTab':
      return { ...state, tab: action.tab };

    case 'openNewEntity':
      return { ...state, draft: { kind: 'new', partitionKey: action.partitionKey } };

    case 'openEditEntity':
      return {
        ...state,
        entityName: action.name ?? state.entityName,
        draft: { kind: 'edit' },
      };

    case 'closeDraft':
      return { ...state, draft: null };

    case 'entitySaved':
      return { ...state, entityName: action.name, draft: null };

    case 'entityDeleted':
      return state.entityName === action.name
        ? { ...initialWorkspaceState, loadSeq: state.loadSeq }
        : state;

    case 'queryDeleted':
      return state.queryId === action.id
        ? { ...state, queryId: null, loadedQuery: null }
        : state;

    case 'querySaved':
      return { ...state, queryId: action.id };
  }
}

/** Pure UI selection state for the main workspace (what's selected, which tab, drawer). */
export function useWorkspace() {
  const [state, dispatch] = useReducer(workspaceReducer, initialWorkspaceState);
  return { ...state, dispatch };
}

export type Workspace = ReturnType<typeof useWorkspace>;
