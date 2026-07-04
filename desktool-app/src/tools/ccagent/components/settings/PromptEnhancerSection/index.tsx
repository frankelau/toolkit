// PromptEnhancerSection — 提示词增强设置（对齐 cc-gui PromptEnhancerSection）
// Sprint D: 配置增强用的 Provider 和模型

interface PromptEnhancerSectionProps {
  enabled: boolean;
  setEnabled: (v: boolean) => void;
  provider: string;
  setProvider: (p: string) => void;
  model: string;
  setModel: (m: string) => void;
}

const ENHANCER_MODELS = [
  { value: "haiku", label: "Haiku（快速，推荐）" },
  { value: "sonnet", label: "Sonnet（均衡）" },
  { value: "opus", label: "Opus（最强）" },
];

export function PromptEnhancerSection(props: PromptEnhancerSectionProps) {
  return (
    <div className="cc-settings-block">
      <div className="cc-settings-block-title">✨ 提示词增强</div>

      <div className="cc-setting-row">
        <label>启用</label>
        <label className="cc-toggle-switch">
          <input type="checkbox" checked={props.enabled} onChange={e => props.setEnabled(e.target.checked)} />
          <span className="cc-toggle-slider"></span>
          <span className="cc-toggle-label">{props.enabled ? "开启" : "关闭"}</span>
        </label>
      </div>

      {props.enabled && (
        <>
          <div className="cc-setting-row">
            <label>Provider</label>
            <select value={props.provider} onChange={e => props.setProvider(e.target.value)}>
              <option value="claude">Claude（使用当前 Claude Provider）</option>
              <option value="codex">Codex（使用当前 Codex）</option>
            </select>
          </div>

          <div className="cc-setting-row">
            <label>增强模型</label>
            <select value={props.model} onChange={e => props.setModel(e.target.value)}>
              {ENHANCER_MODELS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>

          <div className="cc-setting-hint">
            💡 提示词增强会用指定模型优化你的输入，使其更清晰、更结构化。推荐用 Haiku 以获得最快响应。
          </div>
        </>
      )}
    </div>
  );
}
