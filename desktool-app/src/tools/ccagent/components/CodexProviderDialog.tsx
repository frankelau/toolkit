// CodexProviderDialog — Codex Provider 配置弹窗
// 对齐 cc-gui 的 CodexProviderDialog.tsx
// 用于添加/编辑 Codex Provider（config.toml + auth.json + 环境变量）

import { useLocale } from "../hooks/useLocale";
import { useState, useEffect } from "react";
import type { CodexProviderConfig, EnvVarEntry } from "../types";
import { validateEnvVarEntries, ENV_VAR_VALUE_MAX_LENGTH } from "../types";
import { uid } from "../constants";
import EnvVarEditor from "./EnvVarEditor";
import { CloseIcon, SaveIcon } from "./Icons";

const FORM_HEADER_STYLE: React.CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "center" };
const FORMAT_BUTTON_STYLE: React.CSSProperties = { padding: "4px 8px", fontSize: "12px" };
const CODE_TEXTAREA_STYLE: React.CSSProperties = {
  fontFamily: "var(--idea-editor-font-family, monospace)",
  fontSize: "12px",
  lineHeight: "1.5",
};
const FOOTER_ACTIONS_STYLE: React.CSSProperties = { marginLeft: "auto" };

const DEFAULT_CONFIG_TOML = `disable_response_storage = true
model = "gpt-5.1-codex"
model_reasoning_effort = "high"
model_provider = "crs"

[model_providers.crs]
base_url = "https://api.example.com/v1"
name = "crs"
requires_openai_auth = true
wire_api = "responses"`;

const DEFAULT_AUTH_JSON = `{
  "OPENAI_API_KEY": ""
}`;

interface CodexProviderDialogProps {
  isOpen: boolean;
  provider?: CodexProviderConfig | null;
  onClose: () => void;
  onSave: (provider: CodexProviderConfig) => void;
  addToast: (message: string, type: "success" | "error" | "info") => void;
}

