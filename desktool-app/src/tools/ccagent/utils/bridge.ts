/**
 * Bridge layer — Tauri adaptation of cc-gui's bridge.ts.
 *
 * cc-gui uses JCEF (Java) with `window.*` global callbacks and
 * `CefBrowser.executeJavaScript`-style bridge events. ccagent runs on
 * Tauri, so:
 *   - `sendBridgeEvent(name, payload?)` → `invoke("cc_<name>", { payload })`
 *   - file path resolution → `invoke("cc_resolve_file_path", { path })`
 *   - linkify integration is handled by `utils/linkify.ts` (separate module)
 *
 * The Tauri command may not exist for every bridge event name (e.g. node
 * process management is cc-gui-specific). In that case invoke rejects and
 * we log a debug warning — callers are expected to handle absence gracefully
 * (the corresponding UI shows an empty state).
 */
import { invoke } from "@tauri-apps/api/core";

const BRIDGE_UNAVAILABLE_WARNED = new Set<string>();

function warnOnce(name: string, error: unknown): void {
  if (BRIDGE_UNAVAILABLE_WARNED.has(name)) return;
  BRIDGE_UNAVAILABLE_WARNED.add(name);
  console.warn(`[bridge] command "cc_${name}" unavailable:`, error);
}

/**
 * Send a bridge event to the Rust backend via Tauri invoke.
 * The backend command is named `cc_<eventName>` (snake_cased).
 * Returns a promise that resolves with the backend's response, or rejects
 * if the command is not registered.
 */
export async function sendBridgeEvent<T = unknown>(
  eventName: string,
  payload?: string,
): Promise<T | void> {
  const command = `cc_${eventName}`;
  try {
    if (payload !== undefined) {
      return await invoke<T>(command, { payload });
    }
    return await invoke<T>(command);
  } catch (error) {
    warnOnce(eventName, error);
    throw error;
  }
}

/**
 * Fire-and-forget variant: sends the event but swallows backend errors.
 * Useful for capabilities fetchers whose response arrives via a separate
 * event stream (listen) rather than the invoke return value.
 */
export function sendBridgeEventQuiet(eventName: string, payload?: string): void {
  sendBridgeEvent(eventName, payload).catch(() => {
    /* backend command may not exist in ccagent — silently ignore */
  });
}

/**
 * Resolve a file path via the backend (used by linkify navigation).
 * Returns the resolved absolute path or null if not found / backend unavailable.
 */
export async function resolveFilePath(path: string): Promise<string | null> {
  try {
    const result = await invoke<string | null>("cc_resolve_file_path", { path });
    return result ?? null;
  } catch (error) {
    warnOnce("resolve_file_path", error);
    return null;
  }
}

/**
 * Open a file in the system editor / IDE via the backend.
 */
export async function openFile(filePath: string): Promise<void> {
  try {
    await invoke("cc_open_file", { filePath });
  } catch (error) {
    warnOnce("open_file", error);
  }
}

/**
 * Open an external URL in the system browser via the backend.
 */
export async function openExternalUrl(url: string): Promise<void> {
  try {
    await invoke("cc_open_external_url", { url });
  } catch (error) {
    warnOnce("open_external_url", error);
  }
}
