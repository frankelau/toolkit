// 计划审批弹窗 — Phase 8
// Claude 在 plan 模式下完成规划后弹出，让用户选择执行模式并批准

import { useState, useEffect, useCallback, useRef } from "react";
import { renderMd } from "../../utils";

export interface PlanApprovalRequest {
  requestId: string;
  toolName: string;
  plan?: string;
  allowedPrompts?: { tool: string; prompt: string }[];
  timestamp?: string;
}

interface PlanApprovalDialogProps {
  request: PlanApprovalRequest | null;
  onApprove: (requestId: string, targetMode: string) => void;
  onReject: (requestId: string) => void;
  timeoutSeconds?: number;
}

const EXECUTION_MODES = [
  { id: "default", label: "默认", description: "交互式审批每个工具调用" },
  { id: "acceptEdits", label: "自动接受编辑", description: "自动允许文件编辑类工具" },
  { id: "bypassPermissions", label: "跳过所有权限", description: "全部自动允许（最激进）" },
];

export function PlanApprovalDialog({
  request,
  onApprove,
  onReject,
  timeoutSeconds = 120,
}: PlanApprovalDialogProps) {
  const [selectedMode, setSelectedMode] = useState("default");
  const [remaining, setRemaining] = useState(timeoutSeconds);
  const [collapsed, setCollapsed] = useState(false);
  const startRef = useRef(Date.now());

  // Reset on new request
  useEffect(() => {
    if (request) {
      setSelectedMode("default");
      setCollapsed(false);
      setRemaining(timeoutSeconds);
      startRef.current = Date.now();
    }
  }, [request?.requestId, timeoutSeconds]);

  // Countdown
  useEffect(() => {
    if (!request) return;
    const id = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startRef.current) / 1000);
      const r = Math.max(0, timeoutSeconds - elapsed);
      setRemaining(r);
      if (r === 0) onReject(request.requestId);
    }, 500);
    return () => clearInterval(id);
  }, [request, timeoutSeconds, onReject]);

  // Keyboard
  const handleApprove = useCallback(() => {
    if (request) onApprove(request.requestId, selectedMode);
  }, [request, selectedMode, onApprove]);
  const handleReject = useCallback(() => {
    if (request) onReject(request.requestId);
  }, [request, onReject]);

  useEffect(() => {
    if (!request) return;
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      if (e.key === "Escape") handleReject();
      else if (e.key === "Enter" && !collapsed) handleApprove();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [request, collapsed, handleApprove, handleReject]);

  if (!request) return null;

  const isWarning = remaining < 15;
  const mm = String(Math.floor(remaining / 60)).padStart(2, "0");
  const ss = String(remaining % 60).padStart(2, "0");

  if (collapsed) {
    return (
      <div className="cc-perm-overlay">
        <div className="cc-plan-collapsed">
          <span className="cc-plan-collapsed-title">📋 计划已准备就绪</span>
          <span className={`cc-perm-countdown ${isWarning ? "cc-perm-countdown-warn" : ""}`}>{mm}:{ss}</span>
          <button className="cc-plan-expand" onClick={() => setCollapsed(false)}>展开</button>
        </div>
      </div>
    );
  }

  return (
    <div className="cc-perm-overlay">
      <div className="cc-plan-dialog">
        <div className="cc-perm-title">
          <span>📋 计划已准备就绪</span>
          <span className={`cc-perm-countdown ${isWarning ? "cc-perm-countdown-warn" : ""}`}>{mm}:{ss}</span>
          <button className="cc-plan-collapse-btn" onClick={() => setCollapsed(true)} title="收起">▼</button>
        </div>
        <div className="cc-plan-subtitle">Claude 已完成规划，准备执行。请选择执行模式并批准。</div>

        {request.plan && (
          <div className="cc-plan-content" dangerouslySetInnerHTML={{ __html: renderMd(request.plan) }} />
        )}

        {request.allowedPrompts && request.allowedPrompts.length > 0 && (
          <div className="cc-plan-prompts">
            <div className="cc-plan-prompts-title">需要额外授权的命令：</div>
            <ul>
              {request.allowedPrompts.map((p, i) => (
                <li key={i}><code>{p.tool}</code>: <code>{p.prompt}</code></li>
              ))}
            </ul>
          </div>
        )}

        <div className="cc-plan-mode-section">
          <div className="cc-plan-mode-header">执行模式</div>
          <div className="cc-plan-mode-options">
            {EXECUTION_MODES.map(m => (
              <button
                key={m.id}
                className={`cc-plan-mode-option ${selectedMode === m.id ? "selected" : ""}`}
                onClick={() => setSelectedMode(m.id)}
              >
                <span className="cc-plan-mode-radio">{selectedMode === m.id ? "●" : "○"}</span>
                <span className="cc-plan-mode-content">
                  <span className="cc-plan-mode-label">{m.label}</span>
                  <span className="cc-plan-mode-desc">{m.description}</span>
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="cc-perm-actions">
          <button className="cc-perm-deny cc-perm-selected" onClick={handleReject}>拒绝 (Esc)</button>
          <button className="cc-perm-allow" onClick={handleApprove}>批准并执行 (Enter)</button>
        </div>
      </div>
    </div>
  );
}
