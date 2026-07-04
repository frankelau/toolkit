// SettingsView — 设置面板主视图（对齐 cc-gui settings/index.tsx）
// Sprint D: 侧边导航 + 内容区编排

import { useLocale } from "../../hooks/useLocale";
import { useState } from "react";
import { SettingsSidebar, type SettingsTab } from "./SettingsSidebar";
import { SettingsHeader } from "./SettingsHeader";
import { BasicConfigSection } from "./BasicConfigSection";
import { ProviderTabSection } from "./ProviderTabSection";
import { CodexProviderSection } from "./CodexProviderSection";
import { PromptEnhancerSection } from "./PromptEnhancerSection";
import { PermissionsSection } from "./PermissionsSection";
import { DependencySection } from "./DependencySection";
import { CommitSection } from "./CommitSection";
import { CommunitySection } from "./CommunitySection";
import { OtherSettingsSection } from "./OtherSettingsSection";
import { AgentSection } from "../AgentSection";
import { McpSettingsSection } from "../mcp/McpSettingsSection";
import type { Engine, EngineInfo, AgentConfig } from "../../types";

interface SettingsViewProps {
  onClose: () => void;
  // 基础配置
  engine: Engine;
  setEngine: (e: Engine) => void;
  engines: Record<Engine, EngineInfo | null>;
  model: string;
  setModel: (m: string) => void;
  effort: string;
  setEffort: (e: string) => void;
  permissionMode: string;
  setPermissionMode: (m: string) => void;
  streamingEnabled: boolean;
  setStreamingEnabled: (v: boolean) => void;
  thinkingEnabled: boolean;
  setThinkingEnabled: (v: boolean) => void;
  cwd: string;
  setCwd: (c: string) => void;
  // Provider
  providerId: string;
  setProviderId: (id: string) => void;
  providerBaseUrl: string;
  setProviderBaseUrl: (url: string) => void;
  providerApiKey: string;
  setProviderApiKey: (key: string) => void;
  // Codex Provider
  codexApiKey: string;
  setCodexApiKey: (k: string) => void;
  codexBaseUrl: string;
  setCodexBaseUrl: (u: string) => void;
  codexModel: string;
  setCodexModel: (m: string) => void;
  // Prompt
  systemPrompt: string;
  setSystemPrompt: (s: string) => void;
  // MCP
  mcpConfig: string;
  setMcpConfig: (s: string) => void;
  // 权限
  allowedTools: string;
  setAllowedTools: (s: string) => void;
  disallowedTools: string;
  setDisallowedTools: (s: string) => void;
  // Agent
  agents: AgentConfig[];
  setAgents: (fn: (prev: AgentConfig[]) => AgentConfig[]) => void;
  onUseAgent: (a: AgentConfig) => void;
  // 技能
  skills: { name: string; description: string; path: string }[];
  // PromptEnhancer
  peEnabled: boolean;
  setPeEnabled: (v: boolean) => void;
  peProvider: string;
  setPeProvider: (p: string) => void;
  peModel: string;
  setPeModel: (m: string) => void;
  // 使用统计
  totalCost: number;
  totalInput: number;
  totalOutput: number;
  sessionCount: number;
  onResetStats: () => void;
  // 其它
  sendShortcut: "enter" | "cmdEnter";
  setSendShortcut: (v: "enter" | "cmdEnter") => void;
  autoOpenFile: boolean;
  setAutoOpenFile: (v: boolean) => void;
  permissionDialogTimeout: number;
  setPermissionDialogTimeout: (v: number) => void;
  soundEnabled: boolean;
  setSoundEnabled: (v: boolean) => void;
  notificationEnabled: boolean;
  setNotificationEnabled: (v: boolean) => void;
  theme: "auto" | "light" | "dark";
  setTheme: (v: "auto" | "light" | "dark") => void;
  language: "zh" | "en";
  setLanguage: (v: "zh" | "en") => void;
  autoCommit: boolean;
  setAutoCommit: (v: boolean) => void;
  commitMessageTemplate: string;
  setCommitMessageTemplate: (v: string) => void;
}

