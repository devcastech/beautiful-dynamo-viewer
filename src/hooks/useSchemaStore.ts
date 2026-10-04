import { useCallback, useEffect, useRef, useState } from 'react';
import * as ops from '../domain/schema/operations.ts';
import type { Entity, SavedQuery, TableSchema } from '../domain/schema/types.ts';
import type { SchemaRepository } from '../services/storage.ts';
import { seedSchemas } from '../data/seed.ts';

const SAVE_DEBOUNCE_MS = 400;
const ACTIVE_SCHEMA_KEY = 'dynamo-viewer.activeSchema';

/**
 * Owns the schema collection: loads it from the repository on mount (seeding
 * example schemas on first run), persists every mutation with a debounce, and
 * exposes pure-domain operations bound to the active schema.
 */
export function useSchemaStore(repo: SchemaRepository) {
  const [schemas, setSchemas] = useState<TableSchema[] | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    repo
      .load()
      .then((stored) => {
        if (cancelled) return;
        const initial = stored ?? seedSchemas();
        setSchemas(initial);
        // Restore the last active schema if it still exists, else fall back to the first.
        const savedActive = localStorage.getItem(ACTIVE_SCHEMA_KEY);
        const active = initial.find((s) => s.id === savedActive)?.id ?? initial[0]?.id ?? null;
        setActiveId(active);
        if (stored === null && initial.length > 0) void repo.save(initial);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        // Don't seed over a corrupt file; surface the error and start empty
        // so the user's workspace.json stays untouched for manual recovery.
        setLoadError(err instanceof Error ? err.message : String(err));
        setSchemas([]);
      });
    return () => {
      cancelled = true;
    };
  }, [repo]);

  // Persist the active schema so a reload reopens where the user left off.
  // Guard on `schemas` so the initial null state doesn't clobber the saved id
  // before the async load has had a chance to read it back.
  useEffect(() => {
    if (schemas === null) return;
    if (activeId) localStorage.setItem(ACTIVE_SCHEMA_KEY, activeId);
    else localStorage.removeItem(ACTIVE_SCHEMA_KEY);
  }, [activeId, schemas]);

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Schemas mutated but not yet persisted; lets the unload flush save what the
  // debounce window would otherwise drop.
  const pendingSave = useRef<TableSchema[] | null>(null);

  const mutate = useCallback(
    (next: TableSchema[]) => {
      setSchemas(next);
      pendingSave.current = next;
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        saveTimer.current = null;
        pendingSave.current = null;
        repo
          .save(next)
          .then(() => setSaveError(null))
          .catch((err: unknown) => {
            setSaveError(err instanceof Error ? err.message : String(err));
          });
      }, SAVE_DEBOUNCE_MS);
    },
    [repo],
  );

  // Flush a pending debounced save when the window goes away. Best-effort: the
  // localStorage repo completes synchronously; the Tauri repo at least gets the
  // invoke dispatched before the webview dies.
  useEffect(() => {
    function flush() {
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
        saveTimer.current = null;
      }
      const pending = pendingSave.current;
      pendingSave.current = null;
      if (pending) void repo.save(pending).catch(() => {});
    }
    window.addEventListener('beforeunload', flush);
    return () => window.removeEventListener('beforeunload', flush);
  }, [repo]);

  const loading = schemas === null;
  const list = schemas ?? [];
  const activeSchema = list.find((s) => s.id === activeId) ?? list[0] ?? null;

  function withActive(fn: (schemaId: string) => TableSchema[]) {
    if (!activeSchema) return;
    mutate(fn(activeSchema.id));
  }

  return {
    loading,
    loadError,
    saveError,
    schemas: list,
    activeSchema,
    setActiveId,

    addSchema(schema: TableSchema) {
      mutate(ops.addSchema(list, schema));
      setActiveId(schema.id);
    },
    updateSchema(patch: Partial<Omit<TableSchema, 'id' | 'version'>>) {
      withActive((id) => ops.updateSchema(list, id, patch));
    },
    deleteSchema() {
      if (!activeSchema) return;
      const next = ops.deleteSchema(list, activeSchema.id);
      mutate(next);
      setActiveId(next[0]?.id ?? null);
    },

    addEntity(entity: Entity) {
      withActive((id) => ops.addEntity(list, id, entity));
    },
    updateEntity(oldName: string, entity: Entity) {
      withActive((id) => ops.updateEntity(list, id, oldName, entity));
    },
    deleteEntity(entityName: string) {
      withActive((id) => ops.deleteEntity(list, id, entityName));
    },

    addQuery(query: SavedQuery) {
      withActive((id) => ops.addQuery(list, id, query));
    },
    updateQuery(query: SavedQuery) {
      withActive((id) => ops.updateQuery(list, id, query));
    },
    renameQuery(queryId: string, name: string) {
      withActive((id) => ops.renameQuery(list, id, queryId, name));
    },
    deleteQuery(queryId: string) {
      withActive((id) => ops.deleteQuery(list, id, queryId));
    },
  };
}

export type SchemaStore = ReturnType<typeof useSchemaStore>;
