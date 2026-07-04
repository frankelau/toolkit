// TaskExecutionBlock — 子Agent任务执行可视化

import { memo, useState } from "react";

interface TaskExecutionBlockProps {
  name?: string;
  input?: Record<string, unknown>;
  result?: string;
  toolId?: string;
  isStreaming?: boolean;
}

type SpawnAgentMeta = {
  agentId?: string;
  nickname?: string;
  model?: string;
  reasoningEffort?: string;
};

function parseMeta(input: Record<string, unknown>, resultText?: string): SpawnAgentMeta {
  let parsed: Record<string, unknown> | null = null;
  if (resultText && (resultText.startsWith("{") || resultText.startsWith("["))) {
    try {
      const c = JSON.parse(resultText);
      if (c && typeof c === "object" && !Array.isArray(c)) parsed = c;
    } catch { /* ignore */ }
  }
  const getStr = (...vals: unknown[]): string | undefined => {
    for (const v of vals) if (typeof v === "string" && v.trim()) return v.trim();
    return undefined;
  };
  return {
    agentId: getStr(parsed?.agent_id, parsed?.agentId, input?.agent) ?? resultText?.match(/\b([0-9a-f]{8}-[0-9a-f-]{27})\b/i)?.[1],
    nickname: getStr(parsed?.nickname, parsed?.name, input?.nickname, input?.name),
    model: getStr(parsed?.model, input?.model),
    reasoningEffort: getStr(parsed?.reasoning_effort, parsed?.reasoningEffort),
  };
}

const TaskExecutionBlock = memo(function TaskExecutionBlock({
  name, input = {}, result, isStreaming,
}: TaskExecutionBlockProps) {
  const [expanded, setExpanded] = useState(false);
  const meta = parseMeta(input, result);

  return (
    <div className={`cc-tb-task ${isStreaming ? "cc-tb-streaming" : ""}`}>
      <div className="cc-tb-task-header" onClick={() => setExpanded(e => !e)}>
        <span className="cc-tb-task-icon">{isStreaming ? "⏳" : "🤖"}</span>
        <span className="cc-tb-task-name">{meta.nickname || name || "Task"}</span>
        <span className="cc-tb-task-status">{isStreaming ? "执行中…" : "已完成"}</span>
        {meta.model && <span className="cc-tb-task-model">{meta.model}</span>}
        <span className="cc-tb-task-chevron">{expanded ? "▼" : "▶"}</span>
      </div>
      {expanded && (
        <div className="cc-tb-task-body">
          {meta.agentId && <div className="cc-tb-task-field"><span className="cc-tb-task-label">Agent ID</span><code className="cc-tb-task-code">{meta.agentId}</code></div>}
          {meta.nickname && <div className="cc-tb-task-field"><span className="cc-tb-task-label">名称</span><span>{meta.nickname}</span></div>}
          {meta.reasoningEffort && <div className="cc-tb-task-field"><span className="cc-tb-task-label">推理</span><span>{meta.reasoningEffort}</span></div>}
          {meta.model && <div className="cc-tb-task-field"><span className="cc-tb-task-label">模型</span><span>{meta.model}</span></div>}
          {Object.keys(input).length > 0 && (
            <details className="cc-tb-task-details"><summary className="cc-tb-task-label">参数</summary>
              <pre className="cc-tb-task-pre">{JSON.stringify(input, null, 2)}</pre></details>
          )}
          {result && (
            <details className="cc-tb-task-details" open={!!isStreaming}><summary className="cc-tb-task-label">输出</summary>
              <pre className="cc-tb-task-pre">{result.length > 2000 ? result.slice(0, 2000) + "\n…" : result}</pre></details>
          )}
        </div>
      )}
    </div>
  );
});

export { TaskExecutionBlock };
export type { TaskExecutionBlockProps };
export default TaskExecutionBlock;