export default function CodexProviderDialog({
  isOpen,
  provider,
  onClose,
  onSave,
  addToast,
}: CodexProviderDialogProps) {
  const { t } = useLocale();
  const isAdding = !provider;

  const [providerName, setProviderName] = useState("");
  const [configTomlJson, setConfigTomlJson] = useState("");
  const [authJson, setAuthJson] = useState("");
  const [messageEnvVars, setMessageEnvVars] = useState<EnvVarEntry[]>([]);
  const [mcpEnvVars, setMcpEnvVars] = useState<EnvVarEntry[]>([]);

  // 初始化表单
  useEffect(() => {
    if (isOpen) {
      if (provider) {
        setProviderName(provider.name || "");
        setConfigTomlJson(provider.configToml || "");
        setAuthJson(provider.authJson || "");
        setMessageEnvVars(provider.messageEnvVars || []);
        setMcpEnvVars(provider.mcpEnvVars || []);
      } else {
        setProviderName("");
        setConfigTomlJson(DEFAULT_CONFIG_TOML);
        setAuthJson(DEFAULT_AUTH_JSON);
        setMessageEnvVars([]);
        setMcpEnvVars([]);
      }
    }
  }, [isOpen, provider]);

  // 格式化 JSON
  const handleFormatConfigJson = () => {
    try {
      const parsed = JSON.parse(configTomlJson);
      setConfigTomlJson(JSON.stringify(parsed, null, 2));
      addToast("格式化成功", "success");
    } catch {
      addToast("格式化失败：不是有效的 JSON", "error");
    }
  };

  const handleFormatAuthJson = () => {
    try {
      const parsed = JSON.parse(authJson);
      setAuthJson(JSON.stringify(parsed, null, 2));
      addToast("格式化成功", "success");
    } catch {
      addToast("格式化失败：不是有效的 JSON", "error");
    }
  };

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

  const reportEnvVarIssue = (
    issue: { reason: string; key?: string },
    sectionLabel: string,
  ): boolean => {
    let msg = "";
    switch (issue.reason) {
      case "invalid": msg = `${sectionLabel}: 环境变量名 ${issue.key || ""} 格式无效`; break;
      case "protected": msg = `${sectionLabel}: 环境变量 ${issue.key || ""} 受保护，不可覆盖`; break;
      case "duplicate": msg = `${sectionLabel}: 环境变量 ${issue.key || ""} 重复`; break;
      case "value_too_long": msg = `${sectionLabel}: 环境变量值过长（上限 ${ENV_VAR_VALUE_MAX_LENGTH} 字符）`; break;
      default: return false;
    }
    addToast(msg, "error");
    return true;
  };

  const handleSave = () => {
    if (!providerName.trim()) {
      addToast("请填写 Provider 名称", "error");
      return;
    }
    // 校验 auth.json 格式
    if (authJson.trim()) {
      try {
        JSON.parse(authJson);
      } catch {
        addToast("auth.json 不是有效的 JSON", "error");
        return;
      }
    }
    // 校验环境变量
    const messageIssues = validateEnvVarEntries(messageEnvVars);
    if (messageIssues.length > 0) {
      reportEnvVarIssue(messageIssues[0], "消息环境变量");
      return;
    }
    const mcpIssues = validateEnvVarEntries(mcpEnvVars);
    if (mcpIssues.length > 0) {
      reportEnvVarIssue(mcpIssues[0], "MCP 环境变量");
      return;
    }

    const providerData: CodexProviderConfig = {
      id: provider?.id || uid(),
      name: providerName.trim(),
      createdAt: provider?.createdAt,
      configToml: configTomlJson.trim(),
      authJson: authJson.trim(),
      messageEnvVars: messageEnvVars.filter(e => e.key.trim() !== ""),
      mcpEnvVars: mcpEnvVars.filter(e => e.key.trim() !== ""),
    };
    onSave(providerData);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="cc-dialog-overlay">
      <div className="cc-dialog cc-provider-dialog cc-codex-provider-dialog">
        <div className="cc-dialog-header">
          <h3>{isAdding ? "添加 Codex Provider" : `编辑 Codex Provider：${provider?.name}`}</h3>
          <button className="cc-close-btn" onClick={onClose}><CloseIcon size={16} /></button>
        </div>

        <div className="cc-dialog-body">
          <p className="cc-dialog-desc">
            {isAdding ? "配置一个新的 Codex Provider" : "修改现有 Codex Provider 配置"}
          </p>

          {/* Provider 名称 */}
          <div className="cc-form-group">
            <label htmlFor="providerName">
              Provider 名称<span className="cc-required">*</span>
            </label>
            <input
              id="providerName"
              type="text"
              className="cc-form-input"
              placeholder={t("codexProvider.codexProvider.k11")}
              value={providerName}
              onChange={e => setProviderName(e.target.value)}
            />
          </div>

          {/* config.toml */}
          <div className="cc-form-group">
            <div style={FORM_HEADER_STYLE}>
              <label htmlFor="configTomlJson">
                config.toml <span className="cc-required">*</span>
              </label>
              <button
                type="button"
                className="cc-btn cc-btn-secondary cc-btn-sm"
                onClick={handleFormatConfigJson}
                style={FORMAT_BUTTON_STYLE}
              >
                格式化 JSON
              </button>
            </div>
            <textarea
              id="configTomlJson"
              className="cc-form-input cc-code-input"
              value={configTomlJson}
              onChange={e => setConfigTomlJson(e.target.value)}
              rows={15}
              style={CODE_TEXTAREA_STYLE}
            />
            <small className="cc-form-hint">{t("codexProvider.codexProvider.k2")}</small>
          </div>

          {/* auth.json */}
          <div className="cc-form-group">
            <div style={FORM_HEADER_STYLE}>
              <label htmlFor="authJson">auth.json</label>
              <button
                type="button"
                className="cc-btn cc-btn-secondary cc-btn-sm"
                onClick={handleFormatAuthJson}
                style={FORMAT_BUTTON_STYLE}
              >
                格式化 JSON
              </button>
            </div>
            <textarea
              id="authJson"
              className="cc-form-input cc-code-input"
              value={authJson}
              onChange={e => setAuthJson(e.target.value)}
              rows={6}
              style={CODE_TEXTAREA_STYLE}
            />
            <small className="cc-form-hint">{t("codexProvider.codexProvider.k4")}</small>
          </div>

          {/* 环境变量 */}
          <details className="cc-advanced-section">
            <summary className="cc-advanced-toggle">{t("codexProvider.codexProvider.k5")}</summary>

            <div className="cc-form-group" style={{ marginTop: "16px" }}>
              <label>{t("codexProvider.codexProvider.k6")}</label>
              <small className="cc-form-hint">{t("codexProvider.codexProvider.k7")}</small>
              <EnvVarEditor entries={messageEnvVars} onChange={setMessageEnvVars} />
            </div>

            <div className="cc-form-group">
              <label>{t("codexProvider.codexProvider.k8")}</label>
              <small className="cc-form-hint">{t("codexProvider.codexProvider.k9")}</small>
              <EnvVarEditor entries={mcpEnvVars} onChange={setMcpEnvVars} />
            </div>
          </details>
        </div>

        <div className="cc-dialog-footer">
          <div className="cc-footer-actions" style={FOOTER_ACTIONS_STYLE}>
            <button className="cc-btn cc-btn-secondary" onClick={onClose}>
              <CloseIcon size={14} />
              取消
            </button>
            <button className="cc-btn cc-btn-primary" onClick={handleSave} disabled={!providerName.trim()}>
              <SaveIcon size={14} />
              {isAdding ? "添加" : "保存"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
