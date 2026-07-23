import { isTauriRuntime } from './runtime.ts';

// QueryParams/SkCondition are defined in the domain (see buildQueryParams); re-exported
// here so existing call sites can keep importing them alongside queryTable.
export type { QueryParams, SkCondition } from '../domain/schema/buildQueryParams.ts';
import type { QueryParams } from '../domain/schema/buildQueryParams.ts';

export interface Capacity {
  capacity_units: number | null;
  read_capacity_units: number | null;
  write_capacity_units: number | null;
}

export interface ConsumedCapacity extends Capacity {
  table_name: string | null;
  table: Capacity | null;
  global_secondary_indexes: Record<string, Capacity> | null;
  local_secondary_indexes: Record<string, Capacity> | null;
}

interface BackendQueryResult {
  items: Record<string, unknown>[];
  truncated: boolean;
  count: number;
  last_key: Record<string, unknown> | null;
  consumed_capacity: ConsumedCapacity | null;
}

export async function queryTable(
  params: QueryParams,
): Promise<{
  items: Record<string, unknown>[];
  lastKey?: Record<string, unknown>;
  consumedCapacity?: ConsumedCapacity;
}> {
  if (!isTauriRuntime()) {
    throw new Error('Query execution is only available in the desktop app.');
  }
  const { invoke } = await import('@tauri-apps/api/core');
  const result = await invoke<BackendQueryResult>('query_table', { params });
  return {
    items: result.items,
    lastKey: result.last_key ?? undefined,
    consumedCapacity: result.consumed_capacity ?? undefined,
  };
}
