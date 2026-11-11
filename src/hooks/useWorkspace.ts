import { useReducer } from 'react';
import type { SavedQuery } from '../domain/schema/types.ts';

export type WorkspaceTab = 'query' | 'entity';

/** Entity form opened in the drawer: a brand-new entity or the selected one. */
export type EntityDraft = { kind: 'new'; partitionKey: string } | { kind: 'edit' } | null;

interface WorkspaceState {
  /** Selected entity (null = nothing selected yet). */
  entityName: string | null;
  tab: WorkspaceTab;
  /** What the builder queries: 'base' or one of the entity's index names. */
  target: 'base' | string;
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
  | { type: 'setTarget'; target: 'base' | string }
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
  target: 'base',
  queryId: null,
  loadedQuery: null,
  loadSeq: 0,
  draft: null,
};

function blankQuery(entityName: string, target: 'base' | string): SavedQuery {
  return {
    id: '',
    name: '',
    entityName,
    target,
    pkValues: {},
    skOp: 'none',
    skValues: {},
    sk2Values: {},
  };
}

export function workspaceReducer(state: WorkspaceState, action: WorkspaceAction): WorkspaceState {
  switch (action.type) {
    case 'reset':
      return initialWorkspaceState;

    // Loads a blank base-table query so re-clicking the already selected entity
    // still takes the builder back to the base table.
    case 'selectEntity':
      return {
        ...initialWorkspaceState,
        entityName: action.name,
        loadedQuery: blankQuery(action.name, 'base'),
        loadSeq: state.loadSeq + 1,
      };

    case 'selectIndex':
      return {
        ...initialWorkspaceState,
        entityName: action.entityName,
        target: action.indexName,
        loadedQuery: blankQuery(action.entityName, action.indexName),
        loadSeq: state.loadSeq + 1,
      };

    case 'selectQuery':
      return {
        ...initialWorkspaceState,
        entityName: action.query.entityName,
        target: action.query.target,
        queryId: action.query.id || null,
        loadedQuery: action.query,
        loadSeq: state.loadSeq + 1,
      };

    case 'setTab':
      return { ...state, tab: action.tab };

    case 'setTarget':
      return { ...state, target: action.target };

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
      // A rename resets the builder (see WorkspaceArea), so the target goes with it.
      return {
        ...state,
        entityName: action.name,
        target: action.name === state.entityName ? state.target : 'base',
        draft: null,
      };

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
