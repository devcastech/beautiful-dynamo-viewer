import { DEFAULT_KEYS, SCHEMA_VERSION, type SavedQuery, type TableSchema } from './types.ts';

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function checkVersion(raw: unknown, path: string): Record<string, unknown> {
  if (!isRecord(raw)) throw new Error(`${path} is not an object.`);
  const version = raw.version;
  if (typeof version !== 'number') {
    throw new Error(`${path} has no numeric "version" field. Is it a schema export?`);
  }
  if (version !== SCHEMA_VERSION) {
    throw new Error(
      `${path} has version ${version}; this app only supports version ${SCHEMA_VERSION}.`,
    );
  }
  return raw;
}

// ---- Structural validation ----
// Imported files are untrusted input; every array element is checked so a
// malformed entry fails with a precise message instead of crashing the UI later.

const SK_OPS = ['none', 'Eq', 'BeginsWith', 'Between'];
const FILTER_OPS = ['Eq', 'BeginsWith', 'Contains', 'Between'];
const VALUE_TYPES = ['string', 'number'];

function fail(path: string, expected: string): never {
  throw new Error(`Invalid schema: ${path} must be ${expected}.`);
}

function requireString(obj: Record<string, unknown>, key: string, path: string): void {
  if (typeof obj[key] !== 'string') fail(`${path}.${key}`, 'a string');
}

function optionalString(obj: Record<string, unknown>, key: string, path: string): void {
  if (obj[key] !== undefined && typeof obj[key] !== 'string') fail(`${path}.${key}`, 'a string');
}

function optionalStringMap(obj: Record<string, unknown>, key: string, path: string): void {
  const v = obj[key];
  if (v === undefined) return;
  if (!isRecord(v) || Object.values(v).some((x) => typeof x !== 'string')) {
    fail(`${path}.${key}`, 'an object of string values');
  }
}

function requireArray(obj: Record<string, unknown>, key: string, path: string): unknown[] {
  const v = obj[key] ?? [];
  if (!Array.isArray(v)) fail(`${path}.${key}`, 'an array');
  return v;
}

function requireItemRecord(v: unknown, path: string): Record<string, unknown> {
  if (!isRecord(v)) fail(path, 'an object');
  return v;
}

function validateEntity(raw: unknown, path: string): void {
  const e = requireItemRecord(raw, path);
  requireString(e, 'name', path);
  requireString(e, 'pk', path);
  requireString(e, 'sk', path);
  optionalString(e, 'description', path);
  if (e.priority !== undefined && typeof e.priority !== 'number') fail(`${path}.priority`, 'a number');
  const attributes = requireArray(e, 'attributes', path);
  if (attributes.some((a) => typeof a !== 'string')) fail(`${path}.attributes`, 'an array of strings');
  requireArray(e, 'indexPatterns', path).forEach((raw, i) => {
    const p = requireItemRecord(raw, `${path}.indexPatterns[${i}]`);
    requireString(p, 'index', `${path}.indexPatterns[${i}]`);
    requireString(p, 'pk', `${path}.indexPatterns[${i}]`);
    requireString(p, 'sk', `${path}.indexPatterns[${i}]`);
  });
}

function validateIndexDef(raw: unknown, path: string): void {
  const d = requireItemRecord(raw, path);
  requireString(d, 'name', path);
  requireString(d, 'pkAttr', path);
  optionalString(d, 'skAttr', path);
}

function validateFilter(raw: unknown, path: string): void {
  const f = requireItemRecord(raw, path);
  requireString(f, 'name', path);
  if (f.valueType !== undefined && !VALUE_TYPES.includes(f.valueType as string)) {
    fail(`${path}.valueType`, `one of ${VALUE_TYPES.join(', ')}`);
  }
  const c = requireItemRecord(f.condition, `${path}.condition`);
  if (!FILTER_OPS.includes(c.op as string)) fail(`${path}.condition.op`, `one of ${FILTER_OPS.join(', ')}`);
  if (c.op === 'Between') {
    const v = requireItemRecord(c.value, `${path}.condition.value`);
    requireString(v, 'from', `${path}.condition.value`);
    requireString(v, 'to', `${path}.condition.value`);
  } else if (typeof c.value !== 'string') {
    fail(`${path}.condition.value`, 'a string');
  }
}

function validateQuery(raw: unknown, path: string): void {
  const q = requireItemRecord(raw, path);
  requireString(q, 'id', path);
  requireString(q, 'name', path);
  requireString(q, 'entityName', path);
  requireString(q, 'target', path);
  if (q.skOp !== undefined && !SK_OPS.includes(q.skOp as string)) {
    fail(`${path}.skOp`, `one of ${SK_OPS.join(', ')}`);
  }
  optionalStringMap(q, 'pkValues', path);
  optionalStringMap(q, 'skValues', path);
  optionalStringMap(q, 'sk2Values', path);
  if (q.filters !== undefined) {
    if (!Array.isArray(q.filters)) fail(`${path}.filters`, 'an array');
    q.filters.forEach((f, i) => validateFilter(f, `${path}.filters[${i}]`));
  }
}

function validateTableSchema(obj: Record<string, unknown>, path: string): void {
  optionalString(obj, 'id', path);
  requireString(obj, 'name', path);
  requireString(obj, 'tableName', path);
  optionalString(obj, 'description', path);
  if (obj.keys !== undefined) {
    const k = requireItemRecord(obj.keys, `${path}.keys`);
    requireString(k, 'pk', `${path}.keys`);
    requireString(k, 'sk', `${path}.keys`);
  }
  requireArray(obj, 'indexes', path).forEach((d, i) => validateIndexDef(d, `${path}.indexes[${i}]`));
  if (!Array.isArray(obj.entities)) fail(`${path}.entities`, 'an array');
  obj.entities.forEach((e, i) => validateEntity(e, `${path}.entities[${i}]`));
  requireArray(obj, 'queries', path).forEach((q, i) => validateQuery(q, `${path}.queries[${i}]`));
}

// ---- Normalization ----

function normalizeQuery(query: SavedQuery): SavedQuery {
  return {
    ...query,
    pkValues: query.pkValues ?? {},
    skOp: query.skOp ?? 'none',
    skValues: query.skValues ?? {},
    sk2Values: query.sk2Values ?? {},
  };
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
    queries: (schema.queries ?? []).map(normalizeQuery),
  };
}

/** Check the schema version, validate the entry deeply, fill defaults. */
function checkAndValidate(raw: unknown, path: string): TableSchema {
  const checked = checkVersion(raw, path);
  validateTableSchema(checked, path);
  return normalizeSchema(checked as unknown as TableSchema);
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
  return checkAndValidate(data, 'schema');
}

/** Shape of the persisted workspace file ({ version, schemas }). */
export function serializeWorkspace(schemas: TableSchema[]): string {
  return JSON.stringify({ version: SCHEMA_VERSION, schemas }, null, 2);
}

/** Parse a persisted workspace file. Individual entries are validated and normalized. */
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

  return schemas.map((entry, i) => checkAndValidate(entry, `schemas[${i}]`));
}
