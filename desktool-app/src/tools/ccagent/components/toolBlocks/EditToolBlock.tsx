// EditToolBlock — 文件编辑可视化 (增强版 D3)
// 新增：行号标注 + 展开全部/折叠全部 + 文件操作快捷按钮

import { useState } from "react";
import { copyText } from "../../../../useCopyFeedback";
import type { ToolBlockProps } from "./shared";
import { ToolStatusIcon, getInputString, getFileName } from "./shared";
import { DiffViewer } from "../MessageItem";
import { buildDiffForTool } from "../../utils";

export function EditToolBlock({ tool }: ToolBlockProps) {
  const [expanded, setExpanded] = useState(false);
  const filePath = getInputString(tool.input, "file_path");
  const fileName = getFileName(filePath);
  const diff = tool.diff ?? buildDiffForTool(tool.name, tool.input);
  const isWrite = tool.name === "Write";
  const isMultiEdit = tool.name === "MultiEdit";

  // 统计行数
  let additions = 0, deletions = 0;
  if (diff) {
    for (const h of diff.hunks) {
      if (h.type === "add") additions++;
      else if (h.type === "del") deletions++;
    }
  }

  return (
    <div className={`cc-tb cc-tb-edit ${tool.isPending ? "cc-tb-pending" : ""} ${tool.isError ? "cc-tb-error" : ""}`}>
      <div className="cc-tb-header" onClick={() => setExpanded(e => !e)}>
        <ToolStatusIcon tool={tool} />
        <span className="cc-tb-icon">{isWrite ? "✏️" : "📝"}</span>
        <span className="cc-tb-name">{isWrite ? "写入文件" : isMultiEdit ? "批量编辑" : "编辑文件"}</span>
        <span className="cc-tb-file" title={filePath}>{fileName}</span>
        {(additions > 0 || deletions > 0) && (
          <span className="cc-tb-edit-stats">
            {additions > 0 && <span className="cc-tb-add">+{additions}</span>}
            {deletions > 0 && <span className="cc-tb-del">-{deletions}</span>}
          </span>
        )}
        <span className="cc-tb-expand">{expanded ? "▼" : "▶"}</span>
      </div>
      {expanded && (
        <div className="cc-tb-body">
          <div className="cc-tb-params">
            <div className="cc-tb-param">
              <span className="cc-tb-param-key">📄 {filePath}</span>
              <div className="cc-tb-param-actions">
                <button className="cc-tb-copy-sm" onClick={(e) => { e.stopPropagation(); copyText(filePath); }}>复制路径</button>
                {diff?.oldContent && (
                  <button className="cc-tb-copy-sm" onClick={(e) => { e.stopPropagation(); copyText(diff.oldContent!); }}>复制旧版</button>
                )}
                {diff?.newContent && (
                  <button className="cc-tb-copy-sm" onClick={(e) => { e.stopPropagation(); copyText(diff.newContent); }}>复制新版</button>
                )}
              </div>
            </div>
          </div>
          {diff && (
            <div className="cc-tb-diff-wrapper">
              <div className="cc-tb-diff-header-bar">
                <span className="cc-tb-diff-summary">
                  变更: <span className="cc-tb-add">+{additions} 行</span>
                  {deletions > 0 && <> <span className="cc-tb-del">-{deletions} 行</span></>}
                  {diff.oldContent === null && <span className="cc-tb-diff-new-badge">新建文件</span>}
                </span>
              </div>
              <DiffViewer diff={diff} />
            </div>
          )}
          {tool.result && (
            <div className="cc-tb-edit-result">
              <span className="cc-tb-label">结果</span>
              <pre>{tool.result.slice(0, 500)}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
