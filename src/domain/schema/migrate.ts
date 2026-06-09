import {
  DEFAULT_KEYS,
  SCHEMA_VERSION,
  type Entity,
  type IndexDef,
  type SavedQuery,
  type SkOp,
  type TableSchema,
} from './types.ts';

// ---------------------------------------------------------------------------
// Legacy (v1) format — the original shape, still accepted on import.
// GSIs lived inside each entity (duplicating the table-level definition) and
// saved queries were nested in their entity.
// ---------------------------------------------------------------------------

export interface LegacyGsi {
  name: string;
  pk: string;
  sk: string;
  pkAttr: string;
  skAttr?: string;
}

export interface LegacySavedQuery {
  id: string;
  name: string;
  target: 'base' | string;
  pkValues: Record<string, string>;
  skOp: SkOp;
  skValues: Record<string, string>;
  sk2Values: Record<string, string>;
}

export interface LegacyEntity {
  name: string;
  pk: string;
  sk: string;
  pkAttr?: string;
  skAttr?: string;
  gsis: LegacyGsi[];
  attributes: string[];
  role?: string;
  priority?: number;
  description?: string;
  savedQueries?: LegacySavedQuery[];
}

export interface LegacyTable {
  name: string;
  table: string;
  domain?: string;
  story?: string;
  entities: LegacyEntity[];
}

// ---------------------------------------------------------------------------
// Migration
// ---------------------------------------------------------------------------

export function isLegacySchema(data: unknown): data is LegacyTable {
  if (typeof data !== 'object' || data === null) return false;
  const obj = data as Record<string, unknown>;
  return (
    !('version' in obj) &&
    typeof obj.name === 'string' &&
    typeof obj.table === 'string' &&
    Array.isArray(obj.entities)
  );
}

export function isTableSchema(data: unknown): data is TableSchema {
  if (typeof data !== 'object' || data === null) return false;
  const obj = data as Record<string, unknown>;
  return (
    obj.version === SCHEMA_VERSION &&
    typeof obj.name === 'string' &&
    typeof obj.tableName === 'string' &&
    Array.isArray(obj.entities)
  );
}

export function migrateLegacySchema(legacy: LegacyTable): TableSchema {
  // Table-level GSI definitions: collected by name across entities; first wins.
  const indexes: IndexDef[] = [];
  for (const entity of legacy.entities) {
    for (const gsi of entity.gsis ?? []) {
      if (!indexes.some((d) => d.name === gsi.name)) {
        indexes.push({ name: gsi.name, pkAttr: gsi.pkAttr, skAttr: gsi.skAttr });
      }
    }
  }

  // Base-table key attributes: first entity that declares them wins.
  const keys = {
    pk: legacy.entities.find((e) => e.pkAttr)?.pkAttr ?? DEFAULT_KEYS.pk,
    sk: legacy.entities.find((e) => e.skAttr)?.skAttr ?? DEFAULT_KEYS.sk,
  };

  const entities: Entity[] = legacy.entities.map((e) => ({
    name: e.name,
    pk: e.pk,
    sk: e.sk,
    description: e.description ?? '',
    priority: e.priority ?? 1,
    attributes: e.attributes ?? [],
    indexPatterns: (e.gsis ?? []).map((g) => ({ index: g.name, pk: g.pk, sk: g.sk })),
  }));

  const queries: SavedQuery[] = legacy.entities.flatMap((e) =>
    (e.savedQueries ?? []).map((q) => ({ ...q, entityName: e.name })),
  );

  return {
    version: SCHEMA_VERSION,
    id: crypto.randomUUID(),
    name: legacy.name,
    tableName: legacy.table,
    description: legacy.story ?? '',
    keys,
    indexes,
    entities,
    queries,
  };
}

/** Fill optional gaps on a v2 schema coming from a file (defensive defaults). */
function normalizeSchema(schema: TableSchema): TableSchema {
  return {
    ...schema,
    id: schema.id || crypto.randomUUID(),
    description: schema.description ?? '',
    keys: schema.keys ?? DEFAULT_KEYS,
    indexes: schema.indexes ?? [],
    entities: (schema.entities ?? []).map((e) => ({
      ...e,
      description: e.description ?? '',
      priority: e.priority ?? 1,
      attributes: e.attributes ?? [],
      indexPatterns: e.indexPatterns ?? [],
    })),
    queries: schema.queries ?? [],
  };
}

/**
 * Parse a schema JSON string (one schema per file), accepting both the
 * current (v2) and the legacy (v1) format. Throws with a readable message.
 */
export function parseSchemaImport(json: string): TableSchema {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    throw new Error('The file is not valid JSON.');
  }
  if (isTableSchema(data)) return normalizeSchema(data);
  if (isLegacySchema(data)) return migrateLegacySchema(data);
  throw new Error(
    'Unrecognized schema file: expected a schema with name, tableName (or table) and entities.',
  );
}

/** Shape of the persisted workspace file ({ version, schemas }). */
export function serializeWorkspace(schemas: TableSchema[]): string {
  return JSON.stringify({ version: SCHEMA_VERSION, schemas }, null, 2);
}

/**
 * Parse a persisted workspace file. Individual entries are migrated/normalized,
 * so a workspace written by any past version of the app keeps loading.
 */
export function parseWorkspace(json: string): TableSchema[] {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    throw new Error('Workspace file is not valid JSON.');
  }
  const schemas =
    typeof data === 'object' && data !== null && Array.isArray((data as { schemas?: unknown }).schemas)
      ? (data as { schemas: unknown[] }).schemas
      : null;
  if (!schemas) throw new Error('Workspace file has no schemas array.');

  return schemas.map((entry) => {
    if (isTableSchema(entry)) return normalizeSchema(entry);
    if (isLegacySchema(entry)) return migrateLegacySchema(entry);
    throw new Error('Workspace file contains an unrecognized schema entry.');
  });
}
