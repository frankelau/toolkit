import { useCallback, useEffect, useState } from "react";
import { sendBridgeEventQuiet } from "../../utils/bridge";
import type { SelectedAgent } from "../../components/ChatInputBox/types";

export interface UseProviderSettingsOptions {
  addToast: (message: string, type?: "info" | "success" | "warning" | "error") => void;
  t: (key: string, options?: Record<string, unknown>) => string;
}

/**
 * Cross-cutting provider settings: streaming, send shortcut, auto-open file,
 * selected agent, and the active provider config. Each setting handler pushes
 * the change to the backend via bridge event and (where applicable) toasts the
 * user-visible state change.
 *
 * 对齐 cc-gui hooks/providers/useProviderSettings.ts
 * 适配：TFunction → 自实现 t(key, options)；ProviderConfig → 简化为 Record；
 *       writeClaudeModelMapping 暂不接入（ccagent claudeModelMapping 是只读解析）
 */
export function useProviderSettings({ addToast, t }: UseProviderSettingsOptions) {
  const [streamingEnabledSetting, setStreamingEnabledSetting] = useState(true);
  const [sendShortcut, setSendShortcut] = useState<"enter" | "cmdEnter">("enter");
  const [autoOpenFileEnabled, setAutoOpenFileEnabled] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<SelectedAgent | null>(null);
  const [activeProviderConfig, setActiveProviderConfig] = useState<Record<string, unknown> | null>(null);
  const [, setProviderConfigVersion] = useState(0);

  // Load previously-selected agent on mount.
  useEffect(() => {
    const timer = setTimeout(() => {
      sendBridgeEventQuiet("get_selected_agent");
    }, 200);
    return () => clearTimeout(timer);
  }, []);

  const handleAgentSelect = useCallback((agent: SelectedAgent | null) => {
    setSelectedAgent(agent);
    if (agent) {
      sendBridgeEventQuiet("set_selected_agent", JSON.stringify({
        id: agent.id,
        name: agent.name,
        prompt: agent.prompt,
      }));
    } else {
      sendBridgeEventQuiet("set_selected_agent", "");
    }
  }, []);

  const handleStreamingEnabledChange = useCallback((enabled: boolean) => {
    setStreamingEnabledSetting(enabled);
    sendBridgeEventQuiet("set_streaming_enabled", JSON.stringify({ streamingEnabled: enabled }));
    addToast(
      enabled ? t("settings.basic.streaming.enabled") : t("settings.basic.streaming.disabled"),
      "success",
    );
  }, [t, addToast]);

  const handleSendShortcutChange = useCallback((shortcut: "enter" | "cmdEnter") => {
    setSendShortcut(shortcut);
    sendBridgeEventQuiet("set_send_shortcut", JSON.stringify({ sendShortcut: shortcut }));
  }, []);

  const handleAutoOpenFileEnabledChange = useCallback((enabled: boolean) => {
    setAutoOpenFileEnabled(enabled);
    sendBridgeEventQuiet("set_auto_open_file_enabled", JSON.stringify({ autoOpenFileEnabled: enabled }));
    addToast(
      enabled ? t("settings.basic.autoOpenFile.enabled") : t("settings.basic.autoOpenFile.disabled"),
      "success",
    );
  }, [t, addToast]);

  return {
    streamingEnabledSetting,
    setStreamingEnabledSetting,
    sendShortcut,
    setSendShortcut,
    autoOpenFileEnabled,
    setAutoOpenFileEnabled,
    selectedAgent,
    setSelectedAgent,
    activeProviderConfig,
    setActiveProviderConfig,
    setProviderConfigVersion,
    handleAgentSelect,
    handleStreamingEnabledChange,
    handleSendShortcutChange,
    handleAutoOpenFileEnabledChange,
  };
}

export type UseProviderSettingsReturn = ReturnType<typeof useProviderSettings>;
