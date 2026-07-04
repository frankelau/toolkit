// BasicConfigSection/EnvironmentTab.tsx — 环境设置 tab
// 对齐 cc-gui 的 BasicConfigSection/EnvironmentTab.tsx
// 包含：Node.js 路径、Claude CLI 路径、工作目录

import {
  SECTION_TITLE_STYLE, FORM_ROW_STYLE, LABEL_STYLE, VALUE_CONTAINER_STYLE,
  DESCRIPTION_STYLE, INPUT_STYLE, BUTTON_STYLE,
} from "../shared";

interface EnvironmentTabProps {
  nodePath: string;
  onNodePathChange: (path: string) => void;
  onSaveNodePath: () => void;
  savingNodePath: boolean;
  nodeVersion?: string | null;
  minNodeVersion?: number;
  claudeCliPath?: string;
  onClaudeCliPathChange?: (path: string) => void;
  onSaveClaudeCliPath?: () => void;
  savingClaudeCliPath?: boolean;
  workingDirectory?: string;
  onWorkingDirectoryChange?: (dir: string) => void;
  onSaveWorkingDirectory?: () => void;
  savingWorkingDirectory?: boolean;
}

export default function EnvironmentTab({
  nodePath,
  onNodePathChange,
  onSaveNodePath,
  savingNodePath,
  nodeVersion,
  minNodeVersion,
  claudeCliPath,
  onClaudeCliPathChange,
  onSaveClaudeCliPath,
  savingClaudeCliPath,
  workingDirectory,
  onWorkingDirectoryChange,
  onSaveWorkingDirectory,
  savingWorkingDirectory,
}: EnvironmentTabProps) {
  const nodeVersionOk = nodeVersion && minNodeVersion
    ? parseInt(nodeVersion.split(".")[0], 10) >= minNodeVersion
    : null;

  return (
    <div className="cc-settings-tab-content">
      <h4 style={SECTION_TITLE_STYLE}>环境</h4>

      {/* Node.js 路径 */}
      <div style={FORM_ROW_STYLE}>
        <label style={LABEL_STYLE}>Node.js 路径</label>
        <div style={VALUE_CONTAINER_STYLE}>
          <div style={{ display: "flex", gap: "8px" }}>
            <input
              type="text"
              style={INPUT_STYLE}
              value={nodePath}
              onChange={e => onNodePathChange(e.target.value)}
              placeholder="/usr/local/bin/node"
            />
            <button style={BUTTON_STYLE} onClick={onSaveNodePath} disabled={savingNodePath}>
              {savingNodePath ? "保存中..." : "保存"}
            </button>
          </div>
          {nodeVersion && (
            <div style={DESCRIPTION_STYLE}>
              当前版本：v{nodeVersion}
              {nodeVersionOk !== null && (
                <span style={{ marginLeft: "8px", color: nodeVersionOk ? "#89d185" : "#f48771" }}>
                  {nodeVersionOk ? "✓ 满足要求" : `✗ 需要 v${minNodeVersion}+`}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Claude CLI 路径 */}
      {claudeCliPath !== undefined && onClaudeCliPathChange && onSaveClaudeCliPath && (
        <div style={FORM_ROW_STYLE}>
          <label style={LABEL_STYLE}>Claude CLI 路径</label>
          <div style={VALUE_CONTAINER_STYLE}>
            <div style={{ display: "flex", gap: "8px" }}>
              <input
                type="text"
                style={INPUT_STYLE}
                value={claudeCliPath}
                onChange={e => onClaudeCliPathChange(e.target.value)}
                placeholder="/usr/local/bin/claude"
              />
              <button style={BUTTON_STYLE} onClick={onSaveClaudeCliPath} disabled={savingClaudeCliPath}>
                {savingClaudeCliPath ? "保存中..." : "保存"}
              </button>
            </div>
            <div style={DESCRIPTION_STYLE}>Claude Code CLI 可执行文件路径</div>
          </div>
        </div>
      )}

      {/* 工作目录 */}
      {workingDirectory !== undefined && onWorkingDirectoryChange && onSaveWorkingDirectory && (
        <div style={FORM_ROW_STYLE}>
          <label style={LABEL_STYLE}>工作目录</label>
          <div style={VALUE_CONTAINER_STYLE}>
            <div style={{ display: "flex", gap: "8px" }}>
              <input
                type="text"
                style={INPUT_STYLE}
                value={workingDirectory}
                onChange={e => onWorkingDirectoryChange(e.target.value)}
                placeholder="/Users/yourname/projects"
              />
              <button style={BUTTON_STYLE} onClick={onSaveWorkingDirectory} disabled={savingWorkingDirectory}>
                {savingWorkingDirectory ? "保存中..." : "保存"}
              </button>
            </div>
            <div style={DESCRIPTION_STYLE}>AI 工作的默认项目目录</div>
          </div>
        </div>
      )}
    </div>
  );
}
