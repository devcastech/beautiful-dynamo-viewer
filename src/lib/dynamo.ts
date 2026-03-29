import type { QueryParams } from '../types/query.ts';

export const isTauriRuntime = (): boolean =>
  typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

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
