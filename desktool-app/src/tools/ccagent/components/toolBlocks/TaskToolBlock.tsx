// 任务工具块 — TaskCreate/TaskUpdate/TaskList/TodoWrite 可视化

import { useState } from "react";
import type { ToolBlockProps } from "./shared";
import { ToolStatusIcon, getInputString, truncate } from "./shared";

export function TaskToolBlock({ tool }: ToolBlockProps) {
  const [expanded, setExpanded] = useState(false);
  const isTodoWrite = tool.name === "TodoWrite";
  const isCreate = tool.name === "TaskCreate";
  const isUpdate = tool.name === "TaskUpdate";

  const subject = getInputString(tool.input, "subject")
    || getInputString(tool.input, "content");
  const description = getInputString(tool.input, "description")
    || getInputString(tool.input, "activeForm");

  const output = tool.result ?? "";

  const icon = isTodoWrite ? "☑️" : "📋";
  const name = isTodoWrite ? "更新待办" : isCreate ? "创建任务" : isUpdate ? "更新任务" : "任务管理";

  return (
    <div className={`cc-tb cc-tb-task ${tool.isPending ? "cc-tb-pending" : ""} ${tool.isError ? "cc-tb-error" : ""}`}>
      <div className="cc-tb-header" onClick={() => setExpanded(e => !e)}>
        <ToolStatusIcon tool={tool} />
        <span className="cc-tb-icon">{icon}</span>
        <span className="cc-tb-name">{name}</span>
        {subject && <span className="cc-tb-desc">{subject.slice(0, 60)}</span>}
        <span className="cc-tb-expand">{expanded ? "▼" : "▶"}</span>
      </div>
      {expanded && (
        <div className="cc-tb-body">
          <div className="cc-tb-params">
            {subject && <div className="cc-tb-param"><span className="cc-tb-param-key">subject:</span> {subject}</div>}
            {description && <div className="cc-tb-param"><span className="cc-tb-param-key">description:</span> {description}</div>}
          </div>
          {output && (
            <div className="cc-tb-task-result">
              <pre>{truncate(output, 1000)}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
