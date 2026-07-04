// ConfigSelect — 配置选择下拉菜单（对齐 cc-gui ConfigSelect）
// Sprint U1: 深化实现 — 完整子菜单管理 + Agent 加载 + Node 进程订阅 + Toast

import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { invoke } from "@tauri-apps/api/core";
import type { Engine, AgentConfig } from "../../../types";
import { MODELS, PERMISSION_MODES, PROVIDER_PRESETS } from "../../../constants";
import { t } from "../../../i18n";
import {
  fetchNodeProcesses,
  subscribeNodeProcesses,
  type NodeProcessSnapshot,
} from "../../../utils/nodeProcessCapabilities";
import { sendBridgeEventQuiet } from "../../../utils/bridge";
import { RuntimeProviderSelect } from "./RuntimeProviderSelect";
import { NodeProcessSelect } from "./NodeProcessSelect";

interface ConfigSelectProps {
  engine: Engine;
  model: string;
  setModel: (m: string) => void;
  permissionMode: string;
  setPermissionMode: (m: string) => void;
  streamingEnabled: boolean;
  setStreamingEnabled: (v: boolean) => void;
  thinkingEnabled: boolean;
  setThinkingEnabled: (v: boolean) => void;
  providerId: string;
  setProviderId: (id: string) => void;
  agents: AgentConfig[];
  onUseAgent: (a: AgentConfig) => void;
  onOpenAgentSettings: () => void;
  selectedAgent?: { id: string; name: string; prompt?: string } | null;
  onAgentSelect?: (agent: { id: string; name: string; prompt?: string } | null) => void;
  currentProvider?: string;
}

type SubmenuType = "none" | "model" | "mode" | "provider" | "agent" | "runtimeProvider" | "nodeProcesses";

const WRAPPER_STYLE: React.CSSProperties = {
  position: "relative",
  display: "inline-flex",
  alignItems: "center",
  gap: "4px",
};

const BUTTON_STYLE: React.CSSProperties = {
  marginLeft: "5px",
  marginRight: "-2px",
  background: "none",
  border: "none",
  cursor: "pointer",
  padding: "2px 6px",
  borderRadius: "4px",
  color: "var(--cc-text-secondary, #888)",
};

const DROPDOWN_STYLE: React.CSSProperties = {
  position: "absolute",
  bottom: "100%",
  left: 0,
  marginBottom: "4px",
  zIndex: 10000,
  minWidth: "240px",
  maxHeight: "400px",
  overflowY: "auto",
  background: "var(--cc-bg-dropdown, #2b2b2b)",
  border: "1px solid var(--cc-border, #555)",
  borderRadius: "6px",
  boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
};

const SUBMENU_STYLE: React.CSSProperties = {
  position: "absolute",
  left: "100%",
  bottom: 0,
  marginLeft: "-30px",
  zIndex: 10001,
  minWidth: "320px",
  maxWidth: "360px",
  maxHeight: "300px",
  overflowY: "auto",
  background: "var(--cc-bg-dropdown, #2b2b2b)",
  border: "1px solid var(--cc-border, #555)",
  borderRadius: "6px",
  boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
};

const OPTION_STYLE: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  padding: "8px 12px",
  cursor: "pointer",
  position: "relative",
};

const OPTION_INFO_STYLE: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "2px",
  flex: 1,
  minWidth: 0,
};

const ARROW_CONTAINER_STYLE: React.CSSProperties = {
  marginLeft: "auto",
  display: "flex",
  alignItems: "center",
  paddingLeft: "12px",
};

const SWITCH_OPTION_STYLE: React.CSSProperties = {
  ...OPTION_STYLE,
  justifyContent: "space-between",
};

const SWITCH_LABEL_STYLE: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
};

const DIVIDER_STYLE: React.CSSProperties = {
  height: 1,
  background: "var(--cc-border, #555)",
  margin: "4px 0",
  opacity: 0.5,
};

const TOAST_STYLE: React.CSSProperties = {
  position: "fixed",
  bottom: "60px",
  left: "50%",
  transform: "translateX(-50%)",
  zIndex: 20000,
  padding: "8px 16px",
  background: "var(--cc-bg-toast, #333)",
  color: "var(--cc-text-primary, #fff)",
  borderRadius: "6px",
  boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
  fontSize: "13px",
  pointerEvents: "none",
};

