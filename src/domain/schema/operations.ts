import type { DynamoTable, Entity } from './types.ts';

export function addSchema(schemas: DynamoTable[], schema: DynamoTable): DynamoTable[] {
  return [...schemas, schema];
}

export function updateSchema(schemas: DynamoTable[], idx: number, patch: Partial<DynamoTable>): DynamoTable[] {
  return schemas.map((s, i) => (i === idx ? { ...s, ...patch } : s));
}

export function deleteSchema(
  schemas: DynamoTable[],
  idx: number,
): { schemas: DynamoTable[]; newIdx: number } {
  const next = schemas.filter((_, i) => i !== idx);
  return { schemas: next, newIdx: Math.max(0, Math.min(idx, next.length - 1)) };
}

export function addEntity(schema: DynamoTable, entity: Entity): DynamoTable {
  return { ...schema, entities: [...schema.entities, entity] };
}

export function updateEntity(schema: DynamoTable, oldName: string, entity: Entity): DynamoTable {
  return {
    ...schema,
    entities: schema.entities.map((e) => (e.name === oldName ? entity : e)),
  };
}

export function deleteEntity(schema: DynamoTable, entityName: string): DynamoTable {
  return { ...schema, entities: schema.entities.filter((e) => e.name !== entityName) };
}
