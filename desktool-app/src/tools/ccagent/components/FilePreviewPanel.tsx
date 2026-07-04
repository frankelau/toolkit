// FilePreviewPanel — 文件预览弹窗
// 显示文件内容、支持代码高亮

import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";

interface FilePreviewPanelProps {
  filePath: string | null;
  onClose: () => void;
}

export function FilePreviewPanel({ filePath, onClose }: FilePreviewPanelProps) {
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!filePath) return;
    setLoading(true);
    setError("");
    invoke<string>("cc_read_file", { path: filePath })
      .then(setContent)
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false));
  }, [filePath]);

  if (!filePath) return null;

  const fileName = filePath.split("/").pop() || filePath;

  return (
    <div className="cc-fp-overlay" onClick={onClose}>
      <div className="cc-fp-modal" onClick={e => e.stopPropagation()}>
        <div className="cc-fp-header">
          <span className="cc-fp-title">📄 {fileName}</span>
          <span className="cc-fp-path">{filePath}</span>
          <button className="cc-fp-close" onClick={onClose}>×</button>
        </div>
        <div className="cc-fp-body">
          {loading && <div className="cc-fp-loading">⏳ 加载中...</div>}
          {error && <div className="cc-fp-error">❌ {error}</div>}
          {!loading && !error && (
            <pre className="cc-fp-code"><code>{content}</code></pre>
          )}
        </div>
      </div>
    </div>
  );
}

export default FilePreviewPanel;
