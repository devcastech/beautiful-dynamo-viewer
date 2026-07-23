import { invoke } from '@tauri-apps/api/core';
import { parseWorkspace, serializeWorkspace } from '../domain/schema/migrate.ts';
import type { TableSchema } from '../domain/schema/types.ts';
import { isTauriRuntime } from './runtime.ts';

export interface SchemaRepository {
  /** Stored schemas, or null when nothing has been persisted yet (first run). */
  load(): Promise<TableSchema[] | null>;
  save(schemas: TableSchema[]): Promise<void>;
}

/** Desktop: workspace.json in the app-data dir, written atomically by the Rust side. */
const fileRepository: SchemaRepository = {
  async load() {
    const contents = await invoke<string | null>('load_workspace');
    return contents == null ? null : parseWorkspace(contents);
  },
  async save(schemas) {
    await invoke('save_workspace', { contents: serializeWorkspace(schemas) });
  },
};

const STORAGE_KEY = 'dynamo-viewer.workspace';

/** Browser dev fallback (`pnpm dev` outside Tauri). */
const localStorageRepository: SchemaRepository = {
  async load() {
    const contents = window.localStorage.getItem(STORAGE_KEY);
    return contents == null ? null : parseWorkspace(contents);
  },
  async save(schemas) {
    window.localStorage.setItem(STORAGE_KEY, serializeWorkspace(schemas));
  },
};

export function createSchemaRepository(): SchemaRepository {
  return isTauriRuntime() ? fileRepository : localStorageRepository;
}
