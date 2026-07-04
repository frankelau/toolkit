// useFileChanges — 文件变更追踪（对齐 cc-gui useFileChanges）
// Sprint A: 从工具调用中提取 Write/Edit/MultiEdit，构建 FileChangeSummary

import { useCallback, useMemo } from "react";
import type { ChatMessage, FileChangeSummary, EditOperation, ToolUseBlock } from "../types";
import { buildEditOperation } from "../utils";

interface UseFileChangesOptions {
  messages: ChatMessage[];
}

export function useFileChanges({ messages }: UseFileChangesOptions) {
  const fileChanges = useMemo<FileChangeSummary[]>(() => {
    const map = new Map<string, FileChangeSummary>();

    for (const msg of messages) {
      if (!msg.toolUses) continue;
      for (const tool of msg.toolUses) {
        const op = buildFileChangeFromTool(tool);
        if (!op) continue;
        const existing = map.get(op.filePath);
        if (existing) {
          existing.operations.push(op.operation);
          existing.additions += op.operation.additions;
          existing.deletions += op.operation.deletions;
          // 写入覆盖编辑
          if (op.operation.toolName === "Write") {
            existing.status = "M";
          }
        } else {
          map.set(op.filePath, {
            filePath: op.filePath,
            fileName: op.filePath.split("/").pop() || op.filePath,
            status: op.operation.toolName === "Write" ? "M" : "M",
            additions: op.operation.additions,
            deletions: op.operation.deletions,
            operations: [op.operation],
          });
        }
      }
    }
    return Array.from(map.values());
  }, [messages]);

  /** 移除指定文件的变更记录（用于 undo 后清理） */
  const removeFileChange = useCallback((filePath: string, setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>) => {
    setMessages(prev => prev.map(msg => ({
      ...msg,
      toolUses: msg.toolUses?.filter(t => {
        const fp = t.input?.file_path as string;
        return fp !== filePath;
      }),
    })));
  }, []);

  const totalAdditions = fileChanges.reduce((s, f) => s + f.additions, 0);
  const totalDeletions = fileChanges.reduce((s, f) => s + f.deletions, 0);

  return {
    fileChanges,
    totalAdditions,
    totalDeletions,
    fileCount: fileChanges.length,
    removeFileChange,
  };
}

function buildFileChangeFromTool(tool: ToolUseBlock): { filePath: string; operation: EditOperation } | null {
  const name = tool.name;
  const input = tool.input || {};
  const filePath = (input.file_path as string) || (input.path as string);
  if (!filePath) return null;
  if (!["Write", "Edit", "MultiEdit", "NotebookEdit"].includes(name)) return null;
  return { filePath, operation: buildEditOperation(name, input) };
}
