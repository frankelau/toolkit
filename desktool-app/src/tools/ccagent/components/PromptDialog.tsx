// PromptDialog — Prompt 模板编辑弹窗
// 对齐 cc-gui 的 PromptDialog.tsx
// 用于添加/编辑 Prompt 模板（名称 + 内容）

import { useState, useEffect } from "react";
import type { PromptTemplate } from "../types";
import { CloseIcon, SaveIcon, ErrorIcon } from "./Icons";

const FOOTER_ACTIONS_STYLE: React.CSSProperties = { marginLeft: "auto" };

interface PromptDialogProps {
  isOpen: boolean;
  /** null 表示新建模式 */
  prompt?: PromptTemplate | null;
  onClose: () => void;
  onSave: (data: { name: string; content: string }) => void;
}

export default function PromptDialog({
  isOpen,
  prompt,
  onClose,
  onSave,
}: PromptDialogProps) {
  const isAdding = !prompt;

  const [name, setName] = useState("");
  const [content, setContent] = useState("");
  const [nameError, setNameError] = useState("");

  // 初始化表单
  useEffect(() => {
    if (isOpen) {
      if (prompt) {
        setName(prompt.name || "");
        setContent(prompt.content || "");
      } else {
        setName("");
        setContent("");
      }
      setNameError("");
    }
  }, [isOpen, prompt]);

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
    if (value.length <= 30) {
      setName(value);
      setNameError("");
    }
  };

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    if (value.length <= 100000) {
      setContent(value);
    }
  };

  const handleSave = () => {
    if (!name.trim()) {
      setNameError("请填写模板名称");
      return;
    }
    onSave({
      name: name.trim(),
      content: content.trim(),
    });
  };

  if (!isOpen) return null;

  return (
    <div className="cc-dialog-overlay">
      <div className="cc-dialog cc-prompt-dialog">
        <div className="cc-dialog-header">
          <h3>{isAdding ? "新建 Prompt 模板" : "编辑 Prompt 模板"}</h3>
          <button className="cc-close-btn" onClick={onClose}><CloseIcon size={16} /></button>
        </div>

        <div className="cc-dialog-body">
          <div className="cc-form-group">
            <label htmlFor="promptName">
              名称<span className="cc-required">*</span>
            </label>
            <div className="cc-input-with-counter">
              <input
                id="promptName"
                type="text"
                className={`cc-form-input ${nameError ? "has-error" : ""}`}
                placeholder="如：代码审查 Prompt"
                value={name}
                onChange={handleNameChange}
                maxLength={30}
              />
              <span className="cc-char-counter">{name.length}/30</span>
            </div>
            {nameError && (
              <p className="cc-form-error">
                <ErrorIcon size={14} />
                {nameError}
              </p>
            )}
          </div>

          <div className="cc-form-group">
            <label htmlFor="promptContent">内容</label>
            <div className="cc-textarea-with-counter">
              <textarea
                id="promptContent"
                className="cc-form-textarea"
                placeholder="请对以下代码进行审查，关注..."
                value={content}
                onChange={handleContentChange}
                maxLength={100000}
                rows={10}
              />
              <span className="cc-char-counter">{content.length}/100000</span>
            </div>
            <small className="cc-form-hint">Prompt 模板内容，调用时插入到输入框</small>
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
