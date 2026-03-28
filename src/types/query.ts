export type SkCondition =
  | { op: 'Eq'; value: string }
  | { op: 'BeginsWith'; value: string }
  | { op: 'Between'; value: string; value2: string };

export interface QueryParams {
  table: string;
  pk_name: string;
  pk_value: string;
  sk_name?: string;
  sk_condition?: SkCondition;
  index_name?: string;
}

export interface QueryResult {
  status: 'idle' | 'loading' | 'success' | 'error';
  data: Record<string, unknown>[];
  error?: string;
  durationMs?: number;
}
