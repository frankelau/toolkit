// AgentDialog — Agent 详情对话框（独立弹窗版）
// 对齐 cc-gui 的 AgentDialog.tsx
// 与 AgentSection.tsx 的内联编辑器互补：此版本用于需要弹窗交互的场景

import { useState, useEffect } from "react";
import type { AgentConfig } from "../types";
import { CloseIcon, SaveIcon, ErrorIcon } from "./Icons";

const FOOTER_ACTIONS_STYLE: React.CSSProperties = { marginLeft: "auto" };

interface AgentDialogProps {
  isOpen: boolean;
  /** null 表示新建模式 */
  agent?: AgentConfig | null;
  onClose: () => void;
  onSave: (data: { name: string; prompt: string }) => void;
}

export default function AgentDialog({
  isOpen,
  agent,
  onClose,
  onSave,
}: AgentDialogProps) {
  const isAdding = !agent;

  const [name, setName] = useState("");
  const [prompt, setPrompt] = useState("");
  const [nameError, setNameError] = useState("");

  // 初始化表单
  useEffect(() => {
    if (isOpen) {
      if (agent) {
        setName(agent.name || "");
        setPrompt(agent.prompt || "");
      } else {
        setName("");
        setPrompt("");
      }
      setNameError("");
    }
  }, [isOpen, agent]);

  // Esc 关闭
  useEffect(() => {
    if (isOpen) {
      const handleEscape = (e: KeyboardEvent) => {
        if (e.key === "Escape") onClose();
      };
      window.addEventListener("keydown", handleEscape);
      return () => window.removeEventListener("keydown", handleEscape);
    }
  }, [isOpen, onClose]);

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value.length <= 20) {
      setName(value);
      setNameError("");
    }
  };

  const handlePromptChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    if (value.length <= 100000) {
      setPrompt(value);
    }
  };

  const handleSave = () => {
    if (!name.trim()) {
      setNameError("请填写 Agent 名称");
      return;
    }
    onSave({
      name: name.trim(),
      prompt: prompt.trim(),
    });
  };

  if (!isOpen) return null;

  return (
    <div className="cc-dialog-overlay">
      <div className="cc-dialog cc-agent-dialog">
        <div className="cc-dialog-header">
          <h3>{isAdding ? "新建 Agent" : "编辑 Agent"}</h3>
          <button className="cc-close-btn" onClick={onClose}><CloseIcon size={16} /></button>
        </div>

        <div className="cc-dialog-body">
          <div className="cc-form-group">
            <label htmlFor="agentName">
              名称<span className="cc-required">*</span>
            </label>
            <div className="cc-input-with-counter">
              <input
                id="agentName"
                type="text"
                className={`cc-form-input ${nameError ? "has-error" : ""}`}
                placeholder="如：代码审查员"
                value={name}
                onChange={handleNameChange}
                maxLength={20}
              />
              <span className="cc-char-counter">{name.length}/20</span>
            </div>
            {nameError && (
              <p className="cc-form-error">
                <ErrorIcon size={14} />
                {nameError}
              </p>
            )}
          </div>

          <div className="cc-form-group">
            <label htmlFor="agentPrompt">Prompt</label>
            <div className="cc-textarea-with-counter">
              <textarea
                id="agentPrompt"
                className="cc-form-textarea"
                placeholder="你是一个专业的代码审查员，请对用户提交的代码进行审查..."
                value={prompt}
                onChange={handlePromptChange}
                maxLength={100000}
                rows={8}
              />
              <span className="cc-char-counter">{prompt.length}/100000</span>
            </div>
            <small className="cc-form-hint">Agent 的系统 Prompt，@agent 调用时注入</small>
          </div>
        </div>

        <div className="cc-dialog-footer">
          <div className="cc-footer-actions" style={FOOTER_ACTIONS_STYLE}>
            <button className="cc-btn cc-btn-secondary" onClick={onClose}>
              <CloseIcon size={14} />
              取消
            </button>
            <button className="cc-btn cc-btn-primary" onClick={handleSave}>
              <SaveIcon size={14} />
              {isAdding ? "添加" : "保存"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
