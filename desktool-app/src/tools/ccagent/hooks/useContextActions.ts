// useContextActions — 上下文操作（选中文件/代码相关）
// 对齐 cc-gui useContextActions

import { useCallback, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { readFile } from "@tauri-apps/plugin-fs";
import type { SelectedContext } from "../types";

export interface ContextActions {
  selectedContext: SelectedContext | null;
  setSelectedContext: (c: SelectedContext | null) => void;
  pickContextFile: () => Promise<void>;
  clearContext: () => void;
}

const CODE_EXTENSIONS = ["ts", "tsx", "js", "jsx", "py", "java", "kt", "rs", "go", "rb", "php", "c", "cpp", "h", "css", "scss", "less", "html", "vue", "svelte", "json", "yaml", "yml", "toml", "xml", "md", "txt", "sh", "bash", "sql"];

export function useContextActions(): ContextActions {
  const [selectedContext, setSelectedContext] = useState<SelectedContext | null>(null);

  const pickContextFile = useCallback(async () => {
    const f = await open({
      multiple: false,
      filters: [{ name: "代码", extensions: CODE_EXTENSIONS }],
    });
    if (!f) return;
    const filePath = f as string;
    const fileName = filePath.split("/").pop() || filePath;
    try {
      const content = await readFile(filePath);
      const text = new TextDecoder().decode(content);
      const lineCount = text.split("\n").length;
      // 超过 200 行只取前 200 行作为代码上下文
      if (lineCount > 200) {
        const lines = text.split("\n").slice(0, 200);
        setSelectedContext({
          type: "code",
          filePath,
          code: lines.join("\n"),
          startLine: 1,
          endLine: 200,
        });
      } else {
        setSelectedContext({ type: "file", filePath });
      }
    } catch {
      setSelectedContext({ type: "file", filePath });
    }
    void fileName;
  }, []);

  const clearContext = useCallback(() => setSelectedContext(null), []);

  return { selectedContext, setSelectedContext, pickContextFile, clearContext };
}
