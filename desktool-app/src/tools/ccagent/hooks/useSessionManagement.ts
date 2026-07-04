// useSessionManagement — 会话生命周期管理（对齐 cc-gui useSessionManagement）
// Sprint A: startSession / abort / resume / loadHistory

import { useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type { Engine, ClaudeSession } from "../types";

interface UseSessionManagementOptions {
  sessionId: string | null;
  setSessionId: (id: string | null) => void;
  engine: Engine;
  cwd: string;
  setMessages: React.Dispatch<React.SetStateAction<import("../types").ChatMessage[]>>;
  setStreaming: (v: boolean) => void;
  streamingMsgRef: React.MutableRefObject<import("../types").ChatMessage | null>;
  onStreamEvent: (data: Record<string, unknown>) => void;
  buildConfig: () => Record<string, unknown>;
  unlistenRef: React.MutableRefObject<UnlistenFn | null>;
  onSessionEnd?: () => void;
}

export function useSessionManagement({
  sessionId, setSessionId, engine, cwd,
  setMessages, setStreaming, streamingMsgRef, onStreamEvent,
  buildConfig, unlistenRef, onSessionEnd,
}: UseSessionManagementOptions) {
  const startSession = useCallback(async () => {
    if (sessionId) {
      onSessionEnd?.();
      await invoke("cc_abort_session", { sessionId }).catch(() => {});
      setSessionId(null);
    }

    const config = buildConfig();
    try {
      const sid = await invoke<string>("cc_start_session", { config });
      setSessionId(sid);
      setMessages([]);
      setStreaming(false);
      streamingMsgRef.current = null;

      unlistenRef.current?.();
      unlistenRef.current = await listen<Record<string, unknown>>(`cc-event-${sid}`, (event) => {
        onStreamEvent(event.payload as Record<string, unknown>);
      });
    } catch (e) {
      throw e;
    }
  }, [sessionId, engine, cwd, buildConfig, onStreamEvent, onSessionEnd, setSessionId, setMessages, setStreaming, streamingMsgRef, unlistenRef]);

  const abort = useCallback(async () => {
    if (!sessionId) return;
    setStreaming(false);
    streamingMsgRef.current = null;
    await invoke("cc_abort_session", { sessionId }).catch(() => {});
  }, [sessionId, setStreaming, streamingMsgRef]);

  const loadHistory = useCallback(async (): Promise<ClaudeSession[]> => {
    try {
      const sessions = await invoke<ClaudeSession[]>("cc_list_claude_sessions");
      return sessions;
    } catch {
      return [];
    }
  }, []);

  const resume = useCallback(async (_targetSessionId: string) => {
    if (sessionId) {
      await invoke("cc_abort_session", { sessionId }).catch(() => {});
      setSessionId(null);
    }
    // resume 通过输入框 /resume <id> 实现，这里只清理旧会话
  }, [sessionId, setSessionId]);

  return { startSession, abort, loadHistory, resume };
}
