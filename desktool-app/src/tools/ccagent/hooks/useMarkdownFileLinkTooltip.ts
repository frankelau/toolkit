// useMarkdownFileLinkTooltip — Markdown 文件链接提示
// 对齐 cc-gui useMarkdownFileLinkTooltip

import { useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";

export interface FileLinkTooltipState {
  visible: boolean;
  filePath: string;
  content: string | null;
  loading: boolean;
  onLinkHover: (filePath: string) => void;
  onLinkLeave: () => void;
}

export function useMarkdownFileLinkTooltip(cwd: string): FileLinkTooltipState {
  const [visible, setVisible] = useState(false);
  const [filePath, setFilePath] = useState("");
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onLinkHover = useCallback(async (path: string) => {
    setFilePath(path);
    setVisible(true);
    setLoading(true);
    setContent(null);
    try {
      const full = path.startsWith("/") ? path : `${cwd}/${path}`;
      const text = await invoke<string>("cc_read_file", { path: full }).catch(() => null);
      if (text) setContent(text.slice(0, 500));
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, [cwd]);

  const onLinkLeave = useCallback(() => {
    setVisible(false);
    setContent(null);
  }, []);

  return { visible, filePath, content, loading, onLinkHover, onLinkLeave };
}
