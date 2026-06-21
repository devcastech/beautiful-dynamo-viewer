import { DEFAULT_KEYS, SCHEMA_VERSION, type TableSchema } from './types.ts';

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
 * Parse a schema JSON string (one schema per file). Throws with a readable message.
 */
export function parseSchemaImport(json: string): TableSchema {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    throw new Error('The file is not valid JSON.');
  }
  if (isTableSchema(data)) return normalizeSchema(data);
  throw new Error(
    'Unrecognized schema file: expected a schema with version, name, tableName and entities.',
  );
}

/** Shape of the persisted workspace file ({ version, schemas }). */
export function serializeWorkspace(schemas: TableSchema[]): string {
  return JSON.stringify({ version: SCHEMA_VERSION, schemas }, null, 2);
}

/** Parse a persisted workspace file. Individual entries are normalized. */
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
    throw new Error('Workspace file contains an unrecognized schema entry.');
  });
}
