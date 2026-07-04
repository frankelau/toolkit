// CustomModelDialog/index.tsx — 自定义模型添加弹窗
// 对齐 cc-gui 的 CustomModelDialog/index.tsx
// 为 Provider 添加自定义模型 ID + 标签

import { useState, useEffect } from "react";
import { CloseIcon, SaveIcon, ErrorIcon } from "../../Icons";
import { uid } from "../../../constants";

export interface CustomModel {
  id: string;
  value: string;
  label: string;
  description?: string;
  contextWindow?: number;
}

interface CustomModelDialogProps {
  isOpen: boolean;
  /** null 表示新建模式 */
  model?: CustomModel | null;
  onClose: () => void;
  onSave: (model: CustomModel) => void;
  addToast?: (message: string, type: "success" | "error" | "info") => void;
}

export default function CustomModelDialog({
  isOpen,
  model,
  onClose,
  onSave,
  addToast,
}: CustomModelDialogProps) {
  const isAdding = !model;

  const [modelId, setModelId] = useState("");
  const [modelLabel, setModelLabel] = useState("");
  const [description, setDescription] = useState("");
  const [contextWindow, setContextWindow] = useState("");
  const [idError, setIdError] = useState("");

  useEffect(() => {
    if (isOpen) {
      if (model) {
        setModelId(model.value);
        setModelLabel(model.label);
        setDescription(model.description || "");
        setContextWindow(model.contextWindow?.toString() || "");
      } else {
        setModelId("");
        setModelLabel("");
        setDescription("");
        setContextWindow("");
      }
      setIdError("");
    }
  }, [isOpen, model]);

  useEffect(() => {
    if (!isOpen) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  const handleSave = () => {
    if (!modelId.trim()) {
      setIdError("请填写模型 ID");
      return;
    }
    if (!modelLabel.trim()) {
      addToast?.("请填写模型标签", "error");
      return;
    }
    const cw = contextWindow.trim() ? parseInt(contextWindow, 10) : undefined;
    if (cw !== undefined && (isNaN(cw) || cw <= 0)) {
      addToast?.("上下文窗口必须为正整数", "error");
      return;
    }
    onSave({
      id: model?.id || uid(),
      value: modelId.trim(),
      label: modelLabel.trim(),
      description: description.trim() || undefined,
      contextWindow: cw,
    });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="cc-dialog-overlay">
      <div className="cc-dialog" style={{ minWidth: "460px" }}>
        <div className="cc-dialog-header">
          <h3>{isAdding ? "添加自定义模型" : "编辑自定义模型"}</h3>
          <button className="cc-close-btn" onClick={onClose}><CloseIcon size={16} /></button>
        </div>

        <div className="cc-dialog-body">
          <div className="cc-form-group">
            <label htmlFor="modelId">
              模型 ID<span className="cc-required">*</span>
            </label>
            <input
              id="modelId"
              type="text"
              className={`cc-form-input ${idError ? "has-error" : ""}`}
              placeholder="如：claude-sonnet-4-5-20250514"
              value={modelId}
              onChange={e => { setModelId(e.target.value); setIdError(""); }}
            />
            {idError && (
              <p className="cc-form-error">
                <ErrorIcon size={14} />
                {idError}
              </p>
            )}
            <small className="cc-form-hint">API 调用时使用的模型标识符</small>
          </div>

          <div className="cc-form-group">
            <label htmlFor="modelLabel">
              显示标签<span className="cc-required">*</span>
            </label>
            <input
              id="modelLabel"
              type="text"
              className="cc-form-input"
              placeholder="如：Claude Sonnet 4.5"
              value={modelLabel}
              onChange={e => setModelLabel(e.target.value)}
            />
            <small className="cc-form-hint">在下拉列表中显示的名称</small>
          </div>

          <div className="cc-form-group">
            <label htmlFor="modelDesc">描述（可选）</label>
            <input
              id="modelDesc"
              type="text"
              className="cc-form-input"
              placeholder="模型简介"
              value={description}
              onChange={e => setDescription(e.target.value)}
            />
          </div>

          <div className="cc-form-group">
            <label htmlFor="contextWindow">上下文窗口（可选）</label>
            <input
              id="contextWindow"
              type="text"
              className="cc-form-input"
              placeholder="如：200000"
              value={contextWindow}
              onChange={e => setContextWindow(e.target.value)}
            />
            <small className="cc-form-hint">模型最大上下文 token 数</small>
          </div>
        </div>

        <div className="cc-dialog-footer">
          <div className="cc-footer-actions" style={{ marginLeft: "auto" }}>
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
