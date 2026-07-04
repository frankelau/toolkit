/**
 * settingsBootstrap.ts
 *
 * Handles initial configuration requests sent to the backend and the
 * processing of any values that arrived before the callbacks were registered.
 *
 * 对齐 cc-gui hooks/windowCallbacks/settingsBootstrap.ts
 * 适配：window.sendToJava 检测 → 直接调用 sendBridgeEventQuiet（Tauri 后端不存在时静默）
 *       window.__pending* 槽位 → 保留为 window 属性（兼容预加载场景）
 */

import { sendBridgeEventQuiet } from "../../utils/bridge";

/**
 * Fire the settings queries to the backend. Retries up to MAX_RETRIES
 * times (at 100 ms intervals) if backend is not yet available.
 */
export const startInitialSettingsRequest = (): void => {
  if (typeof window === "undefined") {
    return;
  }

  let settingsRetryCount = 0;
  const requestInitialSettings = () => {
    if (typeof window === "undefined") {
      return;
    }
    // Tauri: 直接发送，后端命令不存在时 sendBridgeEventQuiet 会静默忽略
    sendBridgeEventQuiet("get_streaming_enabled");
    sendBridgeEventQuiet("get_send_shortcut");
    sendBridgeEventQuiet("get_auto_open_file_enabled");
    sendBridgeEventQuiet("get_permission_dialog_timeout");
    settingsRetryCount++;
    // Tauri 不需要重试（invoke 是同步可用的），但保留兼容逻辑
    if (settingsRetryCount < 1) {
      setTimeout(requestInitialSettings, 100);
    }
  };
  setTimeout(requestInitialSettings, 200);
};

/**
 * Request the active provider configuration.
 */
export const startActiveProviderRequest = (): void => {
  if (typeof window === "undefined") {
    return;
  }
  setTimeout(() => {
    sendBridgeEventQuiet("get_active_provider");
  }, 200);
};

/**
 * Request the current permission mode from the backend.
 */
export const startModeRequest = (): void => {
  if (typeof window === "undefined") {
    return;
  }
  setTimeout(() => {
    sendBridgeEventQuiet("get_mode");
  }, 200);
};

/**
 * Request the thinking-enabled setting from the backend.
 */
export const startThinkingEnabledRequest = (): void => {
  if (typeof window === "undefined") {
    return;
  }
  setTimeout(() => {
    sendBridgeEventQuiet("get_thinking_enabled");
  }, 200);
};

/**
 * Drain any pending window.__pending* values captured before the React
 * callbacks were registered. Must be called after the corresponding
 * Tauri event listeners have been set up.
 */
export const drainPendingSettings = (): void => {
  if (typeof window === "undefined") {
    return;
  }

  const w = window as unknown as Record<string, unknown>;

  if (w.__pendingStreamingEnabled) {
    const pending = w.__pendingStreamingEnabled as string;
    delete w.__pendingStreamingEnabled;
    const handler = w.updateStreamingEnabled as ((json: string) => void) | undefined;
    handler?.(pending);
  }

  if (w.__pendingSendShortcut) {
    const pending = w.__pendingSendShortcut as string;
    delete w.__pendingSendShortcut;
    const handler = w.updateSendShortcut as ((json: string) => void) | undefined;
    handler?.(pending);
  }

  if (w.__pendingAutoOpenFileEnabled) {
    const pending = w.__pendingAutoOpenFileEnabled as string;
    delete w.__pendingAutoOpenFileEnabled;
    const handler = w.updateAutoOpenFileEnabled as ((json: string) => void) | undefined;
    handler?.(pending);
  }

  if (w.__pendingPermissionDialogTimeout) {
    const pending = w.__pendingPermissionDialogTimeout as string;
    delete w.__pendingPermissionDialogTimeout;
    const handler = w.updatePermissionDialogTimeout as ((json: string) => void) | undefined;
    handler?.(pending);
  }

  if (w.__pendingModeReceived) {
    const pending = w.__pendingModeReceived as string;
    delete w.__pendingModeReceived;
    const handler = w.onModeReceived as ((mode: string) => void) | undefined;
    handler?.(pending);
  }
};

/**
 * Drain any dependency-status payload that arrived before the callback was
 * registered, then trigger a fresh fetch.
 */
export const drainAndRequestDependencyStatus = (): void => {
  if (typeof window === "undefined") {
    return;
  }

  const w = window as unknown as Record<string, unknown>;

  if (w.__pendingDependencyStatus) {
    const pending = w.__pendingDependencyStatus as string;
    delete w.__pendingDependencyStatus;
    const handler = w.updateDependencyStatus as ((json: string) => void) | undefined;
    handler?.(pending);
  }

  sendBridgeEventQuiet("get_dependency_status");
};
