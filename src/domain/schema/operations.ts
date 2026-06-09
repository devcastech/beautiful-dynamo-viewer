import type { Entity, IndexDef, SavedQuery, TableSchema } from './types.ts';

// Pure functions over the schema collection. All return new objects.

// ---- Schemas ----

export function addSchema(schemas: TableSchema[], schema: TableSchema): TableSchema[] {
  return [...schemas, schema];
}

export function updateSchema(
  schemas: TableSchema[],
  id: string,
  patch: Partial<Omit<TableSchema, 'id' | 'version'>>,
): TableSchema[] {
  return schemas.map((s) => (s.id === id ? { ...s, ...patch } : s));
}

export function deleteSchema(schemas: TableSchema[], id: string): TableSchema[] {
  return schemas.filter((s) => s.id !== id);
}

function patchSchema(
  schemas: TableSchema[],
  id: string,
  fn: (schema: TableSchema) => TableSchema,
): TableSchema[] {
  return schemas.map((s) => (s.id === id ? fn(s) : s));
}

// ---- Entities ----

export function addEntity(schemas: TableSchema[], schemaId: string, entity: Entity): TableSchema[] {
  return patchSchema(schemas, schemaId, (s) => ({
    ...s,
    indexes: mergeIndexes(s.indexes, entity),
    entities: [...s.entities, entity],
  }));
}

/** Replace an entity; renames cascade to the saved queries that reference it. */
export function updateEntity(
  schemas: TableSchema[],
  schemaId: string,
  oldName: string,
  entity: Entity,
): TableSchema[] {
  return patchSchema(schemas, schemaId, (s) => ({
    ...s,
    indexes: mergeIndexes(s.indexes, entity),
    entities: s.entities.map((e) => (e.name === oldName ? entity : e)),
    queries: s.queries.map((q) =>
      q.entityName === oldName ? { ...q, entityName: entity.name } : q,
    ),
  }));
}

/** Remove an entity along with its saved queries. */
export function deleteEntity(
  schemas: TableSchema[],
  schemaId: string,
  entityName: string,
): TableSchema[] {
  return patchSchema(schemas, schemaId, (s) => ({
    ...s,
    entities: s.entities.filter((e) => e.name !== entityName),
    queries: s.queries.filter((q) => q.entityName !== entityName),
  }));
}

/** Register index definitions for any pattern the entity references that the table doesn't know yet. */
function mergeIndexes(indexes: IndexDef[], entity: Entity): IndexDef[] {
  const missing = entity.indexPatterns
    .filter((p) => !indexes.some((d) => d.name === p.index))
    .map((p) => ({ name: p.index, pkAttr: `${p.index}PK`, skAttr: `${p.index}SK` }));
  return missing.length > 0 ? [...indexes, ...missing] : indexes;
}

// ---- Saved queries ----

export function addQuery(schemas: TableSchema[], schemaId: string, query: SavedQuery): TableSchema[] {
  return patchSchema(schemas, schemaId, (s) => ({ ...s, queries: [...s.queries, query] }));
}

export function updateQuery(schemas: TableSchema[], schemaId: string, query: SavedQuery): TableSchema[] {
  return patchSchema(schemas, schemaId, (s) => ({
    ...s,
    queries: s.queries.map((q) => (q.id === query.id ? query : q)),
  }));
}

export function renameQuery(
  schemas: TableSchema[],
  schemaId: string,
  queryId: string,
  name: string,
): TableSchema[] {
  return patchSchema(schemas, schemaId, (s) => ({
    ...s,
    queries: s.queries.map((q) => (q.id === queryId ? { ...q, name } : q)),
  }));
}

export function deleteQuery(schemas: TableSchema[], schemaId: string, queryId: string): TableSchema[] {
  return patchSchema(schemas, schemaId, (s) => ({
    ...s,
    queries: s.queries.filter((q) => q.id !== queryId),
  }));
}
