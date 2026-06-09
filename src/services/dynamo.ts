import { isTauriRuntime } from './runtime.ts';

export type SkCondition =
  | { op: 'Eq'; value: string }
  | { op: 'BeginsWith'; value: string }
  | { op: 'Between'; value: { from: string; to: string } };

export interface QueryParams {
  table: string;
  pkName: string;
  pkValue: string;
  skName?: string;
  skCondition?: SkCondition;
  indexName?: string;
  limit?: number;
  exclusiveStartKey?: Record<string, unknown>;
}

interface BackendQueryResult {
  items: Record<string, unknown>[];
  truncated: boolean;
  count: number;
  last_key: Record<string, unknown> | null;
}

export async function queryTable(
  params: QueryParams,
): Promise<{ items: Record<string, unknown>[]; lastKey?: Record<string, unknown> }> {
  if (!isTauriRuntime()) {
    throw new Error('Query execution is only available in the desktop app.');
  }
  const { invoke } = await import('@tauri-apps/api/core');
  const result = await invoke<BackendQueryResult>('query_table', { params });
  return { items: result.items, lastKey: result.last_key ?? undefined };
}
