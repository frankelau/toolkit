// types.ts — StatusPanel 类型定义
// 对齐 cc-gui StatusPanel/types.ts

import type { TodoItem, SubagentInfo, FileChangeSummary, StatusPanelTab } from "../../types";

export type { TodoItem, SubagentInfo, FileChangeSummary, StatusPanelTab };

export interface StatusPanelProps {
  todos: TodoItem[];
  subagents: SubagentInfo[];
  fileChanges: FileChangeSummary[];
  isStreaming: boolean;
  activeTab: StatusPanelTab | null;
  onTabClick: (tab: StatusPanelTab) => void;
  onClearFiles: () => void;
  onUndoFile?: (filePath: string) => void;
  onDiscardAll?: () => void;
  contextUsed: number;
  contextMax: number;
}

export interface TodoListProps {
  todos: TodoItem[];
}

export interface SubagentListProps {
  subagents: SubagentInfo[];
}

export interface FileChangesListProps {
  fileChanges: FileChangeSummary[];
  onClear: () => void;
  onUndoFile?: (filePath: string) => void;
  onDiscardAll?: () => void;
}
