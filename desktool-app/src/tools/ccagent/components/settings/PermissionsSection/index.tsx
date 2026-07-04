// PermissionsSection — 权限配置（对齐 cc-gui PermissionsSection）
// Sprint D: 允许/禁止的工具列表

import { useState } from "react";

interface PermissionsSectionProps {
  allowedTools: string;
  setAllowedTools: (v: string) => void;
  disallowedTools: string;
  setDisallowedTools: (v: string) => void;
}

const TOOL_SUGGESTIONS = [
  "Bash", "Read", "Write", "Edit", "MultiEdit", "NotebookEdit",
  "WebFetch", "WebSearch", "Glob", "Grep", "LSP",
  "Task", "TaskCreate", "TaskUpdate", "TaskGet", "TaskList",
  "Agent", "Skill", "TodoWrite",
];

export function PermissionsSection(props: PermissionsSectionProps) {
  const [showAllowed, setShowAllowed] = useState(true);

  const allowedList = props.allowedTools.split(/\s+/).filter(Boolean);
  const disallowedList = props.disallowedTools.split(/\s+/).filter(Boolean);

  function toggleAllowed(tool: string) {
    const has = allowedList.includes(tool);
    const next = has ? allowedList.filter(t => t !== tool) : [...allowedList, tool];
    props.setAllowedTools(next.join(" "));
  }

  function toggleDisallowed(tool: string) {
    const has = disallowedList.includes(tool);
    const next = has ? disallowedList.filter(t => t !== tool) : [...disallowedList, tool];
    props.setDisallowedTools(next.join(" "));
  }

  return (
    <div className="cc-settings-block">
      <div className="cc-settings-block-title">🔒 权限配置</div>

      <div className="cc-perm-tabs">
        <button className={showAllowed ? "active" : ""} onClick={() => setShowAllowed(true)}>✅ 允许列表</button>
        <button className={!showAllowed ? "active" : ""} onClick={() => setShowAllowed(false)}>🚫 禁止列表</button>
      </div>

      {showAllowed ? (
        <div className="cc-perm-section">
          <div className="cc-setting-hint">只允许以下工具执行（空 = 允许所有）</div>
          <div className="cc-perm-tool-grid">
            {TOOL_SUGGESTIONS.map(tool => (
              <label key={tool} className={`cc-perm-tool-chip ${allowedList.includes(tool) ? "active" : ""}`}>
                <input
                  type="checkbox"
                  checked={allowedList.includes(tool)}
                  onChange={() => toggleAllowed(tool)}
                />
                <span>{tool}</span>
              </label>
            ))}
          </div>
          <div className="cc-setting-row">
            <label>自定义（空格分隔）</label>
            <input value={props.allowedTools} onChange={e => props.setAllowedTools(e.target.value)} />
          </div>
        </div>
      ) : (
        <div className="cc-perm-section">
          <div className="cc-setting-hint">禁止以下工具执行</div>
          <div className="cc-perm-tool-grid">
            {TOOL_SUGGESTIONS.map(tool => (
              <label key={tool} className={`cc-perm-tool-chip cc-perm-deny ${disallowedList.includes(tool) ? "active" : ""}`}>
                <input
                  type="checkbox"
                  checked={disallowedList.includes(tool)}
                  onChange={() => toggleDisallowed(tool)}
                />
                <span>{tool}</span>
              </label>
            ))}
          </div>
          <div className="cc-setting-row">
            <label>自定义（空格分隔）</label>
            <input value={props.disallowedTools} onChange={e => props.setDisallowedTools(e.target.value)} />
          </div>
        </div>
      )}
    </div>
  );
}
