// 设置面板组件 — Phase 6

import { useState } from "react";
import { useLocale } from "../hooks/useLocale";
import { open } from "@tauri-apps/plugin-dialog";
import { toast } from "../../../useCopyFeedback";
import type { Engine, EngineInfo, SkillDef, FavoriteItem, AgentConfig } from "../types";
import { PROVIDER_PRESETS, MODELS, EFFORT_LEVELS, PERMISSION_MODES } from "../constants";
import { AgentSection } from "./AgentSection";

// ── MCP Config Editor ──────────────────────────────────────────────────────

const MCP_PRESETS = [
  { name: "filesystem", cmd: "npx", args: ["-y", "@modelcontextprotocol/server-filesystem", "."] },
  { name: "github", cmd: "npx", args: ["-y", "@modelcontextprotocol/server-github"] },
  { name: "fetch", cmd: "npx", args: ["-y", "@modelcontextprotocol/server-fetch"] },
];

export function McpConfigEditor({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { t } = useLocale();
  const [parseError, setParseError] = useState("");

  function addPreset(preset: typeof MCP_PRESETS[number]) {
    try {
      const cfg = value.trim() ? JSON.parse(value) : { mcpServers: {} };
      cfg.mcpServers = cfg.mcpServers || {};
      cfg.mcpServers[preset.name] = { command: preset.cmd, args: preset.args };
      onChange(JSON.stringify(cfg, null, 2));
      setParseError("");
    } catch { setParseError(t("chatScreen.jsonFormatErrorFix")); }
  }

  function onChangeRaw(raw: string) {
    onChange(raw);
    if (raw.trim()) {
      try { JSON.parse(raw); setParseError(""); }
      catch { setParseError(t("chatScreen.jsonFormatError")); }
    } else { setParseError(""); }
  }

  return (
    <div className="cc-mcp-editor">
      <div className="cc-mcp-presets">
        {MCP_PRESETS.map(p => (
          <button key={p.name} className="cc-mcp-preset-btn" onClick={() => addPreset(p)}>
            + {p.name}
          </button>
        ))}
      </div>
      <textarea
        className={`cc-mcp-textarea ${parseError ? "cc-mcp-error" : ""}`}
        rows={5}
        value={value}
        onChange={e => onChangeRaw(e.target.value)}
        placeholder={'{"mcpServers":{"my-server":{"command":"node","args":["path/to/server.js"]}}}'}
        spellCheck={false}
      />
      {parseError && <div className="cc-mcp-err-msg">{parseError}</div>}
    </div>
  );
}

// ── Settings Panel Props ───────────────────────────────────────────────────

export interface SettingsPanelProps {
  engine: Engine;
  setEngine: (e: Engine) => void;
  engines: Record<Engine, EngineInfo | null>;
  model: string;
  setModel: (m: string) => void;
  effort: string;
  setEffort: (e: string) => void;
  permissionMode: string;
  setPermissionMode: (m: string) => void;
  cwd: string;
  setCwd: (c: string) => void;
  systemPrompt: string;
  setSystemPrompt: (s: string) => void;
  mcpConfig: string;
  setMcpConfig: (s: string) => void;
  allowedTools: string;
  setAllowedTools: (s: string) => void;
  providerId: string;
  setProviderId: (id: string) => void;
  providerBaseUrl: string;
  setProviderBaseUrl: (url: string) => void;
  providerApiKey: string;
  setProviderApiKey: (key: string) => void;
  skills: SkillDef[];
  slashCommands: { cmd: string; desc: string }[];
  favorites: FavoriteItem[];
  setFavorites: (fn: (prev: FavoriteItem[]) => FavoriteItem[]) => void;
  onLoadFavorite: (msg: string) => void;
  onSlashCommand: (cmd: string) => void;
  // 需求补齐：流式开关 / 思考开关 / Agent 管理
  streamingEnabled: boolean;
  setStreamingEnabled: (v: boolean) => void;
  thinkingEnabled: boolean;
  setThinkingEnabled: (v: boolean) => void;
  agents: AgentConfig[];
  setAgents: (fn: (prev: AgentConfig[]) => AgentConfig[]) => void;
  onUseAgent: (agent: AgentConfig) => void;
}

// ── Settings Panel ─────────────────────────────────────────────────────────

export function SettingsPanel(props: SettingsPanelProps) {
  const {
    engine, setEngine, engines, model, setModel, effort, setEffort,
    permissionMode, setPermissionMode, cwd, setCwd, systemPrompt, setSystemPrompt,
    mcpConfig, setMcpConfig, allowedTools, setAllowedTools,
    providerId, setProviderId, providerBaseUrl, setProviderBaseUrl, providerApiKey, setProviderApiKey,
    skills, slashCommands, favorites, setFavorites, onLoadFavorite, onSlashCommand,
    streamingEnabled, setStreamingEnabled, thinkingEnabled, setThinkingEnabled,
    agents, setAgents, onUseAgent,
  } = props;

  const { t } = useLocale();

  return (
    <div className="cc-settings">
      {/* ── 引擎设置 ── */}
      <div className="cc-settings-section">
        <div className="cc-settings-title">{t("settingsPanel.k1")}</div>
        <div className="cc-setting-row">
          <label>{t("settingsPanel.k2")}</label>
          <select value={engine} onChange={e => setEngine(e.target.value as Engine)}>
            <option value="claude" disabled={!engines.claude}>Claude Code {engines.claude ? `(${engines.claude.version})` : `(${t("settingsPanel.engineNotInstalled")})`}</option>
            <option value="codex" disabled={!engines.codex}>Codex {engines.codex ? `(${engines.codex.version})` : `(${t("settingsPanel.engineNotInstalled")})`}</option>
          </select>
        </div>
        <div className="cc-setting-row">
          <label>{t("settingsPanel.k3")}</label>
          <select value={model} onChange={e => setModel(e.target.value)}>
            {(MODELS[engine] || []).map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
        </div>
        {engine === "claude" && (
          <>
            <div className="cc-setting-row">
              <label>{t("settingsPanel.k4")}</label>
              <select value={effort} onChange={e => setEffort(e.target.value)}>
                <option value="">{t("settingsPanel.k5")}</option>
                {EFFORT_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
            <div className="cc-setting-row">
              <label>{t("settingsPanel.k6")}</label>
              <select value={permissionMode} onChange={e => setPermissionMode(e.target.value)}>
                {PERMISSION_MODES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
            <div className="cc-setting-row">
              <label>{t("settingsPanel.k7")}</label>
              <select value={model.includes("[1m]") ? "1" : "0"} onChange={e => {
                if (e.target.value === "1" && !model.includes("[1m]")) setModel(model + "[1m]");
                else if (e.target.value === "0") setModel(model.replace("[1m]", ""));
              }}>
                <option value="0">{t("settingsPanel.k8")}</option>
                <option value="1">{t("settingsPanel.k9")}</option>
              </select>
            </div>
          </>
        )}
        {/* 需求补齐：流式开关 / 思考开关 */}
        <div className="cc-setting-row">
          <label>{t("settingsPanel.k10")}</label>
          <label className="cc-toggle-switch">
            <input type="checkbox" checked={streamingEnabled} onChange={e => setStreamingEnabled(e.target.checked)} />
            <span className="cc-toggle-slider"></span>
            <span className="cc-toggle-label">{streamingEnabled ? t("settingsPanel.streamingOn") : t("settingsPanel.streamingOff")}</span>
          </label>
        </div>
        {engine === "claude" && (
          <div className="cc-setting-row">
            <label>{t("settingsPanel.k11")}</label>
            <label className="cc-toggle-switch">
              <input type="checkbox" checked={thinkingEnabled} onChange={e => setThinkingEnabled(e.target.checked)} />
              <span className="cc-toggle-slider"></span>
              <span className="cc-toggle-label">{thinkingEnabled ? t("settingsPanel.thinkingAlways") : t("settingsPanel.thinkingOnDemand")}</span>
            </label>
          </div>
        )}
      </div>

      {/* ── Agent 管理（需求补齐） ── */}
      <div className="cc-settings-section">
        <AgentSection
          agents={agents}
          onAdd={(a) => { setAgents(prev => [...prev, a]); toast("Agent 已创建", "success"); }}
          onUpdate={(a) => { setAgents(prev => prev.map(x => x.id === a.id ? a : x)); toast("Agent 已更新", "success"); }}
          onDelete={(id) => { setAgents(prev => prev.filter(x => x.id !== id)); toast("Agent 已删除", "info"); }}
          onUse={onUseAgent}
        />
      </div>

      {/* ── 工作环境 ── */}
      <div className="cc-settings-section">
        <div className="cc-settings-title">{t("settingsPanel.k12")}</div>
        <div className="cc-setting-row">
          <label>{t("settingsPanel.k13")}</label>
          <input value={cwd} onChange={e => setCwd(e.target.value)} />
          <button onClick={async () => { const d = await open({ directory: true, multiple: false }); if (d) setCwd(d as string); }}>{t("settingsPanel.k14")}</button>
        </div>
        {engine === "claude" && (
          <>
            <div className="cc-setting-row">
              <label>{t("settingsPanel.k15")}</label>
              <textarea rows={3} value={systemPrompt} onChange={e => setSystemPrompt(e.target.value)} placeholder={t("settingsPanel.k32")} />
            </div>
            <div className="cc-setting-row cc-setting-row-stack">
              <label>{t("settingsPanel.k17")}</label>
              <McpConfigEditor value={mcpConfig} onChange={setMcpConfig} />
            </div>
            <div className="cc-setting-row">
              <label>{t("settingsPanel.k18")}</label>
              <input value={allowedTools} onChange={e => setAllowedTools(e.target.value)} placeholder={t("settingsPanel.k33")} />
            </div>
          </>
        )}
      </div>

      {/* ── API 供应商 ── */}
      {engine === "claude" && (
        <div className="cc-settings-section">
          <div className="cc-settings-title">{t("settingsPanel.k20")}</div>
          <div className="cc-setting-row">
            <label>{t("settingsPanel.k21")}</label>
            <select value={providerId} onChange={e => {
              const id = e.target.value;
              setProviderId(id);
              const preset = PROVIDER_PRESETS.find(p => p.id === id);
              if (preset?.baseUrl) setProviderBaseUrl(preset.baseUrl);
              else if (id !== "custom") setProviderBaseUrl("");
              if (preset?.customModels?.length) setModel(preset.customModels[0].value);
              else if (id === "official") setModel("");
            }}>
              {PROVIDER_PRESETS.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          {(providerId === "custom" || providerId !== "official") && (
            <div className="cc-setting-row">
              <label>Base URL</label>
              <input
                value={providerBaseUrl}
                onChange={e => setProviderBaseUrl(e.target.value)}
                placeholder="https://api.example.com/anthropic"
                disabled={providerId !== "custom" && !!PROVIDER_PRESETS.find(p => p.id === providerId)?.baseUrl}
              />
            </div>
          )}
          <div className="cc-setting-row">
            <label>API Key</label>
            <input
              type="password"
              value={providerApiKey}
              onChange={e => setProviderApiKey(e.target.value)}
              placeholder={t("settingsPanel.k34")}
            />
          </div>
          {providerId !== "official" && (
            <div className="cc-setting-row">
              <label>{t("settingsPanel.k22")}</label>
              <select value={model} onChange={e => setModel(e.target.value)}>
                <option value="">{t("settingsPanel.k23")}</option>
                {PROVIDER_PRESETS.find(p => p.id === providerId)?.customModels?.map(m =>
                  <option key={m.value} value={m.value}>{m.label}</option>
                )}
              </select>
            </div>
          )}
        </div>
      )}

      {/* ── 使用统计 ── */}
      <div className="cc-settings-section">
        <div className="cc-settings-title">{t("settingsPanel.k24")}</div>
        <UsageStatsSection />
      </div>

      {/* ── Skills ── */}
      {skills.length > 0 && (
        <div className="cc-settings-section">
          <div className="cc-settings-title">{t("settingsPanel.skillsLoaded", { count: skills.length })}</div>
          <div className="cc-slash-grid">
            {skills.map(s => (
              <div key={s.name} className="cc-slash-grid-item">
                <span className="cc-slash-cmd">/{s.name}</span>
                <span className="cc-slash-desc">{s.description}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── 快捷命令 ── */}
      <div className="cc-settings-section">
        <div className="cc-settings-title">{t("settingsPanel.k25")}</div>
        <div className="cc-slash-grid">
          {slashCommands.map(c => (
            <button key={c.cmd} className="cc-slash-grid-item" onClick={() => onSlashCommand(c.cmd)}>
              <span className="cc-slash-cmd">{c.cmd}</span>
              <span className="cc-slash-desc">{c.desc}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── 收藏 ── */}
      <div className="cc-settings-section">
        <div className="cc-settings-title">{t("settingsPanel.favorites", { count: favorites.length })}</div>
        {favorites.length === 0 ? <div className="cc-file-empty">{t("settingsPanel.k26")}</div> : (
          <div className="cc-fav-list">
            {favorites.map(f => (
              <div key={f.id} className="cc-fav-item">
                <span className="cc-fav-name" onClick={() => onLoadFavorite(f.message)}>{f.name}</span>
                <button onClick={() => setFavorites(prev => prev.filter(x => x.id !== f.id))}>×</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Usage Stats Section ────────────────────────────────────────────────────

function UsageStatsSection() {
  const { t } = useLocale();
  // 这里读取 localStorage 中的累计统计（由主组件更新）
  const [stats, setStats] = useState<{ cost: number; input: number; output: number; sessions: number }>(() => {
    try {
      const raw = localStorage.getItem("ccagent:usageStats");
      return raw ? JSON.parse(raw) : { cost: 0, input: 0, output: 0, sessions: 0 };
    } catch {
      return { cost: 0, input: 0, output: 0, sessions: 0 };
    }
  });

  function resetStats() {
    localStorage.removeItem("ccagent:usageStats");
    setStats({ cost: 0, input: 0, output: 0, sessions: 0 });
    toast(t("settingsPanel.statsReset"), "info");
  }

  return (
    <div className="cc-usage-stats">
      <div className="cc-usage-stat-grid">
        <div className="cc-usage-stat-item">
          <span className="cc-usage-stat-label">{t("settingsPanel.k27")}</span>
          <span className="cc-usage-stat-value">${stats.cost.toFixed(4)}</span>
        </div>
        <div className="cc-usage-stat-item">
          <span className="cc-usage-stat-label">{t("settingsPanel.k28")}</span>
          <span className="cc-usage-stat-value">{stats.input.toLocaleString()}</span>
        </div>
        <div className="cc-usage-stat-item">
          <span className="cc-usage-stat-label">{t("settingsPanel.k29")}</span>
          <span className="cc-usage-stat-value">{stats.output.toLocaleString()}</span>
        </div>
        <div className="cc-usage-stat-item">
          <span className="cc-usage-stat-label">{t("settingsPanel.k30")}</span>
          <span className="cc-usage-stat-value">{stats.sessions}</span>
        </div>
      </div>
      <button className="cc-usage-reset" onClick={resetStats}>{t("settingsPanel.k31")}</button>
    </div>
  );
}
