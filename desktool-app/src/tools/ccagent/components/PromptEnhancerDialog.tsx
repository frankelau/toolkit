// PromptEnhancerDialog — 需求文档明确点名："提示词增强"
// 对齐 cc-gui 的 ChatInputBox/PromptEnhancerDialog
// 用当前引擎对用户输入的 prompt 做 AI 增强，用户可选择使用增强后的版本

import { useEffect, useCallback } from "react";

interface PromptEnhancerDialogProps {
  isOpen: boolean;
  isLoading: boolean;
  originalPrompt: string;
  enhancedPrompt: string;
  onUseEnhanced: () => void;
  onKeepOriginal: () => void;
  onClose: () => void;
}

export function PromptEnhancerDialog({
  isOpen, isLoading, originalPrompt, enhancedPrompt,
  onUseEnhanced, onKeepOriginal, onClose,
}: PromptEnhancerDialogProps) {
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape") {
      onClose();
    } else if (e.key === "Enter" && !isLoading && enhancedPrompt) {
      e.preventDefault();
      onUseEnhanced();
    }
  }, [onClose, onUseEnhanced, isLoading, enhancedPrompt]);

  useEffect(() => {
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  return (
    <div className="cc-pe-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="cc-pe-dialog" onClick={e => e.stopPropagation()}>
        <div className="cc-pe-header">
          <div className="cc-pe-title">
            <span>✨</span>
            <h3>提示词增强</h3>
          </div>
          <button className="cc-pe-close" onClick={onClose}>×</button>
        </div>

        <div className="cc-pe-content">
          <div className="cc-pe-section">
            <div className="cc-pe-section-header">
              <span>✏️</span>
              <span>原始提示词</span>
            </div>
            <div className="cc-pe-text cc-pe-original">{originalPrompt}</div>
          </div>

          <div className="cc-pe-section">
            <div className="cc-pe-section-header">
              <span>✨</span>
              <span>增强后提示词</span>
            </div>
            <div className="cc-pe-text cc-pe-enhanced">
              {isLoading ? (
                <div className="cc-pe-loading">
                  <span className="cc-pe-spinner">⟳</span>
                  <span>正在增强…</span>
                </div>
              ) : (
                enhancedPrompt || "等待增强结果…"
              )}
            </div>
          </div>
        </div>

        <div className="cc-pe-footer">
          <button className="cc-pe-btn cc-pe-secondary" onClick={onKeepOriginal} disabled={isLoading}>
            保留原始
          </button>
          <button className="cc-pe-btn cc-pe-primary" onClick={onUseEnhanced} disabled={isLoading || !enhancedPrompt}>
            使用增强版
          </button>
        </div>
      </div>
    </div>
  );
}
