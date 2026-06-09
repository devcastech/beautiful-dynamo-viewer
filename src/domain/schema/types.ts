export type SkOp = 'none' | 'Eq' | 'BeginsWith' | 'Between';

/** Physical attribute names of the base table keys (e.g. { pk: "PK", sk: "SK" }). */
export interface TableKeys {
  pk: string;
  sk: string;
}

/** A GSI as it exists on the table: its name and the physical attributes it indexes. */
export interface IndexDef {
  name: string;
  pkAttr: string;
  skAttr?: string;
}

/** How one entity writes its keys into a given index, as patterns with <variables>. */
export interface IndexPattern {
  /** Name of an IndexDef in TableSchema.indexes */
  index: string;
  pk: string;
  sk: string;
}

export interface Entity {
  name: string;
  /** Base-table key patterns, e.g. "ORDER#<orderId>" */
  pk: string;
  sk: string;
  description: string;
  /** 1 = primary record for its partition; higher = secondary/audit records. Controls sidebar order. */
  priority: number;
  attributes: string[];
  indexPatterns: IndexPattern[];
}

export interface SavedQuery {
  id: string;
  name: string;
  /** Entity this query belongs to (Entity.name). */
  entityName: string;
  /** 'base' or the name of an IndexDef. */
  target: 'base' | string;
  pkValues: Record<string, string>;
  skOp: SkOp;
  skValues: Record<string, string>;
  sk2Values: Record<string, string>;
}

/**
 * A schema describes how one DynamoDB table is modeled:
 * which entities live in it, which GSIs exist, and the saved queries against it.
 */
export interface TableSchema {
  version: 2;
  id: string;
  /** Display label shown in the schema selector. */
  name: string;
  /** Actual DynamoDB table name used to connect. */
  tableName: string;
  description: string;
  keys: TableKeys;
  indexes: IndexDef[];
  entities: Entity[];
  queries: SavedQuery[];
}

export const SCHEMA_VERSION = 2 as const;

export const DEFAULT_KEYS: TableKeys = { pk: 'PK', sk: 'SK' };