export function SettingsView(props: SettingsViewProps) {
  const { t } = useLocale();
  const [activeTab, setActiveTab] = useState<SettingsTab>("basic");

  const tabLabels: Record<SettingsTab, string> = {
    basic: "基础配置",
    provider: "Claude Provider",
    codexProvider: "Codex Provider",
    promptEnhancer: "提示词增强",
    agent: "Agent 管理",
    prompt: "系统 Prompt",
    mcp: "MCP 服务器",
    skills: "技能管理",
    permissions: "权限配置",
    usage: "使用统计",
    dependency: "依赖检查",
    commit: "提交配置",
    community: "社区",
    other: "其它设置",
  };

  return (
    <div className="cc-settings-view">
      <SettingsHeader title={tabLabels[activeTab]} onClose={props.onClose} />
      <div className="cc-settings-body">
        <SettingsSidebar activeTab={activeTab} onTabChange={setActiveTab} />
        <div className="cc-settings-content">
          {activeTab === "basic" && (
            <BasicConfigSection
              engine={props.engine} setEngine={props.setEngine} engines={props.engines}
              model={props.model} setModel={props.setModel}
              effort={props.effort} setEffort={props.setEffort}
              permissionMode={props.permissionMode} setPermissionMode={props.setPermissionMode}
              streamingEnabled={props.streamingEnabled} setStreamingEnabled={props.setStreamingEnabled}
              thinkingEnabled={props.thinkingEnabled} setThinkingEnabled={props.setThinkingEnabled}
              sendShortcut={props.sendShortcut} setSendShortcut={props.setSendShortcut}
              autoOpenFile={props.autoOpenFile} setAutoOpenFile={props.setAutoOpenFile}
              permissionDialogTimeout={props.permissionDialogTimeout} setPermissionDialogTimeout={props.setPermissionDialogTimeout}
            />
          )}

          {activeTab === "provider" && (
            <ProviderTabSection
              providerId={props.providerId} setProviderId={props.setProviderId}
              providerBaseUrl={props.providerBaseUrl} setProviderBaseUrl={props.setProviderBaseUrl}
              providerApiKey={props.providerApiKey} setProviderApiKey={props.setProviderApiKey}
              model={props.model} setModel={props.setModel}
            />
          )}

          {activeTab === "codexProvider" && (
            <CodexProviderSection
              codexApiKey={props.codexApiKey} setCodexApiKey={props.setCodexApiKey}
              codexBaseUrl={props.codexBaseUrl} setCodexBaseUrl={props.setCodexBaseUrl}
              codexModel={props.codexModel} setCodexModel={props.setCodexModel}
            />
          )}

          {activeTab === "promptEnhancer" && (
            <PromptEnhancerSection
              enabled={props.peEnabled} setEnabled={props.setPeEnabled}
              provider={props.peProvider} setProvider={props.setPeProvider}
              model={props.peModel} setModel={props.setPeModel}
            />
          )}

          {activeTab === "agent" && (
            <div className="cc-settings-block">
              <AgentSection
                agents={props.agents}
                onAdd={(a) => { props.setAgents(prev => [...prev, a]); }}
                onUpdate={(a) => { props.setAgents(prev => prev.map(x => x.id === a.id ? a : x)); }}
                onDelete={(id) => { props.setAgents(prev => prev.filter(x => x.id !== id)); }}
                onUse={props.onUseAgent}
              />
            </div>
          )}

          {activeTab === "prompt" && (
            <div className="cc-settings-block">
              <div className="cc-settings-block-title">{t("settingsView.settingsView.k1")}</div>
              <div className="cc-setting-row cc-setting-row-stack">
                <label>{t("settingsView.settingsView.k2")}</label>
                <textarea
                  rows={8}
                  value={props.systemPrompt}
                  onChange={e => props.setSystemPrompt(e.target.value)}
                  placeholder={t("settingsView.settingsView.k13")}
                />
              </div>
              <div className="cc-setting-hint">
                💡 留空使用默认 prompt。输入的内容会追加到默认 prompt 后面。
              </div>
            </div>
          )}

          {activeTab === "mcp" && (
            <McpSettingsSection
              config={props.mcpConfig}
              onChange={props.setMcpConfig}
              isCodexMode={props.engine === "codex"}
            />
          )}

          {activeTab === "skills" && (
            <div className="cc-settings-block">
              <div className="cc-settings-block-title">{t("settingsView.settingsView.k4")}</div>
              {props.skills.length === 0 ? (
                <div className="cc-mcp-empty">
                  <div className="cc-mcp-empty-icon">🎭</div>
                  <div>{t("settingsView.settingsView.k5")}</div>
                  <div className="cc-mcp-empty-hint">{t("settingsView.settingsView.k6")}</div>
                </div>
              ) : (
                <div className="cc-skills-list">
                  {props.skills.map(s => (
                    <div key={s.name} className="cc-skill-item">
                      <span className="cc-skill-icon">🎭</span>
                      <div className="cc-skill-info">
                        <div className="cc-skill-name">{s.name}</div>
                        <div className="cc-skill-desc">{s.description}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === "permissions" && (
            <PermissionsSection
              allowedTools={props.allowedTools} setAllowedTools={props.setAllowedTools}
              disallowedTools={props.disallowedTools} setDisallowedTools={props.setDisallowedTools}
            />
          )}

          {activeTab === "usage" && (
            <div className="cc-settings-block">
              <div className="cc-settings-block-title">{t("settingsView.settingsView.k7")}</div>
              <div className="cc-usage-stat-grid">
                <div className="cc-usage-stat-item">
                  <div className="cc-usage-stat-label">{t("settingsView.settingsView.k8")}</div>
                  <div className="cc-usage-stat-value">${props.totalCost.toFixed(4)}</div>
                </div>
                <div className="cc-usage-stat-item">
                  <div className="cc-usage-stat-label">{t("settingsView.settingsView.k9")}</div>
                  <div className="cc-usage-stat-value">{props.totalInput.toLocaleString()}</div>
                </div>
                <div className="cc-usage-stat-item">
                  <div className="cc-usage-stat-label">{t("settingsView.settingsView.k10")}</div>
                  <div className="cc-usage-stat-value">{props.totalOutput.toLocaleString()}</div>
                </div>
                <div className="cc-usage-stat-item">
                  <div className="cc-usage-stat-label">{t("settingsView.settingsView.k11")}</div>
                  <div className="cc-usage-stat-value">{props.sessionCount}</div>
                </div>
              </div>
              <button className="cc-usage-reset" onClick={props.onResetStats}>{t("settingsView.settingsView.k12")}</button>
            </div>
          )}

          {activeTab === "dependency" && <DependencySection />}

          {activeTab === "commit" && (
            <CommitSection
              autoCommit={props.autoCommit} setAutoCommit={props.setAutoCommit}
              commitMessageTemplate={props.commitMessageTemplate} setCommitMessageTemplate={props.setCommitMessageTemplate}
              commitOnFileChange={false} setCommitOnFileChange={() => {}}
            />
          )}

          {activeTab === "community" && <CommunitySection />}

          {activeTab === "other" && (
            <OtherSettingsSection
              soundEnabled={props.soundEnabled} setSoundEnabled={props.setSoundEnabled}
              notificationEnabled={props.notificationEnabled} setNotificationEnabled={props.setNotificationEnabled}
              theme={props.theme} setTheme={props.setTheme}
              language={props.language} setLanguage={props.setLanguage}
              newSessionConfirm={false} setNewSessionConfirm={() => {}}
            />
          )}
        </div>
      </div>
    </div>
  );
}
