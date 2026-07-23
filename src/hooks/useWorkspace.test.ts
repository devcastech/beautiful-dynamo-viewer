import { describe, expect, it } from 'vitest';
import { initialWorkspaceState, workspaceReducer } from './useWorkspace.ts';
import type { SavedQuery } from '../domain/schema/types.ts';

const savedQuery: SavedQuery = {
  id: 'q1',
  name: 'List orders',
  entityName: 'Order',
  target: 'GSI1',
  pkValues: { userId: 'u1' },
  skOp: 'none',
  skValues: {},
  sk2Values: {},
};

describe('workspaceReducer', () => {
  it('reset returns the initial state', () => {
    const dirty = { ...initialWorkspaceState, entityName: 'Order', tab: 'entity' as const };
    expect(workspaceReducer(dirty, { type: 'reset' })).toEqual(initialWorkspaceState);
  });

  it('selectEntity selects the entity but preserves loadSeq', () => {
    const state = { ...initialWorkspaceState, loadSeq: 5, queryId: 'q9', tab: 'entity' as const };
    const next = workspaceReducer(state, { type: 'selectEntity', name: 'User' });
    expect(next.entityName).toBe('User');
    expect(next.loadSeq).toBe(5);
    expect(next.queryId).toBeNull();
    expect(next.tab).toBe('query');
  });

  it('selectIndex hydrates a blank query on the index and bumps loadSeq', () => {
    const next = workspaceReducer(initialWorkspaceState, {
      type: 'selectIndex',
      entityName: 'Order',
      indexName: 'GSI1',
    });
    expect(next.entityName).toBe('Order');
    expect(next.loadSeq).toBe(initialWorkspaceState.loadSeq + 1);
    expect(next.loadedQuery).toMatchObject({ id: '', entityName: 'Order', target: 'GSI1' });
  });

  it('selectQuery loads the query and bumps loadSeq', () => {
    const next = workspaceReducer(initialWorkspaceState, { type: 'selectQuery', query: savedQuery });
    expect(next.entityName).toBe('Order');
    expect(next.queryId).toBe('q1');
    expect(next.loadedQuery).toEqual(savedQuery);
    expect(next.loadSeq).toBe(initialWorkspaceState.loadSeq + 1);
  });

  it('selectQuery with an empty id leaves queryId null', () => {
    const next = workspaceReducer(initialWorkspaceState, {
      type: 'selectQuery',
      query: { ...savedQuery, id: '' },
    });
    expect(next.queryId).toBeNull();
  });

  it('setTab only changes the tab', () => {
    const state = { ...initialWorkspaceState, entityName: 'Order' };
    const next = workspaceReducer(state, { type: 'setTab', tab: 'entity' });
    expect(next).toEqual({ ...state, tab: 'entity' });
  });

  it('openNewEntity / openEditEntity / closeDraft manage the drawer draft', () => {
    const opened = workspaceReducer(initialWorkspaceState, {
      type: 'openNewEntity',
      partitionKey: 'PK#<id>',
    });
    expect(opened.draft).toEqual({ kind: 'new', partitionKey: 'PK#<id>' });

    const editing = workspaceReducer(initialWorkspaceState, { type: 'openEditEntity', name: 'User' });
    expect(editing.draft).toEqual({ kind: 'edit' });
    expect(editing.entityName).toBe('User');

    expect(workspaceReducer(editing, { type: 'closeDraft' }).draft).toBeNull();
  });

  it('openEditEntity without a name keeps the current entity', () => {
    const state = { ...initialWorkspaceState, entityName: 'Order' };
    const next = workspaceReducer(state, { type: 'openEditEntity' });
    expect(next.entityName).toBe('Order');
    expect(next.draft).toEqual({ kind: 'edit' });
  });

  it('entitySaved selects the saved entity and closes the draft', () => {
    const state = { ...initialWorkspaceState, draft: { kind: 'new' as const, partitionKey: 'X' } };
    const next = workspaceReducer(state, { type: 'entitySaved', name: 'Shipment' });
    expect(next.entityName).toBe('Shipment');
    expect(next.draft).toBeNull();
  });

  it('entityDeleted resets only when the deleted entity is selected', () => {
    const selected = { ...initialWorkspaceState, entityName: 'Order', loadSeq: 3, queryId: 'q1' };
    const reset = workspaceReducer(selected, { type: 'entityDeleted', name: 'Order' });
    expect(reset.entityName).toBeNull();
    expect(reset.queryId).toBeNull();
    expect(reset.loadSeq).toBe(3); // loadSeq preserved

    const other = workspaceReducer(selected, { type: 'entityDeleted', name: 'User' });
    expect(other).toBe(selected); // untouched
  });

  it('queryDeleted clears the builder only when the deleted query is active', () => {
    const active = { ...initialWorkspaceState, queryId: 'q1', loadedQuery: savedQuery };
    const cleared = workspaceReducer(active, { type: 'queryDeleted', id: 'q1' });
    expect(cleared.queryId).toBeNull();
    expect(cleared.loadedQuery).toBeNull();

    const other = workspaceReducer(active, { type: 'queryDeleted', id: 'q2' });
    expect(other).toBe(active);
  });

  it('querySaved stamps the query id', () => {
    const next = workspaceReducer(initialWorkspaceState, { type: 'querySaved', id: 'new-id' });
    expect(next.queryId).toBe('new-id');
  });
});