export function ConfigSelect(props: ConfigSelectProps) {
  const [open, setOpen] = useState<SubmenuType>("none");
  const [agentLoading, setAgentLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [showToast, setShowToast] = useState(false);
  const [nodeProcessTotals, setNodeProcessTotals] = useState<{ all: number; orphan: number }>({ all: 0, orphan: 0 });

  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const toastTimerRef = useRef<number | undefined>(undefined);

  const handleToggle = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setOpen(open === "none" ? "model" : "none");
  }, [open]);

  // 加载 Agent 列表
  const loadAgents = useCallback(async () => {
    setAgentLoading(true);
    try {
      const list = await invoke<AgentConfig[]>("cc_list_agents").catch(() => props.agents);
      // props.agents 作为 fallback
      void list;
    } catch {
      // 使用 props 传入的 agents
    } finally {
      setAgentLoading(false);
    }
  }, [props.agents]);

  // 订阅 Node 进程快照
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    subscribeNodeProcesses((snapshot: NodeProcessSnapshot) => {
      setNodeProcessTotals({ all: snapshot.totals.all, orphan: snapshot.totals.orphan });
    }).then((un) => { unsubscribe = un; });
    return () => { unsubscribe?.(); };
  }, []);

  // 打开时刷新 Node 进程
  useEffect(() => {
    if (open !== "none") {
      fetchNodeProcesses();
    }
  }, [open]);

  // 点击外部关闭
  useEffect(() => {
    if (open === "none") return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
        buttonRef.current && !buttonRef.current.contains(e.target as Node)
      ) {
        setOpen("none");
      }
    };
    const timer = setTimeout(() => {
      document.addEventListener("mousedown", handleClickOutside);
    }, 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [open]);

  // 加载 Agent
  useEffect(() => {
    if (open === "agent") {
      loadAgents();
    }
  }, [open, loadAgents]);

  // 清理 toast 定时器
  useEffect(() => {
    return () => {
      if (toastTimerRef.current !== undefined) {
        window.clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  const showProviderToast = useCallback((message: string) => {
    if (toastTimerRef.current !== undefined) {
      window.clearTimeout(toastTimerRef.current);
    }
    setToastMessage(message);
    setShowToast(true);
    toastTimerRef.current = window.setTimeout(() => setShowToast(false), 1800);
  }, []);

  // 流式开关切换
  const handleStreamingChange = useCallback((enabled: boolean) => {
    props.setStreamingEnabled(enabled);
    sendBridgeEventQuiet("set_streaming_enabled", JSON.stringify({ streamingEnabled: enabled }));
    showProviderToast(enabled ? t("settings.basic.streaming.enabled") : t("settings.basic.streaming.disabled"));
  }, [props, showProviderToast]);

  // 思考开关切换
  const handleThinkingChange = useCallback((enabled: boolean) => {
    props.setThinkingEnabled(enabled);
    sendBridgeEventQuiet("set_thinking_enabled", JSON.stringify({ enabled }));
  }, [props]);

  // Agent 选择
  const handleAgentSelect = useCallback((agent: { id: string; name: string; prompt?: string } | null) => {
    props.onAgentSelect?.(agent);
    if (agent) {
      sendBridgeEventQuiet("set_selected_agent", JSON.stringify({
        id: agent.id,
        name: agent.name,
        prompt: agent.prompt,
      }));
    } else {
      sendBridgeEventQuiet("set_selected_agent", "");
    }
    setOpen("none");
  }, [props]);

  // 模型选择
  const handleModelSelect = useCallback((model: string) => {
    props.setModel(model);
    sendBridgeEventQuiet("set_model", model);
    setOpen("none");
  }, [props]);

  // 权限模式选择
  const handleModeSelect = useCallback((mode: string) => {
    props.setPermissionMode(mode);
    sendBridgeEventQuiet("set_mode", mode);
    setOpen("none");
  }, [props]);

  // Provider 选择
  const handleProviderSelect = useCallback((id: string) => {
    props.setProviderId(id);
    sendBridgeEventQuiet("set_provider", id);
    setOpen("none");
  }, [props]);

  const renderModelDropdown = () => (
    <div className="cc-cfg-dropdown" style={DROPDOWN_STYLE} ref={dropdownRef}>
      {/* 模型选择 */}
      <div
        className="selector-option"
        onMouseEnter={() => setOpen("model")}
        style={OPTION_STYLE}
      >
        <span>🧪</span>
        <div style={OPTION_INFO_STYLE}>
          <span>{t("settings.basic.model")}</span>
          <span style={{ fontSize: "11px", opacity: 0.7 }}>
            {MODELS[props.engine]?.find(m => m.value === props.model)?.label ?? t("common.default")}
          </span>
        </div>
        <div style={ARROW_CONTAINER_STYLE}><span>›</span></div>
        {open === "model" && (
          <div className="cc-cfg-submenu" style={SUBMENU_STYLE}>
            {(MODELS[props.engine] || []).map(m => (
              <div
                key={m.value}
                className={`selector-option ${props.model === m.value ? "selected" : ""}`}
                style={OPTION_STYLE}
                onClick={(e) => { e.stopPropagation(); handleModelSelect(m.value); }}
              >
                <span>{props.model === m.value ? "✓" : ""}</span>
                <span>{m.label}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={DIVIDER_STYLE} />

      {/* 权限模式 */}
      <div
        className="selector-option"
        onMouseEnter={() => setOpen("mode")}
        style={OPTION_STYLE}
      >
        <span>🔒</span>
        <div style={OPTION_INFO_STYLE}>
          <span>{t("settings.basic.permissionMode")}</span>
          <span style={{ fontSize: "11px", opacity: 0.7 }}>
            {PERMISSION_MODES.find(p => p.value === props.permissionMode)?.label ?? t("common.default")}
          </span>
        </div>
        <div style={ARROW_CONTAINER_STYLE}><span>›</span></div>
        {open === "mode" && (
          <div className="cc-cfg-submenu" style={SUBMENU_STYLE}>
            {PERMISSION_MODES.map(p => (
              <div
                key={p.value}
                className={`selector-option ${props.permissionMode === p.value ? "selected" : ""}`}
                style={OPTION_STYLE}
                onClick={(e) => { e.stopPropagation(); handleModeSelect(p.value); }}
              >
                <span>{props.permissionMode === p.value ? "✓" : ""}</span>
                <span>{p.label}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={DIVIDER_STYLE} />

      {/* Provider */}
      <div
        className="selector-option"
        onMouseEnter={() => setOpen("provider")}
        style={OPTION_STYLE}
      >
        <span>🌐</span>
        <div style={OPTION_INFO_STYLE}>
          <span>{t("settings.provider.title")}</span>
          <span style={{ fontSize: "11px", opacity: 0.7 }}>
            {PROVIDER_PRESETS.find(p => p.id === props.providerId)?.name ?? t("settings.provider.official")}
          </span>
        </div>
        <div style={ARROW_CONTAINER_STYLE}><span>›</span></div>
        {open === "provider" && (
          <div className="cc-cfg-submenu" style={SUBMENU_STYLE}>
            {PROVIDER_PRESETS.map(p => (
              <div
                key={p.id}
                className={`selector-option ${props.providerId === p.id ? "selected" : ""}`}
                style={OPTION_STYLE}
                onClick={(e) => { e.stopPropagation(); handleProviderSelect(p.id); }}
              >
                <span>{props.providerId === p.id ? "✓" : ""}</span>
                <span>{p.name}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={DIVIDER_STYLE} />

      {/* Agent 选择 */}
      <div
        className="selector-option"
        onMouseEnter={() => setOpen("agent")}
        style={OPTION_STYLE}
      >
        <span>🤖</span>
        <div style={OPTION_INFO_STYLE}>
          <span>{t("settings.agent.title")}</span>
          {props.selectedAgent?.name ? (
            <span style={{ fontSize: "11px", opacity: 0.7 }}>{props.selectedAgent.name}</span>
          ) : null}
        </div>
        <div style={ARROW_CONTAINER_STYLE}><span>›</span></div>
        {open === "agent" && (
          <div className="cc-cfg-submenu" style={SUBMENU_STYLE}>
            {agentLoading ? (
              <div className="selector-option" style={{ ...OPTION_STYLE, cursor: "default" }}>
                <span>⏳</span>
                <span>{t("chat.loadingDropdown")}</span>
              </div>
            ) : props.agents.length === 0 ? (
              <div
                className="selector-option"
                style={OPTION_STYLE}
                onClick={(e) => { e.stopPropagation(); props.onOpenAgentSettings(); setOpen("none"); }}
              >
                <span>➕</span>
                <span>{t("settings.agent.createAgent")}</span>
              </div>
            ) : (
              <>
                {props.agents.map(a => (
                  <div
                    key={a.id}
                    className={`selector-option ${props.selectedAgent?.id === a.id ? "selected" : ""}`}
                    style={OPTION_STYLE}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleAgentSelect({ id: a.id, name: a.name, prompt: a.prompt });
                      props.onUseAgent(a);
                    }}
                  >
                    <span>{props.selectedAgent?.id === a.id ? "✓" : "🤖"}</span>
                    <div style={OPTION_INFO_STYLE}>
                      <span style={{
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}>{a.name}</span>
                      {a.prompt && (
                        <span style={{
                          fontSize: "11px",
                          opacity: 0.6,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}>{a.prompt.slice(0, 60)}</span>
                      )}
                    </div>
                  </div>
                ))}
                <div style={DIVIDER_STYLE} />
                <div
                  className="selector-option"
                  style={OPTION_STYLE}
                  onClick={(e) => { e.stopPropagation(); props.onOpenAgentSettings(); setOpen("none"); }}
                >
                  <span>⚙️</span>
                  <span>{t("settings.agent.manageAgents")}</span>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <div style={DIVIDER_STYLE} />

      {/* Runtime Provider */}
      <div
        className="selector-option"
        onMouseEnter={() => setOpen("runtimeProvider")}
        onMouseLeave={() => setOpen("none")}
        style={OPTION_STYLE}
      >
        <span>🖥️</span>
        <div style={OPTION_INFO_STYLE}>
          <span>{t("config.runtimeProvider.title")}</span>
        </div>
        <div style={ARROW_CONTAINER_STYLE}><span>›</span></div>
        {open === "runtimeProvider" && (
          <RuntimeProviderSelect
            currentProvider={props.currentProvider || "claude"}
            embedded
            onProviderSwitched={showProviderToast}
            onClose={() => setOpen("none")}
          />
        )}
      </div>

      <div style={DIVIDER_STYLE} />

      {/* Node 进程管理 */}
      <div
        className="selector-option"
        onMouseEnter={() => setOpen("nodeProcesses")}
        onMouseLeave={() => setOpen("none")}
        style={OPTION_STYLE}
      >
        <span>⚙️</span>
        <div style={OPTION_INFO_STYLE}>
          <span>{t("config.nodeProcesses.title")}</span>
          {nodeProcessTotals.all > 0 ? (
            <span style={{ fontSize: "11px", opacity: 0.7 }}>
              {nodeProcessTotals.orphan > 0
                ? t("config.nodeProcesses.badgeWithOrphan", { total: nodeProcessTotals.all, orphan: nodeProcessTotals.orphan })
                : t("config.nodeProcesses.badge", { total: nodeProcessTotals.all })}
            </span>
          ) : null}
        </div>
        <div style={ARROW_CONTAINER_STYLE}><span>›</span></div>
        {open === "nodeProcesses" && (
          <NodeProcessSelect
            embedded
            onToast={showProviderToast}
            onClose={() => setOpen("none")}
          />
        )}
      </div>

      <div style={DIVIDER_STYLE} />

      {/* 流式开关 */}
      <div
        className="selector-option"
        onClick={(e) => { e.stopPropagation(); handleStreamingChange(!props.streamingEnabled); }}
        onMouseEnter={() => setOpen("none")}
        style={SWITCH_OPTION_STYLE}
      >
        <div style={SWITCH_LABEL_STYLE}>
          <span>🔄</span>
          <span>{t("settings.basic.streaming.label")}</span>
        </div>
        <input
          type="checkbox"
          checked={props.streamingEnabled}
          onChange={(e) => { e.stopPropagation(); handleStreamingChange(e.target.checked); }}
          onClick={(e) => e.stopPropagation()}
        />
      </div>

      <div style={DIVIDER_STYLE} />

      {/* 思考开关（claude only） */}
      {props.engine === "claude" && (
        <div
          className="selector-option"
          onClick={(e) => { e.stopPropagation(); handleThinkingChange(!props.thinkingEnabled); }}
          onMouseEnter={() => setOpen("none")}
          style={SWITCH_OPTION_STYLE}
        >
          <div style={SWITCH_LABEL_STYLE}>
            <span>💡</span>
            <span>{t("common.thinking")}</span>
          </div>
          <input
            type="checkbox"
            checked={props.thinkingEnabled}
            onChange={(e) => { e.stopPropagation(); handleThinkingChange(e.target.checked); }}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );

  return (
    <div className="cc-cfg-select" style={WRAPPER_STYLE}>
      <button
        ref={buttonRef}
        className="cc-cfg-btn"
        onClick={handleToggle}
        style={BUTTON_STYLE}
        title={t("settings.configure")}
      >
        ⚙️
      </button>

      {open !== "none" && renderModelDropdown()}

      {showToast && createPortal(
        <div className="selector-toast" style={TOAST_STYLE}>
          {toastMessage}
        </div>,
        document.body,
      )}
    </div>
  );
}
