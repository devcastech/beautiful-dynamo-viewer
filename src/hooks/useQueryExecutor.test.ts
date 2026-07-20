// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useQueryExecutor } from './useQueryExecutor.ts';
import type { QueryParams } from '../services/dynamo.ts';

vi.mock('../services/dynamo.ts', () => ({ queryTable: vi.fn() }));
import { queryTable } from '../services/dynamo.ts';
const mockQuery = vi.mocked(queryTable);

const params: QueryParams = { table: 'T', pkName: 'PK', pkValue: 'X' };

beforeEach(() => mockQuery.mockReset());
afterEach(() => vi.restoreAllMocks());

describe('useQueryExecutor', () => {
  it('starts idle', () => {
    const { result } = renderHook(() => useQueryExecutor());
    expect(result.current.result).toEqual({ status: 'idle', data: [] });
    expect(result.current.hasNext).toBe(false);
    expect(result.current.hasPrev).toBe(false);
  });

  it('execute fetches the first page with no start key', async () => {
    mockQuery.mockResolvedValueOnce({
      items: [{ id: 1 }],
      lastKey: { k: 'p2' },
      consumedCapacity: {
        table_name: 'T',
        capacity_units: 0.5,
        read_capacity_units: null,
        write_capacity_units: null,
        table: { capacity_units: 0.5, read_capacity_units: null, write_capacity_units: null },
        global_secondary_indexes: null,
        local_secondary_indexes: null,
      },
    });
    const { result } = renderHook(() => useQueryExecutor());

    await act(async () => {
      await result.current.execute(params);
    });

    expect(mockQuery).toHaveBeenCalledWith({ ...params, exclusiveStartKey: undefined });
    expect(result.current.result.status).toBe('success');
    expect(result.current.result.data).toEqual([{ id: 1 }]);
    expect(result.current.result.durationMs).toBeTypeOf('number');
    expect(result.current.result.consumedCapacity?.capacity_units).toBe(0.5);
    expect(result.current.hasNext).toBe(true);
    expect(result.current.hasPrev).toBe(false);
  });

  it('paginates forward then back using the cursor stack', async () => {
    const { result } = renderHook(() => useQueryExecutor());

    mockQuery.mockResolvedValueOnce({ items: [{ p: 1 }], lastKey: { k: 'p2' } });
    await act(async () => {
      await result.current.execute(params);
    });

    // Forward: sends the previous lastKey as the start key, last page has no lastKey.
    mockQuery.mockResolvedValueOnce({ items: [{ p: 2 }], lastKey: undefined });
    await act(async () => {
      await result.current.next();
    });
    expect(mockQuery).toHaveBeenLastCalledWith({ ...params, exclusiveStartKey: { k: 'p2' } });
    expect(result.current.result.data).toEqual([{ p: 2 }]);
    expect(result.current.hasNext).toBe(false);
    expect(result.current.hasPrev).toBe(true);

    // Back: returns to the first page (start key undefined), hasPrev clears.
    mockQuery.mockResolvedValueOnce({ items: [{ p: 1 }], lastKey: { k: 'p2' } });
    await act(async () => {
      await result.current.prev();
    });
    expect(mockQuery).toHaveBeenLastCalledWith({ ...params, exclusiveStartKey: undefined });
    expect(result.current.result.data).toEqual([{ p: 1 }]);
    expect(result.current.hasPrev).toBe(false);
  });

  it('next and prev are no-ops before any execute', async () => {
    const { result } = renderHook(() => useQueryExecutor());
    await act(async () => {
      await result.current.next();
      await result.current.prev();
    });
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it('surfaces the message from a rejected AppError object', async () => {
    mockQuery.mockRejectedValueOnce({ message: 'table not found' });
    const { result } = renderHook(() => useQueryExecutor());

    await act(async () => {
      await result.current.execute(params);
    });

    expect(result.current.result.status).toBe('error');
    expect(result.current.result.error).toBe('table not found');
    expect(result.current.result.data).toEqual([]);
  });

  it('reset returns to idle and clears pagination', async () => {
    mockQuery.mockResolvedValueOnce({ items: [{ id: 1 }], lastKey: { k: 'p2' } });
    const { result } = renderHook(() => useQueryExecutor());
    await act(async () => {
      await result.current.execute(params);
    });

    act(() => result.current.reset());
    expect(result.current.result).toEqual({ status: 'idle', data: [] });
    expect(result.current.hasNext).toBe(false);
    expect(result.current.hasPrev).toBe(false);
  });
});
