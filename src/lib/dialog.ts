import { isTauriRuntime } from './dynamo.ts';

export async function confirmDialog(message: string, title?: string): Promise<boolean> {
  if (isTauriRuntime()) {
    const { ask } = await import('@tauri-apps/plugin-dialog');
    return ask(message, { title, kind: 'warning' });
  }
  return window.confirm(message);
}

export async function alertDialog(message: string, title?: string): Promise<void> {
  if (isTauriRuntime()) {
    const { message: showMessage } = await import('@tauri-apps/plugin-dialog');
    await showMessage(message, { title, kind: 'error' });
    return;
  }
  window.alert(message);
}
