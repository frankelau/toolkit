// StatusPanel — 状态面板组件
// 对齐 cc-gui StatusPanel/StatusPanel.tsx
// Sprint O2: 拆分为目录，子组件独立文件

import { formatTokens } from "../../utils";
import type { StatusPanelProps } from "./types";
import { computeUsagePct, computeFileStats, computeSubagentStats } from "./utils";
import { TodoList } from "./TodoList";
import { SubagentList } from "./SubagentList";
import { FileChangesList } from "./FileChangesList";

export function StatusPanel({
  todos, subagents, fileChanges, isStreaming, activeTab, onTabClick,
  onClearFiles, onUndoFile, onDiscardAll, contextUsed, contextMax,
}: StatusPanelProps) {
  const completedTodos = todos.filter(t => t.status === "completed").length;
  const { completed: completedAgents, running: runningAgent } = computeSubagentStats(subagents);
  const inProgressTodo = todos.some(t => t.status === "in_progress");
  const { totalAdds, totalDels } = computeFileStats(fileChanges);
  const usagePct = computeUsagePct(contextUsed, contextMax);

  const hasData = todos.length > 0 || subagents.length > 0 || fileChanges.length > 0 || contextUsed > 0;
  if (!hasData) return null;

  return (
    <div className="cc-status-panel">
      {contextUsed > 0 && (
        <div className="cc-context-bar" title={`上下文用量: ${formatTokens(contextUsed)} / ${formatTokens(contextMax)}`}>
          <span className="cc-context-label">上下文</span>
          <div className="cc-context-track">
            <div
              className={`cc-context-fill ${usagePct > 80 ? "cc-context-warn" : ""} ${usagePct > 95 ? "cc-context-danger" : ""}`}
              style={{ width: `${usagePct}%` }}
            />
          </div>
          <span className="cc-context-pct">{usagePct}%</span>
        </div>
      )}

      <div className="cc-status-tabs">
        <button
          className={`cc-status-tab ${activeTab === "todo" ? "active" : ""}`}
          onClick={() => onTabClick("todo")}
          title="任务列表"
        >
          <span>☑</span>
          <span>任务</span>
          {todos.length > 0 && <span className="cc-status-badge">{completedTodos}/{todos.length}</span>}
          {isStreaming && inProgressTodo && <span className="cc-status-spin">↺</span>}
        </button>

        <button
          className={`cc-status-tab ${activeTab === "subagent" ? "active" : ""}`}
          onClick={() => onTabClick("subagent")}
          title="子 Agent"
        >
          <span>🤖</span>
          <span>子Agent</span>
          {subagents.length > 0 && <span className="cc-status-badge">{completedAgents}/{subagents.length}</span>}
          {isStreaming && runningAgent && <span className="cc-status-spin">↺</span>}
        </button>

        <button
          className={`cc-status-tab ${activeTab === "files" ? "active" : ""}`}
          onClick={() => onTabClick("files")}
          title="文件变更"
        >
          <span>✏</span>
          <span>编辑</span>
          {fileChanges.length > 0 && (
            <span className="cc-status-file-stats">
              <span className="cc-stat-add">+{totalAdds}</span>
              <span className="cc-stat-del">-{totalDels}</span>
            </span>
          )}
        </button>
      </div>

      {activeTab && (
        <div className="cc-status-popover">
          {activeTab === "todo" && <TodoList todos={todos} />}
          {activeTab === "subagent" && <SubagentList subagents={subagents} />}
          {activeTab === "files" && (
            <FileChangesList
              fileChanges={fileChanges}
              onClear={onClearFiles}
              onUndoFile={onUndoFile}
              onDiscardAll={onDiscardAll}
            />
          )}
        </div>
      )}
    </div>
  );
}

export default StatusPanel;
