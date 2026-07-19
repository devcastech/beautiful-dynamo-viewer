import type { Entity, IndexDef, TableSchema } from './types.ts';

/** The physical attributes and key patterns a query against `target` must use. */
export interface ResolvedTarget {
  /** Table-level definition of the targeted GSI, or null for the base table
   *  (also null when the entity references an index the schema doesn't define). */
  indexDef: IndexDef | null;
  pkPattern: string;
  skPattern: string;
  /** Physical attribute names the key condition applies to. */
  pkAttr: string;
  skAttr: string;
  /** IndexName to send to DynamoDB; undefined = base table. */
  indexName?: string;
}

/**
 * Resolve which key patterns and physical attributes a query uses, given its
 * target ('base' or an index name from the entity's indexPatterns). Unknown
 * targets fall back to the base table patterns.
 */
export function resolveTarget(
  schema: TableSchema,
  entity: Entity,
  target: 'base' | string,
): ResolvedTarget {
  const pattern =
    target === 'base' ? null : entity.indexPatterns.find((p) => p.index === target) ?? null;
  const indexDef = pattern ? schema.indexes.find((d) => d.name === pattern.index) ?? null : null;

  return {
    indexDef,
    pkPattern: pattern ? pattern.pk : entity.pk,
    skPattern: pattern ? pattern.sk : entity.sk,
    pkAttr: indexDef ? indexDef.pkAttr : schema.keys.pk,
    skAttr: indexDef ? indexDef.skAttr ?? 'SK' : schema.keys.sk,
    indexName: pattern ? pattern.index : undefined,
  };
}
