// CustomModelDialog — 自定义模型对话框（对齐 cc-gui AddModelDialogWrapper）
import { useState } from "react";
import { toast } from "../../../../useCopyFeedback";

interface Props {
  isOpen: boolean;
  engine: "claude" | "codex";
  onClose: () => void;
  onAdd: (modelId: string, displayName: string, contextWindow?: number) => void;
}

const PRESETS = [
  { id: "claude-sonnet-4-20250514", name: "Claude Sonnet 4", ctx: 200000 },
  { id: "claude-opus-4-20250514", name: "Claude Opus 4", ctx: 200000 },
  { id: "gpt-4o", name: "GPT-4o", ctx: 128000 },
  { id: "gpt-4.1", name: "GPT-4.1", ctx: 1000000 },
  { id: "deepseek-v3", name: "DeepSeek V3", ctx: 128000 },
  { id: "qwen-max", name: "Qwen Max", ctx: 32768 },
];

export function CustomModelDialog({ isOpen, engine, onClose, onAdd }: Props) {
  const [modelId, setModelId] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [ctxWindow, setCtxWindow] = useState("200000");

  if (!isOpen) return null;

  const handleAdd = () => {
    if (!modelId.trim()) { toast("请输入模型 ID", "error"); return; }
    onAdd(modelId.trim(), displayName.trim() || modelId.trim(), Number(ctxWindow) || 200000);
    setModelId(""); setDisplayName(""); setCtxWindow("200000");
    toast(`已添加 ${displayName || modelId}`, "success");
    onClose();
  };

  const handlePreset = (p: typeof PRESETS[number]) => {
    setModelId(p.id);
    setDisplayName(p.name);
    setCtxWindow(String(p.ctx));
  };

  return (
    <div className="cc-modal-overlay" onClick={onClose}>
      <div className="cc-modal-dialog" onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}>
        <div className="cc-modal-header">
          <h3>🔧 添加自定义模型</h3>
          <button className="cc-modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="cc-modal-body">
          <div className="cc-setting-row">
            <label>引擎</label>
            <span style={{ padding: "4px 8px", borderRadius: 4, background: "rgba(255,255,255,0.06)" }}>
              {engine === "claude" ? "🧠 Claude" : "⚡ Codex"}
            </span>
          </div>
          <div className="cc-setting-row">
            <label>模型 ID *</label>
            <input value={modelId} onChange={e => setModelId(e.target.value)} placeholder="例如: gpt-4o" />
          </div>
          <div className="cc-setting-row">
            <label>显示名称</label>
            <input value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="默认使用 modelId" />
          </div>
          <div className="cc-setting-row">
            <label>上下文窗口</label>
            <input value={ctxWindow} onChange={e => setCtxWindow(e.target.value.replace(/\D/g, ""))} placeholder="200000" />
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>tokens</span>
          </div>

          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 6 }}>快捷预设:</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {PRESETS.map(p => (
                <button key={p.id} className="cc-preset-chip" onClick={() => handlePreset(p)}
                  style={{ padding: "3px 10px", borderRadius: 12, border: "1px solid var(--border)", background: "none", cursor: "pointer", fontSize: 12 }}>
                  {p.name}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="cc-modal-footer">
          <button className="cc-modal-cancel" onClick={onClose}>取消</button>
          <button className="cc-modal-confirm" onClick={handleAdd} disabled={!modelId.trim()}>添加</button>
        </div>
      </div>
    </div>
  );
}
