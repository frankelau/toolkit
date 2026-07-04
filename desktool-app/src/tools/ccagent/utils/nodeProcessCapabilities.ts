/**
 * Node process capabilities subscriber registry.
 *
 * Adapted for ccagent (Tauri): uses Tauri `listen` for event delivery
 * instead of `window.updateNodeProcesses` global callbacks. The fetch
 * function invokes the backend; if the command is not registered
 * (cc-gui-specific feature), the subscribe call simply never receives
 * a snapshot and the UI shows an empty state.
 */
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { sendBridgeEventQuiet } from "./bridge";

export type NodeProcessKind = "DAEMON" | "CHANNEL" | "ORPHAN";

export interface NodeProcessInfo {
  id: string;
  kind: NodeProcessKind;
  provider?: string;
  pid: number;
  alive: boolean;
  startedAt: number;
  uptimeMs: number;
  command?: string;
  heapUsed?: number;
  activeRequestCount: number;
  channelId?: string;
  sessionId?: string;
  tabName?: string;
  orphan: boolean;
}

export interface NodeProcessTotals {
  daemon: number;
  channel: number;
  orphan: number;
  all: number;
}

export interface NodeProcessSnapshot {
  snapshotAt: number;
  totals: NodeProcessTotals;
  processes: NodeProcessInfo[];
}

export interface NodeProcessKillResult {
  pid?: number;
  id?: string;
  success?: boolean;
  error?: string;
  killed?: number;
  restart?: boolean;
}

type SnapshotListener = (snapshot: NodeProcessSnapshot) => void;
type KillResultListener = (result: NodeProcessKillResult) => void;

const snapshotListeners = new Set<SnapshotListener>();
const killResultListeners = new Set<KillResultListener>();

let snapshotUnlisten: UnlistenFn | null = null;
let killResultUnlisten: UnlistenFn | null = null;

function emit<T>(listeners: Set<(value: T) => void>, value: T): void {
  Array.from(listeners).forEach((listener) => {
    try {
      listener(value);
    } catch (error) {
      console.error("[nodeProcessCapabilities] Listener threw:", error);
    }
  });
}

function safeParseSnapshot(payload: unknown): NodeProcessSnapshot | null {
  try {
    const parsed = (typeof payload === "string" ? JSON.parse(payload) : payload) as NodeProcessSnapshot;
    if (!parsed || !Array.isArray(parsed.processes)) {
      return null;
    }
    return parsed;
  } catch (error) {
    console.error("[nodeProcessCapabilities] Failed to parse snapshot:", error);
    return null;
  }
}

function safeParseKillResult(payload: unknown): NodeProcessKillResult | null {
  try {
    return (typeof payload === "string" ? JSON.parse(payload) : payload) as NodeProcessKillResult;
  } catch (error) {
    console.error("[nodeProcessCapabilities] Failed to parse kill result:", error);
    return null;
  }
}

async function ensureInstalled(): Promise<void> {
  if (typeof window === "undefined") return;
  if (snapshotUnlisten && killResultUnlisten) return;

  if (!snapshotUnlisten) {
    try {
      snapshotUnlisten = await listen<unknown>("cc-node-processes", (event) => {
        const snapshot = safeParseSnapshot(event.payload);
        if (snapshot) emit(snapshotListeners, snapshot);
      });
    } catch (error) {
      console.error("[nodeProcessCapabilities] Failed to install snapshot listener:", error);
    }
  }

  if (!killResultUnlisten) {
    try {
      killResultUnlisten = await listen<unknown>("cc-node-process-kill-result", (event) => {
        const result = safeParseKillResult(event.payload);
        if (result) emit(killResultListeners, result);
      });
    } catch (error) {
      console.error("[nodeProcessCapabilities] Failed to install kill-result listener:", error);
    }
  }
}

export async function subscribeNodeProcesses(listener: SnapshotListener): Promise<() => void> {
  await ensureInstalled();
  snapshotListeners.add(listener);
  return () => {
    snapshotListeners.delete(listener);
  };
}

export async function subscribeNodeProcessKillResult(listener: KillResultListener): Promise<() => void> {
  await ensureInstalled();
  killResultListeners.add(listener);
  return () => {
    killResultListeners.delete(listener);
  };
}

/** Request the latest snapshot from the backend. Response arrives via the `cc-node-processes` event. */
export function fetchNodeProcesses(): void {
  sendBridgeEventQuiet("get_node_processes");
}

/** Ask the backend to kill a single process by PID. */
export function killNodeProcess(pid: number, id?: string): void {
  sendBridgeEventQuiet("kill_node_process", JSON.stringify(id ? { pid, id } : { pid }));
}

/** Ask the backend to kill every detected orphan process. */
export function killAllOrphanProcesses(): void {
  sendBridgeEventQuiet("kill_all_orphans");
}

/** Ask the backend to restart the daemon owning the given PID (falls back to plain kill on miss). */
export function restartNodeDaemon(pid: number): void {
  sendBridgeEventQuiet("restart_node_daemon", JSON.stringify({ pid }));
}
