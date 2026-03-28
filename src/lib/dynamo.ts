import type { QueryParams } from '../types/query.ts';

export const isTauriRuntime = (): boolean =>
  typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

export async function queryTable(params: QueryParams): Promise<Record<string, unknown>[]> {
  console.log('queryTable', params)
  if (!isTauriRuntime()) {
    throw new Error('Query execution is only available in the desktop app.');
  }
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke('query_table', { params });
}
