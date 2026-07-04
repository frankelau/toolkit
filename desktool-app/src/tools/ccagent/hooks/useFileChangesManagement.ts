// useFileChangesManagement — 文件变更管理
// 对齐 cc-gui useFileChangesManagement

import { useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { FileChangeSummary, EditOperation } from "../types";
import { buildEditOperation } from "../utils";

export interface FileChangesManagement {
  fileChanges: FileChangeSummary[];
  setFileChanges: React.Dispatch<React.SetStateAction<FileChangeSummary[]>>;
  trackFileChange: (toolName: string, input: Record<string, unknown>) => void;
  undoFile: (filePath: string, cwd: string) => Promise<void>;
  discardAll: (cwd: string) => Promise<void>;
  clearChanges: () => void;
}

export function useFileChangesManagement(): FileChangesManagement {
  const [fileChanges, setFileChanges] = useState<FileChangeSummary[]>([]);

  const trackFileChange = useCallback((toolName: string, input: Record<string, unknown>) => {
    const filePath = String(input.file_path ?? "");
    if (!filePath) return;
    const fileName = filePath.split(/[/\\]/).pop() || filePath;
    const op: EditOperation = buildEditOperation(toolName, input);

    setFileChanges(prev => {
      const existing = prev.find(f => f.filePath === filePath);
      if (existing) {
        return prev.map(f => f.filePath === filePath ? {
          ...f,
          additions: f.additions + op.additions,
          deletions: f.deletions + op.deletions,
          operations: [...f.operations, op],
        } : f);
      }
      return [...prev, {
        filePath, fileName,
        status: toolName === "Write" ? 'A' : 'M',
        additions: op.additions,
        deletions: op.deletions,
        operations: [op],
      }];
    });
  }, []);

  const undoFile = useCallback(async (filePath: string, cwd: string) => {
    await invoke("cc_undo_file", { filePath, cwd }).catch(() => {});
    setFileChanges(prev => prev.filter(f => f.filePath !== filePath));
  }, []);

  const discardAll = useCallback(async (cwd: string) => {
    await invoke("cc_discard_all_files", { cwd }).catch(() => {});
    setFileChanges([]);
  }, []);

  const clearChanges = useCallback(() => setFileChanges([]), []);

  return {
    fileChanges, setFileChanges,
    trackFileChange, undoFile, discardAll, clearChanges,
  };
}
