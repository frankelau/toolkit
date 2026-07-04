// ContextPanel — 右侧上下文面板 (ccgui 风格)
// 显示当前会话上下文：已添加文件、会话信息、token 用量、subagent 状态

import type { FileChangeSummary, SubagentInfo, TodoItem, SelectedContext } from "../types";

interface ContextPanelProps {
  visible: boolean;
  onToggleVisibility: () => void;
  cwd: string;
  sessionId: string | null;
  model: string;
  engine: string;
  lastInputTokens: number;
  totalInput: number;
  totalOutput: number;
  totalCost: number;
  selectedContext: SelectedContext | null;
  onClearContext: () => void;
  fileChanges: FileChangeSummary[];
  subagents: SubagentInfo[];
  todos: TodoItem[];
  streaming: boolean;
}

export function ContextPanel({
  visible, onToggleVisibility,
  cwd, sessionId, model, engine,
  lastInputTokens, totalInput, totalOutput, totalCost,
  selectedContext, onClearContext,
  fileChanges, subagents, todos, streaming,
}: ContextPanelProps) {
  if (!visible) {
    return (
      <button className="cc-cp-toggle-btn" onClick={onToggleVisibility} title="显示上下文面板">
        📋
      </button>
    );
  }

  const contextMax = model.includes("[1m]") ? 1_000_000 : 200_000;
  const usagePct = contextMax > 0 ? Math.min(100, (lastInputTokens / contextMax) * 100) : 0;

  return (
    <div className="cc-cp-panel">
      {/* 头部 */}
      <div className="cc-cp-header">
        <span className="cc-cp-title">上下文</span>
        <button className="cc-ft-collapse" onClick={onToggleVisibility} title="收起">▶</button>
      </div>

      {/* 会话信息 */}
      <div className="cc-cp-section">
        <div className="cc-cp-section-title">会话</div>
        <div className="cc-cp-row">
          <span className="cc-cp-label">项目</span>
          <span className="cc-cp-value" title={cwd}>{cwd.split("/").filter(Boolean).pop() || cwd}</span>
        </div>
        <div className="cc-cp-row">
          <span className="cc-cp-label">引擎</span>
          <span className="cc-cp-value">{engine === "claude" ? "Claude Code" : "Codex CLI"}</span>
        </div>
        <div className="cc-cp-row">
          <span className="cc-cp-label">模型</span>
          <span className="cc-cp-value">{model || "默认"}</span>
        </div>
        {sessionId && (
          <div className="cc-cp-row">
            <span className="cc-cp-label">会话 ID</span>
            <span className="cc-cp-value cc-cp-mono" title={sessionId}>{sessionId.slice(0, 12)}...</span>
          </div>
        )}
      </div>

      {/* Token 用量 */}
      <div className="cc-cp-section">
        <div className="cc-cp-section-title">用量</div>
        <div className="cc-cp-usage-meter">
          <div className="cc-cp-usage-fill" style={{ width: `${usagePct}%` }} />
        </div>
        <div className="cc-cp-row">
          <span className="cc-cp-label">当前上下文</span>
          <span className="cc-cp-value">{lastInputTokens.toLocaleString()} / {(contextMax / 1000).toFixed(0)}K</span>
        </div>
        <div className="cc-cp-row">
          <span className="cc-cp-label">累计输入</span>
          <span className="cc-cp-value">{totalInput.toLocaleString()}</span>
        </div>
        <div className="cc-cp-row">
          <span className="cc-cp-label">累计输出</span>
          <span className="cc-cp-value">{totalOutput.toLocaleString()}</span>
        </div>
        {totalCost > 0 && (
          <div className="cc-cp-row">
            <span className="cc-cp-label">费用</span>
            <span className="cc-cp-value">${totalCost.toFixed(4)}</span>
          </div>
        )}
      </div>

      {/* 当前上下文文件 */}
      <div className="cc-cp-section">
        <div className="cc-cp-section-title">上下文文件</div>
        {selectedContext ? (
          <div className="cc-cp-context-item">
            <span className="cc-cp-file-icon">📄</span>
            <span className="cc-cp-file-name" title={selectedContext.filePath}>
              {selectedContext.filePath.split("/").pop()}
            </span>
            <button className="cc-cp-remove" onClick={onClearContext} title="移除">×</button>
          </div>
        ) : (
          <div className="cc-cp-empty-hint">点击文件树中的文件来添加上下文</div>
        )}
      </div>

      {/* 文件变更摘要 */}
      {fileChanges.length > 0 && (
        <div className="cc-cp-section">
          <div className="cc-cp-section-title">文件变更 ({fileChanges.length})</div>
          <div className="cc-cp-scroll">
            {fileChanges.map((fc, i) => (
              <div key={i} className="cc-cp-file-change">
                <span className={`cc-cp-change-type ${fc.status === 'A' ? 'create' : 'modify'}`}>
                  {fc.status === "A" ? "＋" : "～"}
                </span>
                <span className="cc-cp-change-path" title={fc.filePath}>
                  {fc.fileName}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Subagents */}
      {subagents.length > 0 && (
        <div className="cc-cp-section">
          <div className="cc-cp-section-title">子 Agent ({subagents.length})</div>
          <div className="cc-cp-scroll">
            {subagents.map((sa, i) => (
              <div key={i} className="cc-cp-subagent">
                <span className={`cc-cp-sa-dot ${sa.status}`} />
                <span className="cc-cp-sa-name">{sa.description || `Agent #${i + 1}`}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Todos */}
      {todos.length > 0 && (
        <div className="cc-cp-section">
          <div className="cc-cp-section-title">任务 ({todos.length})</div>
          <div className="cc-cp-scroll">
            {todos.map((td, i) => (
              <div key={i} className="cc-cp-todo">
                <span className={`cc-cp-todo-check ${td.status}`}>
                  {td.status === "completed" ? "✓" : td.status === "in_progress" ? "●" : "○"}
                </span>
                <span className="cc-cp-todo-text">{td.content}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 状态指示 */}
      {streaming && (
        <div className="cc-cp-status cc-cp-status-streaming">● 流式输出中</div>
      )}
    </div>
  );
}

export default ContextPanel;
