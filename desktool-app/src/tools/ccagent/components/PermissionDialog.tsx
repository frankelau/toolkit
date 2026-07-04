// 权限对话框组件 — Phase 2 + Sprint A (使用 useDialogCountdownTimeout)

import { useState, useEffect } from "react";
import { SAFE_TOOLS } from "../constants";
import { toolLabel, summarizeToolInput, buildDiffForTool } from "../utils";
import type { PermissionRequest } from "../types";
import { useDialogCountdownTimeout } from "../hooks";
import { DiffViewer } from "./MessageItem";
export function PermissionDialog({ request, onAllow, onDeny, sessionAlwaysAllow }: {
  request: PermissionRequest;
  onAllow: () => void;
  onDeny: () => void;
  sessionAlwaysAllow: Set<string>;
}) {
  const TIMEOUT_SECONDS = 60;
  const [selected, setSelected] = useState<0 | 1 | 2>(0); // 0=allow,1=always,2=deny

  const isSafe = SAFE_TOOLS.has(request.toolName);
  const summary = summarizeToolInput(request.toolName, request.input);
  const diff = buildDiffForTool(request.toolName, request.input);

  // Sprint A: 用通用倒计时 hook 替代手写 setInterval
  const { remainingSeconds: remaining, isTimeWarning } = useDialogCountdownTimeout({
    isOpen: true,
    requestKey: request.toolUseId,
    timeoutSeconds: TIMEOUT_SECONDS,
    onTimeout: onDeny,
  });

  // Keyboard: 1=allow, 2=allow always, 3=deny; Enter=confirm; arrows change selection
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "1") { setSelected(0); }
      else if (e.key === "2") { setSelected(1); }
      else if (e.key === "3") { setSelected(2); }
      else if (e.key === "ArrowLeft") setSelected(s => Math.max(0, s - 1) as 0 | 1 | 2);
      else if (e.key === "ArrowRight") setSelected(s => Math.min(2, s + 1) as 0 | 1 | 2);
      else if (e.key === "Enter") {
        if (selected === 0) onAllow();
        else if (selected === 1) { sessionAlwaysAllow.add(request.toolName); onAllow(); }
        else onDeny();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected, request.toolName, onAllow, onDeny, sessionAlwaysAllow]);

  const isWarning = isTimeWarning || remaining < 15;

  return (
    <div className="cc-perm-overlay">
      <div className="cc-perm-dialog">
        <div className="cc-perm-title">
          {isSafe ? "ℹ️ 工具调用" : "⚠️ 权限请求"}
          <span className={`cc-perm-countdown ${isWarning ? "cc-perm-countdown-warn" : ""}`}>{remaining}s</span>
        </div>
        <div className="cc-perm-tool">
          <span className="cc-perm-tool-name">{toolLabel(request.toolName)}</span>
          {summary && <span className="cc-perm-tool-summary">{summary}</span>}
        </div>
        <div className="cc-perm-input">
          <pre>{JSON.stringify(request.input, null, 2)}</pre>
        </div>
        {diff && <DiffViewer diff={diff} />}
        <div className="cc-perm-actions">
          <button
            className={`cc-perm-allow ${selected === 0 ? "cc-perm-selected" : ""}`}
            onClick={onAllow}
            onMouseEnter={() => setSelected(0)}
          >
            <span className="cc-perm-key">1</span> 允许
          </button>
          <button
            className={`cc-perm-allow-always ${selected === 1 ? "cc-perm-selected" : ""}`}
            onClick={() => { sessionAlwaysAllow.add(request.toolName); onAllow(); }}
            onMouseEnter={() => setSelected(1)}
          >
            <span className="cc-perm-key">2</span> 本次始终允许
          </button>
          <button
            className={`cc-perm-deny ${selected === 2 ? "cc-perm-selected" : ""}`}
            onClick={onDeny}
            onMouseEnter={() => setSelected(2)}
          >
            <span className="cc-perm-key">3</span> 拒绝
          </button>
        </div>
        <div className="cc-perm-hint">方向键切换 · Enter 确认</div>
      </div>
    </div>
  );
}
