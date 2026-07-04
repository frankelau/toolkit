// CodexProviderSection — Codex Provider 配置（对齐 cc-gui CodexProviderSection）
// Sprint D: Codex 专用 Provider 设置

interface CodexProviderSectionProps {
  codexApiKey: string;
  setCodexApiKey: (key: string) => void;
  codexBaseUrl: string;
  setCodexBaseUrl: (url: string) => void;
  codexModel: string;
  setCodexModel: (m: string) => void;
}

const CODEX_MODELS = [
  { value: "", label: "默认" },
  { value: "o3", label: "o3" },
  { value: "o4-mini", label: "o4-mini" },
  { value: "gpt-4.1", label: "GPT-4.1" },
  { value: "gpt-4.1-mini", label: "GPT-4.1-mini" },
];

export function CodexProviderSection(props: CodexProviderSectionProps) {
  return (
    <div className="cc-settings-block">
      <div className="cc-settings-block-title">Codex Provider 配置</div>

      <div className="cc-setting-row">
        <label>模型</label>
        <select value={props.codexModel} onChange={e => props.setCodexModel(e.target.value)}>
          {CODEX_MODELS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
        </select>
      </div>

      <div className="cc-setting-row">
        <label>Base URL（可选）</label>
        <input
          value={props.codexBaseUrl}
          onChange={e => props.setCodexBaseUrl(e.target.value)}
          placeholder="https://api.openai.com/v1"
        />
      </div>

      <div className="cc-setting-row">
        <label>API Key</label>
        <input
          type="password"
          value={props.codexApiKey}
          onChange={e => props.setCodexApiKey(e.target.value)}
          placeholder="sk-..."
        />
      </div>

      <div className="cc-setting-hint">
        💡 Codex 默认使用 OpenAI 官方 API。如需使用代理，填入 Base URL 和 API Key。
      </div>
    </div>
  );
}
