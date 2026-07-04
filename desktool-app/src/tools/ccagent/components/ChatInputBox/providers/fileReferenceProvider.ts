// fileReferenceProvider — @file 补全（对齐 cc-gui fileReferenceProvider）
// Sprint B: 触发 @ 字符时，调用 cc_list_files 获取文件列表

import { invoke } from "@tauri-apps/api/core";
import type { CompletionItem } from "../hooks/useCompletionDropdown";

export interface FileEntry {
  path: string;
  full_path: string;
  is_dir: boolean;
  size: number;
}

const HIDDEN_DIRS = new Set(["node_modules", ".git", "target", "__pycache__", ".next", "dist", "build", ".cache"]);

export async function fetchFileCompletions(cwd: string, query: string): Promise<CompletionItem[]> {
  if (!cwd) return [];
  try {
    const files = await invoke<FileEntry[]>("cc_list_files", { dir: cwd, query });
    return files
      .filter(f => {
        const parts = f.path.split("/");
        return !parts.some(p => HIDDEN_DIRS.has(p));
      })
      .slice(0, 50)
      .map(f => ({
        id: f.full_path,
        label: f.path,
        description: f.is_dir ? "📁 目录" : f.size > 0 ? `${(f.size / 1024).toFixed(1)}KB` : "",
        icon: f.is_dir ? "📁" : "📄",
        insertText: f.path,
        data: f,
      }));
  } catch {
    return [];
  }
}
