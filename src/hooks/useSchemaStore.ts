import { useState } from 'react';
import type { DynamoTable, Entity } from '../domain/schema/types.ts';
import type { SchemaRepository } from '../ports/SchemaRepository.ts';
import * as ops from '../domain/schema/operations.ts';

export function useSchemaStore(repo: SchemaRepository) {
  const [schemas, setSchemas] = useState<DynamoTable[]>(() => repo.load());
  const [activeIdx, setActiveIdxState] = useState(0);

  const boundedIdx = Math.max(0, Math.min(activeIdx, schemas.length - 1));
  const activeSchema = schemas[boundedIdx] ?? null;

  function mutate(next: DynamoTable[]) {
    setSchemas(next);
    repo.save(next);
  }

  function setActiveIdx(idx: number) {
    setActiveIdxState(Math.max(0, Math.min(idx, schemas.length - 1)));
  }

  return {
    schemas,
    activeIdx: boundedIdx,
    activeSchema,
    setActiveIdx,
    addSchema(schema: DynamoTable) {
      const next = ops.addSchema(schemas, schema);
      mutate(next);
      setActiveIdxState(next.length - 1);
    },
    updateSchema(patch: Partial<DynamoTable>) {
      mutate(ops.updateSchema(schemas, boundedIdx, patch));
    },
    deleteSchema() {
      const { schemas: next, newIdx } = ops.deleteSchema(schemas, boundedIdx);
      mutate(next);
      setActiveIdxState(newIdx);
    },
    addEntity(entity: Entity) {
      if (!activeSchema) return;
      mutate(schemas.map((s, i) => (i === boundedIdx ? ops.addEntity(s, entity) : s)));
    },
    updateEntity(oldName: string, entity: Entity) {
      if (!activeSchema) return;
      mutate(schemas.map((s, i) => (i === boundedIdx ? ops.updateEntity(s, oldName, entity) : s)));
    },
    deleteEntity(entityName: string) {
      if (!activeSchema) return;
      mutate(schemas.map((s, i) => (i === boundedIdx ? ops.deleteEntity(s, entityName) : s)));
    },
  };
}
