// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { forgetTableNames, tableNameKey, useTableName } from './useTableName.ts';
import type { TableSchema } from '../domain/schema/types.ts';

function schema(id: string, tableName = `${id}-table`): TableSchema {
  return {
    version: 2,
    id,
    name: id,
    tableName,
    description: '',
    keys: { pk: 'PK', sk: 'SK' },
    indexes: [],
    entities: [],
    queries: [],
  };
}

/** Minimal in-memory Storage, since happy-dom's localStorage is incomplete in this env. */
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

describe('useTableName', () => {
  beforeEach(() => vi.stubGlobal('localStorage', memoryStorage()));

  it("defaults to the schema's tableName", () => {
    const { result } = renderHook(() => useTableName(schema('s1'), 'dev', 'us-east-1'));
    expect(result.current.tableName).toBe('s1-table');
  });

  it('persists an override and restores it on a fresh mount', () => {
    const first = renderHook(() => useTableName(schema('s1'), 'dev', 'us-east-1'));
    act(() => first.result.current.setTableName('orders-dev'));
    expect(first.result.current.tableName).toBe('orders-dev');

    const second = renderHook(() => useTableName(schema('s1'), 'dev', 'us-east-1'));
    expect(second.result.current.tableName).toBe('orders-dev');
  });

  it('remembers a different table per profile and region', () => {
    localStorage.setItem(tableNameKey('s1', 'dev', 'us-east-1'), 'orders-dev');
    localStorage.setItem(tableNameKey('s1', 'prod', 'us-east-1'), 'orders-prod');

    const { result, rerender } = renderHook(
      ({ profile, region }) => useTableName(schema('s1'), profile, region),
      { initialProps: { profile: 'dev', region: 'us-east-1' } },
    );
    expect(result.current.tableName).toBe('orders-dev');

    rerender({ profile: 'prod', region: 'us-east-1' });
    expect(result.current.tableName).toBe('orders-prod');

    rerender({ profile: 'prod', region: 'eu-west-1' });
    expect(result.current.tableName).toBe('s1-table');
  });

  it('keeps an emptied field empty but does not store it', () => {
    const { result } = renderHook(() => useTableName(schema('s1'), 'dev', 'us-east-1'));
    act(() => result.current.setTableName('orders-dev'));
    act(() => result.current.setTableName(''));

    expect(result.current.tableName).toBe('');
    expect(localStorage.getItem(tableNameKey('s1', 'dev', 'us-east-1'))).toBeNull();
  });

  it('forgetTableNames drops only that schema', () => {
    localStorage.setItem(tableNameKey('s1', 'dev', 'us-east-1'), 'a');
    localStorage.setItem(tableNameKey('s1', 'prod', 'eu-west-1'), 'b');
    localStorage.setItem(tableNameKey('s2', 'dev', 'us-east-1'), 'c');

    forgetTableNames('s1');

    expect(localStorage.getItem(tableNameKey('s1', 'dev', 'us-east-1'))).toBeNull();
    expect(localStorage.getItem(tableNameKey('s1', 'prod', 'eu-west-1'))).toBeNull();
    expect(localStorage.getItem(tableNameKey('s2', 'dev', 'us-east-1'))).toBe('c');
  });
});
