/**
 * registerCallbacks/usageModeCallbacks.ts
 *
 * Registers Tauri event listeners for usage statistics, permission modes, and
 * model/provider updates.
 *
 * 对齐 cc-gui hooks/windowCallbacks/registerCallbacks/usageModeCallbacks.ts
 * 适配：window.xxx = (json) => {} → listen("cc-xxx", (event) => {})
 */

import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type { WindowCallbacksOptions } from "../types";
import type { PermissionMode } from "../../../components/ChatInputBox/types";
import { isValidPermissionMode, normalizeClaudeModelId } from "../../../components/ChatInputBox/types";
import { drainPendingSettings, startInitialSettingsRequest } from "../settingsBootstrap";

export async function registerUsageModeCallbacks(
  options: WindowCallbacksOptions,
): Promise<UnlistenFn[]> {
  const {
    setUsagePercentage,
    setUsageUsedTokens,
    setUsageMaxTokens,
    setPermissionMode,
    setClaudePermissionMode,
    setCodexPermissionMode,
    setSelectedClaudeModel,
    setSelectedCodexModel,
    setProviderConfigVersion,
    setActiveProviderConfig,
    setClaudeSettingsAlwaysThinkingEnabled,
    setStreamingEnabledSetting,
    setSendShortcut,
    setAutoOpenFileEnabled,
    currentProviderRef,
    syncActiveProviderModelMapping,
  } = options;

  const unlisteners: UnlistenFn[] = [];

  // Usage update
  unlisteners.push(
    await listen<string>("cc-usage-update", (event) => {
      try {
        const data = typeof event.payload === "string"
          ? JSON.parse(event.payload)
          : event.payload;
        if (typeof data.percentage === "number") {
          const used =
            typeof data.usedTokens === "number" ? data.usedTokens :
            typeof data.totalTokens === "number" ? data.totalTokens : undefined;
          const max =
            typeof data.maxTokens === "number" ? data.maxTokens :
            typeof data.limit === "number" ? data.limit : undefined;
          const safePercentage = Math.max(0, Math.min(100, data.percentage));
          setUsagePercentage(safePercentage);
          setUsageUsedTokens(used);
          setUsageMaxTokens(max);
        }
      } catch (error) {
        console.error("[usageModeCallbacks] Failed to parse usage update:", error);
      }
    }),
  );

  const updateMode = (mode: unknown, providerOverride?: string) => {
    const activeProvider = providerOverride || currentProviderRef.current;
    if (isValidPermissionMode(mode)) {
      const nextMode: PermissionMode =
        activeProvider === "codex" && mode === "plan" ? "default" : mode;
      setPermissionMode(nextMode);
      if (activeProvider === "codex") {
        setCodexPermissionMode(nextMode);
      } else {
        setClaudePermissionMode(nextMode);
      }
    }
  };

  // Mode changed / received
  unlisteners.push(await listen<string>("cc-mode-changed", (event) => updateMode(event.payload)));
  unlisteners.push(await listen<string>("cc-mode-received", (event) => updateMode(event.payload)));

  // Model changed
  unlisteners.push(
    await listen<string>("cc-model-changed", (event) => {
      const modelId = typeof event.payload === "string" ? event.payload : "";
      const provider = currentProviderRef.current;
      if (provider === "claude") {
        setSelectedClaudeModel(normalizeClaudeModelId(modelId));
      } else if (provider === "codex") {
        setSelectedCodexModel(modelId);
      }
    }),
  );

  // Active provider
  unlisteners.push(
    await listen<string>("cc-active-provider", (event) => {
      try {
        const provider = typeof event.payload === "string"
          ? JSON.parse(event.payload)
          : event.payload;
        syncActiveProviderModelMapping(provider);
        setProviderConfigVersion((prev: number) => prev + 1);
        setActiveProviderConfig(provider);
      } catch (error) {
        console.error("[usageModeCallbacks] Failed to parse active provider:", error);
      }
    }),
  );

  // Thinking enabled
  unlisteners.push(
    await listen<string>("cc-thinking-enabled", (event) => {
      const jsonStr = typeof event.payload === "string" ? event.payload : "";
      const trimmed = (jsonStr || "").trim();
      try {
        const data = JSON.parse(trimmed);
        if (typeof data === "boolean") {
          setClaudeSettingsAlwaysThinkingEnabled(data);
          return;
        }
        if (data && typeof data.enabled === "boolean") {
          setClaudeSettingsAlwaysThinkingEnabled(data.enabled);
          return;
        }
      } catch {
        if (trimmed === "true" || trimmed === "false") {
          setClaudeSettingsAlwaysThinkingEnabled(trimmed === "true");
        }
      }
    }),
  );

  // Streaming enabled
  unlisteners.push(
    await listen<string>("cc-streaming-enabled", (event) => {
      try {
        const data = typeof event.payload === "string"
          ? JSON.parse(event.payload)
          : event.payload;
        setStreamingEnabledSetting(data.streamingEnabled ?? true);
      } catch (error) {
        console.error("[usageModeCallbacks] Failed to parse streaming enabled:", error);
      }
    }),
  );

  // Send shortcut
  unlisteners.push(
    await listen<string>("cc-send-shortcut", (event) => {
      try {
        const data = typeof event.payload === "string"
          ? JSON.parse(event.payload)
          : event.payload;
        if (data.sendShortcut === "enter" || data.sendShortcut === "cmdEnter") {
          setSendShortcut(data.sendShortcut);
        }
      } catch (error) {
        console.error("[usageModeCallbacks] Failed to parse send shortcut:", error);
      }
    }),
  );

  // Auto open file enabled
  unlisteners.push(
    await listen<string>("cc-auto-open-file-enabled", (event) => {
      try {
        const data = typeof event.payload === "string"
          ? JSON.parse(event.payload)
          : event.payload;
        setAutoOpenFileEnabled(data.autoOpenFileEnabled ?? false);
      } catch (error) {
        console.error("[usageModeCallbacks] Failed to parse auto open file enabled:", error);
      }
    }),
  );

  // Drain pending settings and kick off initial requests
  drainPendingSettings();
  startInitialSettingsRequest();

  return unlisteners;
}
