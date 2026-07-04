/**
 * Codex subscription quota capabilities subscriber registry.
 *
 * Adapted for ccagent (Tauri): uses Tauri `listen` for event delivery
 * instead of `window.updateCodexSubscriptionQuota` global callbacks.
 */
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { sendBridgeEventQuiet } from "./bridge";

export interface CodexSubscriptionQuotaWindow {
  windowLabel: string;
  windowHours: number;
  usedPercent?: number | null;
  remainingPercent?: number | null;
  resetsAt?: number | null;
  usedTokens: number;
  limitTokens?: number | null;
  remainingTokens?: number | null;
  usedCost?: number | null;
  sessionCount?: number;
  lastUpdated?: number;
  source?: string;
}

export interface CodexSubscriptionQuotaSnapshot {
  status: "ok" | "unavailable" | "error";
  fetchedAt: number;
  source?: string;
  error?: string;
  /** Machine-readable reason for unavailability, e.g. 'api_key_mode'. */
  reasonCode?: string;
  windows: {
    fiveHour: CodexSubscriptionQuotaWindow;
    weekly: CodexSubscriptionQuotaWindow;
  };
}

type QuotaListener = (snapshot: CodexSubscriptionQuotaSnapshot) => void;

const listeners = new Set<QuotaListener>();
let unlisten: UnlistenFn | null = null;

function emit(value: CodexSubscriptionQuotaSnapshot): void {
  Array.from(listeners).forEach((listener) => {
    try {
      listener(value);
    } catch (error) {
      console.error("[codexSubscriptionQuotaCapabilities] Listener threw:", error);
    }
  });
}

function safeParseSnapshot(payload: unknown): CodexSubscriptionQuotaSnapshot | null {
  try {
    const parsed = (typeof payload === "string" ? JSON.parse(payload) : payload) as CodexSubscriptionQuotaSnapshot;
    if (!parsed || typeof parsed !== "object") {
      return null;
    }
    if (!parsed.windows?.fiveHour || !parsed.windows?.weekly) {
      return null;
    }
    return parsed;
  } catch (error) {
    console.error("[codexSubscriptionQuotaCapabilities] Failed to parse snapshot:", error);
    return null;
  }
}

async function ensureInstalled(): Promise<void> {
  if (typeof window === "undefined") return;
  if (unlisten) return;

  try {
    unlisten = await listen<unknown>("cc-codex-subscription-quota", (event) => {
      const snapshot = safeParseSnapshot(event.payload);
      if (snapshot) emit(snapshot);
    });
  } catch (error) {
    console.error("[codexSubscriptionQuotaCapabilities] Failed to install listener:", error);
  }
}

export async function subscribeCodexSubscriptionQuota(listener: QuotaListener): Promise<() => void> {
  await ensureInstalled();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function fetchCodexSubscriptionQuota(): void {
  sendBridgeEventQuiet("get_codex_subscription_quota");
}
