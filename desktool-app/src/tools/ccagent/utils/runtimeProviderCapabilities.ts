/**
 * Runtime provider capabilities subscriber registry.
 *
 * Adapted for ccagent (Tauri): uses Tauri `listen` for event delivery
 * instead of `window.updateProviders` / `window.updateActiveProvider`
 * global callbacks. Multiple React components (Settings hook,
 * RuntimeProviderSelect, etc.) can subscribe without overwriting each
 * other's callbacks.
 */
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

type ProviderListListener = (json: string) => void;
type ActiveProviderListener = (json: string) => void;

const providerListListeners = new Set<ProviderListListener>();
const activeProviderListeners = new Set<ActiveProviderListener>();
const codexProviderListListeners = new Set<ProviderListListener>();
const activeCodexProviderListeners = new Set<ActiveProviderListener>();

const unlistenFns: UnlistenFn[] = [];
let installed = false;

function emit<T>(listeners: Set<(value: T) => void>, value: T): void {
  // Snapshot to avoid mutation during iteration.
  Array.from(listeners).forEach((listener) => {
    try {
      listener(value);
    } catch (error) {
      console.error("[runtimeProviderCapabilities] Listener threw:", error);
    }
  });
}

/**
 * Installs the Tauri event listeners for provider updates.
 * Safe to call multiple times — subsequent calls are no-ops.
 */
export async function installRuntimeProviderDispatchers(): Promise<void> {
  if (installed) return;
  if (typeof window === "undefined") return;

  try {
    unlistenFns.push(
      await listen<string>("cc-providers", (event) => {
        emit(providerListListeners, typeof event.payload === "string" ? event.payload : JSON.stringify(event.payload));
      }),
    );
    unlistenFns.push(
      await listen<string>("cc-active-provider", (event) => {
        emit(activeProviderListeners, typeof event.payload === "string" ? event.payload : JSON.stringify(event.payload));
      }),
    );
    unlistenFns.push(
      await listen<string>("cc-codex-providers", (event) => {
        emit(codexProviderListListeners, typeof event.payload === "string" ? event.payload : JSON.stringify(event.payload));
      }),
    );
    unlistenFns.push(
      await listen<string>("cc-active-codex-provider", (event) => {
        emit(activeCodexProviderListeners, typeof event.payload === "string" ? event.payload : JSON.stringify(event.payload));
      }),
    );
    installed = true;
  } catch (error) {
    console.error("[runtimeProviderCapabilities] Failed to install listeners:", error);
  }
}

async function ensureInstalled(): Promise<void> {
  if (installed) return;
  await installRuntimeProviderDispatchers();
}

export async function subscribeProviderList(listener: ProviderListListener): Promise<() => void> {
  await ensureInstalled();
  providerListListeners.add(listener);
  return () => {
    providerListListeners.delete(listener);
  };
}

export async function subscribeActiveProvider(listener: ActiveProviderListener): Promise<() => void> {
  await ensureInstalled();
  activeProviderListeners.add(listener);
  return () => {
    activeProviderListeners.delete(listener);
  };
}

export async function subscribeCodexProviderList(listener: ProviderListListener): Promise<() => void> {
  await ensureInstalled();
  codexProviderListListeners.add(listener);
  return () => {
    codexProviderListListeners.delete(listener);
  };
}

export async function subscribeActiveCodexProvider(listener: ActiveProviderListener): Promise<() => void> {
  await ensureInstalled();
  activeCodexProviderListeners.add(listener);
  return () => {
    activeCodexProviderListeners.delete(listener);
  };
}
