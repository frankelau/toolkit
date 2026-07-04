// useHistoryLoader — 历史加载
// 对齐 cc-gui useHistoryLoader

import { useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { ClaudeSession } from "../types";

export interface HistoryLoader {
  sessions: ClaudeSession[];
  loading: boolean;
  error: string | null;
  load: () => Promise<void>;
  refresh: () => Promise<void>;
  clear: () => void;
}

export function useHistoryLoader(): HistoryLoader {
  const [sessions, setSessions] = useState<ClaudeSession[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await invoke<ClaudeSession[]>("cc_list_claude_sessions");
      setSessions(result);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    sessions, loading, error,
    load, refresh: load, clear: () => setSessions([]),
  };
}
