// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useSchemaStore } from './useSchemaStore.ts';
import type { SchemaRepository } from '../services/storage.ts';
import type { TableSchema } from '../domain/schema/types.ts';

function schema(id: string, name = id): TableSchema {
  return {
    version: 2,
    id,
    name,
    tableName: `${name}-table`,
    description: '',
    keys: { pk: 'PK', sk: 'SK' },
    indexes: [],
    entities: [],
    queries: [],
  };
}

function fakeRepo(over: Partial<SchemaRepository> = {}): SchemaRepository {
  return {
    load: vi.fn().mockResolvedValue(null),
    save: vi.fn().mockResolvedValue(undefined),
    ...over,
  };
}

/** Minimal in-memory Storage — happy-dom's localStorage is incomplete in this env. */
function memoryStorage(): Storage {
  const m = new Map<string, string>();
  return {
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => void m.set(k, String(v)),
    removeItem: (k) => void m.delete(k),
    clear: () => m.clear(),
    key: (i) => [...m.keys()][i] ?? null,
    get length() {
      return m.size;
    },
  };
}

describe('useSchemaStore', () => {
  // Fresh storage per test for isolation.
  beforeEach(() => vi.stubGlobal('localStorage', memoryStorage()));

  it('seeds the example schema on first run and persists it', async () => {
    const repo = fakeRepo({ load: vi.fn().mockResolvedValue(null) });
    const { result } = renderHook(() => useSchemaStore(repo));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.schemas).toHaveLength(1);
    expect(result.current.schemas[0].name).toBe('ecommerce-demo');
    expect(result.current.activeSchema?.name).toBe('ecommerce-demo');
    // First-run seed is written back so it survives a reload.
    expect(repo.save).toHaveBeenCalledTimes(1);
  });

  it('respects a persisted empty workspace (does not re-seed)', async () => {
    const repo = fakeRepo({ load: vi.fn().mockResolvedValue([]) });
    const { result } = renderHook(() => useSchemaStore(repo));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.schemas).toEqual([]);
    expect(result.current.activeSchema).toBeNull();
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('loads stored schemas as-is and selects the first', async () => {
    const stored = [schema('a'), schema('b')];
    const repo = fakeRepo({ load: vi.fn().mockResolvedValue(stored) });
    const { result } = renderHook(() => useSchemaStore(repo));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.schemas).toEqual(stored);
    expect(result.current.activeSchema?.id).toBe('a');
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('restores the last active schema from storage', async () => {
    localStorage.setItem('dynamo-viewer.activeSchema', 'b');
    const stored = [schema('a'), schema('b')];
    const repo = fakeRepo({ load: vi.fn().mockResolvedValue(stored) });
    const { result } = renderHook(() => useSchemaStore(repo));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.activeSchema?.id).toBe('b');
  });

  it('falls back to the first schema when the saved id no longer exists', async () => {
    localStorage.setItem('dynamo-viewer.activeSchema', 'gone');
    const stored = [schema('a'), schema('b')];
    const repo = fakeRepo({ load: vi.fn().mockResolvedValue(stored) });
    const { result } = renderHook(() => useSchemaStore(repo));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.activeSchema?.id).toBe('a');
  });

  it('surfaces a load error and starts empty without overwriting the file', async () => {
    const repo = fakeRepo({ load: vi.fn().mockRejectedValue(new Error('corrupt file')) });
    const { result } = renderHook(() => useSchemaStore(repo));

    await waitFor(() => expect(result.current.loadError).toBe('corrupt file'));

    expect(result.current.schemas).toEqual([]);
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('persists mutations (debounced)', async () => {
    const repo = fakeRepo({ load: vi.fn().mockResolvedValue([schema('a')]) });
    const { result } = renderHook(() => useSchemaStore(repo));
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => result.current.addSchema(schema('b')));

    expect(result.current.schemas).toHaveLength(2);
    expect(result.current.activeSchema?.id).toBe('b');
    await waitFor(() => expect(repo.save).toHaveBeenCalled());
  });
});
