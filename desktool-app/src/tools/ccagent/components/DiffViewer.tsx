// DiffViewer.tsx — 代码差异查看器
// 新功能：左右分栏显示 old/new 代码差异，行号 + 高亮差异行 + 滚动同步
// 对齐 cc-gui 的 EditToolBlock diff 视图

import { useMemo, useRef, useCallback, useState } from "react";
import "./DiffViewer.css";

interface DiffViewerProps {
  oldText: string;
  newText: string;
  fileName?: string;
  language?: string;
  /** 是否默认折叠（摘要模式），null=不折叠 */
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

interface DiffLine {
  type: "same" | "added" | "removed" | "modified";
  oldLineNum?: number;
  newLineNum?: number;
  content: string;
  oldContent?: string; // for modified lines
}

/** 按行计算 diff（基于 LCS） */
function computeLineDiff(oldText: string, newText: string): DiffLine[] {
  const oldLines = oldText.split("\n");
  const newLines = newText.split("\n");

  // 简单的行级 diff：用 Map 匹配相同内容的行
  const result: DiffLine[] = [];
  let oi = 0;
  let ni = 0;

  while (oi < oldLines.length || ni < newLines.length) {
    const ol = oi < oldLines.length ? oldLines[oi] : undefined;
    const nl = ni < newLines.length ? newLines[ni] : undefined;

    if (ol === undefined) {
      result.push({ type: "added", newLineNum: ni + 1, content: nl! });
      ni++;
    } else if (nl === undefined) {
      result.push({ type: "removed", oldLineNum: oi + 1, content: ol });
      oi++;
    } else if (ol === nl) {
      result.push({ type: "same", oldLineNum: oi + 1, newLineNum: ni + 1, content: ol });
      oi++;
      ni++;
    } else {
      // 检查前面是否有匹配
      const matchOld = newLines.slice(ni).findIndex((l) => l === ol);
      const matchNew = oldLines.slice(oi).findIndex((l) => l === nl);

      if (matchOld === -1 || (matchNew !== -1 && matchNew <= matchOld)) {
        // old line removed
        result.push({ type: "removed", oldLineNum: oi + 1, content: ol });
        oi++;
      } else if (matchNew === -1 || matchOld < matchNew) {
        // new line added
        result.push({ type: "added", newLineNum: ni + 1, content: nl });
        ni++;
      } else {
        // both different, treat as modified pair
        result.push({ type: "removed", oldLineNum: oi + 1, content: ol });
        result.push({ type: "added", newLineNum: ni + 1, content: nl });
        oi++;
        ni++;
      }
    }
  }

  return result;
}

export default function DiffViewer({
  oldText,
  newText,
  fileName,
  collapsed,
  onToggleCollapse,
}: DiffViewerProps) {
  const oldScrollRef = useRef<HTMLDivElement>(null);
  const newScrollRef = useRef<HTMLDivElement>(null);
  const [isCollapsed, setIsCollapsed] = useState(collapsed ?? false);
  const [syncEnabled, setSyncEnabled] = useState(true);

  const diffLines = useMemo(() => computeLineDiff(oldText, newText), [oldText, newText]);

  const stats = useMemo(() => {
    const a = diffLines.filter((l) => l.type === "added").length;
    const r = diffLines.filter((l) => l.type === "removed").length;
    return { additions: a, removals: r };
  }, [diffLines]);

  // 滚动同步
  const handleScroll = useCallback(
    (source: "old" | "new") => {
      if (!syncEnabled) return;
      const src = source === "old" ? oldScrollRef.current : newScrollRef.current;
      const dst = source === "old" ? newScrollRef.current : oldScrollRef.current;
      if (src && dst) {
        dst.scrollTop = src.scrollTop;
      }
    },
    [syncEnabled],
  );

  const toggleCollapse = () => {
    setIsCollapsed((c) => !c);
    onToggleCollapse?.();
  };

  // 摘要栏（折叠时显示）
  if (isCollapsed) {
    return (
      <div className="dv-collapsed" onClick={toggleCollapse}>
        <span className="dv-collapsed-icon">📄</span>
        <span className="dv-collapsed-name">{fileName || "file"}</span>
        <span className="dv-collapsed-stats">
          <span className="dv-stat-add">+{stats.additions}</span>
          <span className="dv-stat-del">-{stats.removals}</span>
        </span>
        <span className="dv-collapsed-hint">点击展开查看差异 ▶</span>
      </div>
    );
  }

  return (
    <div className="dv-container">
      {/* 工具栏 */}
      <div className="dv-toolbar">
        <span className="dv-filename">{fileName || "diff"}</span>
        <span className="dv-stats">
          <span className="dv-stat-add">+{stats.additions}</span>
          <span className="dv-stat-del">-{stats.removals}</span>
        </span>
        <div className="dv-toolbar-actions">
          <button
            className={`dv-toolbar-btn ${syncEnabled ? "dv-active" : ""}`}
            onClick={() => setSyncEnabled((s) => !s)}
            title="滚动同步"
          >
            ⇅
          </button>
          <button className="dv-toolbar-btn" onClick={toggleCollapse} title="折叠">
            ▲
          </button>
        </div>
      </div>

      {/* 表头：旧 → 新 */}
      <div className="dv-header">
        <div className="dv-header-old">旧版本</div>
        <div className="dv-header-new">新版本</div>
      </div>

      {/* 差异内容 */}
      <div
        className="dv-content"
        onScroll={() => handleScroll("old")}
        ref={oldScrollRef}
      >
        {diffLines.map((line, i) => {
          const lineClass = `dv-line dv-line-${line.type}`;
          return (
            <div key={i} className={lineClass}>
              <div className="dv-gutter dv-gutter-old">
                {line.oldLineNum ?? ""}
              </div>
              <div className="dv-code dv-code-old">
                {line.type === "removed" || line.type === "same" ? (
                  <span className="dv-code-text">{line.content || " "}</span>
                ) : (
                  <span className="dv-code-empty"></span>
                )}
              </div>
              <div className="dv-gutter dv-gutter-new">
                {line.newLineNum ?? ""}
              </div>
              <div className="dv-code dv-code-new">
                {line.type === "added" || line.type === "same" ? (
                  <span className="dv-code-text">{line.content || " "}</span>
                ) : (
                  <span className="dv-code-empty"></span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
