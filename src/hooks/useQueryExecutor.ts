import { useCallback, useState } from 'react';
import { queryTable } from '../lib/dynamo.ts';
import type { QueryParams, QueryResult } from '../types/query.ts';

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
      const { items, lastKey } = await queryTable({ ...params, exclusiveStartKey: startKey });
      setResult({ status: 'success', data: items, lastKey, durationMs: Date.now() - start });
    } catch (err) {
      setResult({
        status: 'error',
        data: [],
        error: err instanceof Error ? err.message : String(err),
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
