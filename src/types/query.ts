export type SkCondition =
  | { op: 'Eq'; value: string }
  | { op: 'BeginsWith'; value: string }
  | { op: 'Between'; value: string; value2: string };

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

export interface QueryResult {
  status: 'idle' | 'loading' | 'success' | 'error';
  data: Record<string, unknown>[];
  lastKey?: Record<string, unknown>;
  error?: string;
  durationMs?: number;
}
