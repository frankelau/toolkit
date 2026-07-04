// SubagentContext — 子 Agent / Todo / 文件变更状态（对齐 cc-gui SubagentContext）
// Sprint A: 从 CcAgent.tsx 拆出状态面板相关状态

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import type { SubagentInfo, TodoItem, FileChangeSummary, StatusPanelTab } from "../types";

export interface SubagentContextValue {
  // Todo 列表
  todos: TodoItem[];
  setTodos: React.Dispatch<React.SetStateAction<TodoItem[]>>;
  // 子 Agent
  subagents: SubagentInfo[];
  setSubagents: React.Dispatch<React.SetStateAction<SubagentInfo[]>>;
  // 文件变更
  fileChanges: FileChangeSummary[];
  setFileChanges: React.Dispatch<React.SetStateAction<FileChangeSummary[]>>;
  // 面板激活的 tab
  statusTab: StatusPanelTab | null;
  setStatusTab: React.Dispatch<React.SetStateAction<StatusPanelTab | null>>;
}

const SubagentContext = createContext<SubagentContextValue | null>(null);

export function SubagentProvider({ children }: { children: ReactNode }) {
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [subagents, setSubagents] = useState<SubagentInfo[]>([]);
  const [fileChanges, setFileChanges] = useState<FileChangeSummary[]>([]);
  const [statusTab, setStatusTab] = useState<StatusPanelTab | null>(null);

  const value = useMemo<SubagentContextValue>(
    () => ({
      todos, setTodos,
      subagents, setSubagents,
      fileChanges, setFileChanges,
      statusTab, setStatusTab,
    }),
    [todos, subagents, fileChanges, statusTab],
  );

  return <SubagentContext.Provider value={value}>{children}</SubagentContext.Provider>;
}

export function useSubagent(): SubagentContextValue {
  const ctx = useContext(SubagentContext);
  if (ctx === null) throw new Error("useSubagent must be used within a SubagentProvider");
  return ctx;
}

export { SubagentContext };
