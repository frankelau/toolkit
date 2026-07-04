// useResolvedFileLinkTooltip — 文件链接解析（增强版）
// 对齐 cc-gui useResolvedFileLinkTooltip

import { useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";

export interface ResolvedFileLink {
  visible: boolean;
  filePath: string;
  exists: boolean;
  content: string | null;
  lineCount: number;
  loading: boolean;
  resolve: (filePath: string, startLine?: number, endLine?: number) => Promise<void>;
  hide: () => void;
}

export function useResolvedFileLinkTooltip(cwd: string): ResolvedFileLink {
  const [visible, setVisible] = useState(false);
  const [filePath, setFilePath] = useState("");
  const [exists, setExists] = useState(false);
  const [content, setContent] = useState<string | null>(null);
  const [lineCount, setLineCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const resolve = useCallback(async (path: string, startLine?: number, endLine?: number) => {
    setFilePath(path);
    setVisible(true);
    setLoading(true);
    setExists(false);
    setContent(null);
    setLineCount(0);
    try {
      const full = path.startsWith("/") ? path : `${cwd}/${path}`;
      const text = await invoke<string>("cc_read_file", { path: full }).catch(() => null);
      if (text) {
        setExists(true);
        const lines = text.split("\n");
        setLineCount(lines.length);
        const s = startLine ?? 1;
        const e = endLine ?? lines.length;
        const sliced = lines.slice(Math.max(0, s - 1), e).join("\n");
        setContent(sliced.slice(0, 1000));
      }
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, [cwd]);

  const hide = useCallback(() => {
    setVisible(false);
    setContent(null);
  }, []);

  return { visible, filePath, exists, content, lineCount, loading, resolve, hide };
}
