import { isTauriRuntime } from './runtime.ts';

export async function confirmDialog(message: string, title?: string): Promise<boolean> {
  if (isTauriRuntime()) {
    const { ask } = await import('@tauri-apps/plugin-dialog');
    return ask(message, { title, kind: 'warning' });
  }
  return window.confirm(message);
}

/**
 * Choice between two actions plus a way out. Resolves to 'primary', 'secondary',
 * or null when the user cancels (Cancel button, Esc, or closing the dialog).
 */
export async function chooseDialog(
  message: string,
  options: { title?: string; primaryLabel: string; secondaryLabel: string },
): Promise<'primary' | 'secondary' | null> {
  const { title, primaryLabel, secondaryLabel } = options;
  if (isTauriRuntime()) {
    const { message: showMessage } = await import('@tauri-apps/plugin-dialog');
    const result = await showMessage(message, {
      title,
      kind: 'warning',
      buttons: { yes: primaryLabel, no: secondaryLabel, cancel: 'Cancel' },
    });
    if (result === primaryLabel || result === 'Yes') return 'primary';
    if (result === secondaryLabel || result === 'No') return 'secondary';
    return null;
  }
  if (window.confirm(`${message}\n\nOK = ${primaryLabel}`)) return 'primary';
  return window.confirm(`${secondaryLabel}?\n\nCancel aborts.`) ? 'secondary' : null;
}

export async function alertDialog(message: string, title?: string): Promise<void> {
  if (isTauriRuntime()) {
    const { message: showMessage } = await import('@tauri-apps/plugin-dialog');
    await showMessage(message, { title, kind: 'error' });
    return;
  }
  window.alert(message);
}

/** Native "Save as…" dialog + write. Returns false when the user cancels. */
export async function saveTextFileAs(
  defaultFileName: string,
  contents: string,
): Promise<boolean> {
  const { save } = await import('@tauri-apps/plugin-dialog');
  const path = await save({
    defaultPath: defaultFileName,
    filters: [{ name: 'JSON', extensions: ['json'] }],
  });
  if (!path) return false;
  const { invoke } = await import('@tauri-apps/api/core');
  await invoke('save_text_file', { path, contents });
  return true;
}
