// ContextBar — 需求文档明确点名："文件选中"
// 对齐 cc-gui 的 ContextBar：显示当前选中文件/代码，发送时作为上下文附加到消息

import type { SelectedContext } from "../types";

interface ContextBarProps {
  context: SelectedContext | null;
  onClear: () => void;
  onPickFile: () => void;
}

export function ContextBar({ context, onClear, onPickFile }: ContextBarProps) {
  if (!context) {
    return (
      <div className="cc-ctx-bar cc-ctx-bar-empty">
        <button className="cc-ctx-pick-btn" onClick={onPickFile} title="选择文件作为上下文">
          📎 添加文件上下文
        </button>
      </div>
    );
  }

  const fileName = context.filePath.split("/").pop() || context.filePath;
  const range = context.startLine && context.endLine
    ? `:${context.startLine}-${context.endLine}`
    : "";

  return (
    <div className="cc-ctx-bar cc-ctx-bar-active">
      <span className="cc-ctx-icon">{context.type === "code" ? "📝" : "📄"}</span>
      <span className="cc-ctx-name" title={context.filePath}>{fileName}{range}</span>
      {context.code && (
        <span className="cc-ctx-preview" title={context.code}>
          {context.code.slice(0, 40)}{context.code.length > 40 ? "…" : ""}
        </span>
      )}
      <button className="cc-ctx-clear" onClick={onClear} title="移除上下文">×</button>
    </div>
  );
}
