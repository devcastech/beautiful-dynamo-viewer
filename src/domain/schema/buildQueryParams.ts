import { parsePattern } from './patternParser.ts';
import type { Entity, SkOp, TableSchema } from './types.ts';

export type SkCondition =
  | { op: 'Eq'; value: string }
  | { op: 'BeginsWith'; value: string }
  | { op: 'Between'; value: { from: string; to: string } };

export type FilterOp = 'Eq' | 'BeginsWith' | 'Contains' | 'Between';

export type FilterValueType = 'string' | 'number';

export type FilterCondition =
  | { op: 'Eq'; value: string }
  | { op: 'BeginsWith'; value: string }
  | { op: 'Contains'; value: string }
  | { op: 'Between'; value: { from: string; to: string } };

export interface QueryFilter {
  name: string;
  valueType: FilterValueType;
  condition: FilterCondition;
}

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
 * Pure: no UI, no I/O — the correctness-critical translation lives here so it can be tested.
 */
export function buildQueryParams(input: BuildQueryParamsInput): QueryParams {
  const { schema, entity, tableName, target, pkValues, skOp, skValues, sk2Values } = input;

  const activePattern =
    target === 'base' ? null : entity.indexPatterns.find((p) => p.index === target) ?? null;
  const activeIndexDef = activePattern
    ? schema.indexes.find((d) => d.name === activePattern.index) ?? null
    : null;

  const activePkPattern = activePattern ? activePattern.pk : entity.pk;
  const activeSkPattern = activePattern ? activePattern.sk : entity.sk;

  const parsedPk = parsePattern(activePkPattern);
  const parsedSk = parsePattern(activeSkPattern);

  const pkValue = parsedPk.resolve(pkValues);
  const pkName = activeIndexDef ? activeIndexDef.pkAttr : schema.keys.pk;
  const skName = activeIndexDef ? activeIndexDef.skAttr ?? 'SK' : schema.keys.sk;

  let skCondition: SkCondition | undefined;
  if (skOp !== 'none') {
    const skValue = parsedSk.variables.length > 0 ? parsedSk.resolve(skValues) : activeSkPattern;
    if (skOp === 'Eq') skCondition = { op: 'Eq', value: skValue };
    else if (skOp === 'BeginsWith') skCondition = { op: 'BeginsWith', value: skValue };
    else if (skOp === 'Between') {
      const to = parsedSk.variables.length > 0 ? parsedSk.resolve(sk2Values) : activeSkPattern;
      skCondition = { op: 'Between', value: { from: skValue, to } };
    }
  }

  return {
    table: tableName,
    pkName,
    pkValue,
    skName: skOp !== 'none' ? skName : undefined,
    skCondition,
    indexName: activePattern ? activePattern.index : undefined,
    filters: input.filters && input.filters.length > 0 ? input.filters : undefined,
  };
}
