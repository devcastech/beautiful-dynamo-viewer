import { useState } from 'react';
import type { TableSchema } from '../domain/schema/types.ts';

const TABLE_KEY_PREFIX = 'dynamo-viewer.table';

/**
 * The physical table name depends on the environment (account, region), not on
 * the model, so overrides are remembered per schema + profile + region and the
 * schema's own tableName stays the portable default.
 */
export function tableNameKey(schemaId: string, profile: string | null, region: string): string {
  return `${TABLE_KEY_PREFIX}.${schemaId}.${profile ?? '-'}.${region}`;
}

function readStored(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStored(key: string, value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // Storage unavailable: the override still lives for this session.
  }
}

/** Drop every remembered table name of a schema (e.g. when the schema is deleted). */
export function forgetTableNames(schemaId: string): void {
  try {
    const prefix = `${TABLE_KEY_PREFIX}.${schemaId}.`;
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(prefix)) keys.push(key);
    }
    keys.forEach((key) => localStorage.removeItem(key));
  } catch {
    // Storage unavailable: nothing to clean up.
  }
}

/** Effective table name for the active schema in the current AWS environment. */
export function useTableName(schema: TableSchema | null, profile: string | null, region: string) {
  // In-session edits, so an emptied field stays empty while typing instead of
  // snapping back to the schema default.
  const [edits, setEdits] = useState<Record<string, string>>({});
  const key = schema ? tableNameKey(schema.id, profile, region) : null;

  const tableName = key ? (edits[key] ?? readStored(key) ?? schema?.tableName ?? '') : '';

  function setTableName(name: string) {
    if (!key || !schema) return;
    setEdits((current) => ({ ...current, [key]: name }));
    // Only real overrides are stored; empty or default falls back to the schema.
    const trimmed = name.trim();
    writeStored(key, trimmed === '' || trimmed === schema.tableName ? null : trimmed);
  }

  return { tableName, setTableName };
}
