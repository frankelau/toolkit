// SessionContext — 会话状态（对齐 cc-gui SessionContext）
// Sprint A: 从 CcAgent.tsx 拆出会话相关状态

import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Engine, ClaudeSession } from "../types";

export interface SessionContextValue {
  // 当前会话 ID
  sessionId: string | null;
  setSessionId: React.Dispatch<React.SetStateAction<string | null>>;
  // sessionId 的 ref（避免闭包陈旧）
  sessionIdRef: React.RefObject<string | null>;
  // 引擎
  engine: Engine;
  setEngine: React.Dispatch<React.SetStateAction<Engine>>;
  // 工作目录
  cwd: string;
  setCwd: React.Dispatch<React.SetStateAction<string>>;
  // 历史会话列表
  claudeSessions: ClaudeSession[];
  setClaudeSessions: React.Dispatch<React.SetStateAction<ClaudeSession[]>>;
  loadingHistory: boolean;
  setLoadingHistory: React.Dispatch<React.SetStateAction<boolean>>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({
  initialEngine,
  initialCwd,
  children,
}: {
  initialEngine: Engine;
  initialCwd: string;
  children: ReactNode;
}) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [engine, setEngine] = useState<Engine>(initialEngine);
  const [cwd, setCwd] = useState<string>(initialCwd);
  const [claudeSessions, setClaudeSessions] = useState<ClaudeSession[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const sessionIdRef = useRef<string | null>(sessionId);
  useEffect(() => { sessionIdRef.current = sessionId; }, [sessionId]);

  const value = useMemo<SessionContextValue>(
    () => ({
      sessionId, setSessionId, sessionIdRef,
      engine, setEngine,
      cwd, setCwd,
      claudeSessions, setClaudeSessions,
      loadingHistory, setLoadingHistory,
    }),
    [sessionId, engine, cwd, claudeSessions, loadingHistory],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (ctx === null) throw new Error("useSession must be used within a SessionProvider");
  return ctx;
}

export { SessionContext };
