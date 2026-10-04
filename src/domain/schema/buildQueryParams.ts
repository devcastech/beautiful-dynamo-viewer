import { parsePattern } from './patternParser.ts';
import { resolveTarget } from './resolveTarget.ts';
import type { Entity, QueryFilter, SkOp, TableSchema } from './types.ts';

// Filter types live in types.ts (SavedQuery persists them); re-exported here
// so query-building call sites keep a single import location.
export type { FilterCondition, FilterOp, FilterValueType, QueryFilter } from './types.ts';

export type SkCondition =
  | { op: 'Eq'; value: string }
  | { op: 'BeginsWith'; value: string }
  | { op: 'Between'; value: { from: string; to: string } };

/** A resolved DynamoDB Query request, ready to hand to the backend. */
export interface QueryParams {
  table: string;
  pkName: string;
  pkValue: string;
  skName?: string;
  skCondition?: SkCondition;
  indexName?: string;
  limit?: number;
  exclusiveStartKey?: Record<string, unknown>;
  filters?: QueryFilter[];
}

export interface BuildQueryParamsInput {
  schema: TableSchema;
  entity: Entity;
  tableName: string;
  /** 'base' or the name of one of the entity's index patterns. */
  target: 'base' | string;
  pkValues: Record<string, string>;
  skOp: SkOp;
  skValues: Record<string, string>;
  sk2Values: Record<string, string>;
  filters?: QueryFilter[];
}

/**
 * Resolve a saved/in-progress query (entity + key patterns + user values) into the
 * concrete DynamoDB Query request. Picks base-table vs. GSI key attributes from the
 * selected target and composes the sort-key condition for the chosen operator.
 *
 * Pure: no UI, no I/O; the correctness-critical translation lives here so it can be tested.
 */
export function buildQueryParams(input: BuildQueryParamsInput): QueryParams {
  const { schema, entity, tableName, target, pkValues, skOp, skValues, sk2Values } = input;

  const resolved = resolveTarget(schema, entity, target);

  const parsedPk = parsePattern(resolved.pkPattern);
  const parsedSk = parsePattern(resolved.skPattern);

  const pkValue = parsedPk.resolve(pkValues);

  let skCondition: SkCondition | undefined;
  if (skOp !== 'none') {
    const skValue = parsedSk.variables.length > 0 ? parsedSk.resolve(skValues) : resolved.skPattern;
    if (skOp === 'Eq') skCondition = { op: 'Eq', value: skValue };
    else if (skOp === 'BeginsWith') skCondition = { op: 'BeginsWith', value: skValue };
    else if (skOp === 'Between') {
      const to = parsedSk.variables.length > 0 ? parsedSk.resolve(sk2Values) : resolved.skPattern;
      skCondition = { op: 'Between', value: { from: skValue, to } };
    }
  }

  return {
    table: tableName,
    pkName: resolved.pkAttr,
    pkValue,
    skName: skOp !== 'none' ? resolved.skAttr : undefined,
    skCondition,
    indexName: resolved.indexName,
    filters: input.filters && input.filters.length > 0 ? input.filters : undefined,
  };
}
