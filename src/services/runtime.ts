/** True when running inside the Tauri desktop shell (vs. plain browser dev). */
export const isTauriRuntime = (): boolean =>
  typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
