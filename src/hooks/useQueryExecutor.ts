import { useCallback, useState } from 'react';
import { queryTable, type ConsumedCapacity, type QueryParams } from '../services/dynamo.ts';

export interface QueryResult {
  status: 'idle' | 'loading' | 'success' | 'error';
  data: Record<string, unknown>[];
  lastKey?: Record<string, unknown>;
  error?: string;
  durationMs?: number;
  consumedCapacity?: ConsumedCapacity;
}

/** Tauri rejects commands with the serialized AppError struct ({ message }), which is a
 *  plain object — not an Error — so unwrap its message instead of stringifying to "[object Object]". */
function extractErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  if (err && typeof err === 'object' && 'message' in err) {
    return String((err as { message: unknown }).message);
  }
  return String(err);
}

export interface QueryExecutor {
  result: QueryResult;
  execute: (params: QueryParams) => Promise<void>;
  next: () => Promise<void>;
  prev: () => Promise<void>;
  reset: () => void;
  hasNext: boolean;
  hasPrev: boolean;
}

export function useQueryExecutor(): QueryExecutor {
  const [result, setResult] = useState<QueryResult>({ status: 'idle', data: [] });
  const [lastParams, setLastParams] = useState<QueryParams | null>(null);
  const [prevKeys, setPrevKeys] = useState<(Record<string, unknown> | undefined)[]>([]);
  const [currentStartKey, setCurrentStartKey] = useState<Record<string, unknown> | undefined>(undefined);

  const fetchPage = useCallback(async (params: QueryParams, startKey?: Record<string, unknown>) => {
    setResult({ status: 'loading', data: [] });
    const start = Date.now();
    try {
      const { items, lastKey, consumedCapacity } = await queryTable({ ...params, exclusiveStartKey: startKey });
      setResult({
        status: 'success',
        data: items,
        lastKey,
        durationMs: Date.now() - start,
        consumedCapacity,
      });
    } catch (err) {
      setResult({
        status: 'error',
        data: [],
        error: extractErrorMessage(err),
      });
    }
  }, []);

  const execute = useCallback(async (params: QueryParams) => {
    setLastParams(params);
    setPrevKeys([]);
    setCurrentStartKey(undefined);
    await fetchPage(params, undefined);
  }, [fetchPage]);

  const next = useCallback(async () => {
    if (!lastParams || !result.lastKey) return;
    setPrevKeys((prev) => [...prev, currentStartKey]);
    setCurrentStartKey(result.lastKey);
    await fetchPage(lastParams, result.lastKey);
  }, [lastParams, result.lastKey, currentStartKey, fetchPage]);

  const prev = useCallback(async () => {
    if (!lastParams || prevKeys.length === 0) return;
    const newPrev = [...prevKeys];
    const prevKey = newPrev.pop();
    setPrevKeys(newPrev);
    setCurrentStartKey(prevKey);
    await fetchPage(lastParams, prevKey);
  }, [lastParams, prevKeys, fetchPage]);

  const reset = useCallback(() => {
    setResult({ status: 'idle', data: [] });
    setLastParams(null);
    setPrevKeys([]);
    setCurrentStartKey(undefined);
  }, []);

  return {
    result,
    execute,
    next,
    prev,
    reset,
    hasNext: !!result.lastKey,
    hasPrev: prevKeys.length > 0,
  };
}
