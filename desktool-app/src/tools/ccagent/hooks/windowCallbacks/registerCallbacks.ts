/**
 * registerCallbacks.ts
 *
 * Single entry point that mounts all Tauri event listeners. Called once
 * inside useWindowCallbacks' useEffect. Receives the full options bag from
 * the hook rather than individual parameters to keep the call-site tidy.
 *
 * 对齐 cc-gui hooks/windowCallbacks/registerCallbacks.ts
 * 适配：window.xxx 全局回调 → Tauri listen 事件；返回 UnlistenFn[] 用于清理
 */

import type { UnlistenFn } from "@tauri-apps/api/event";
import type { WindowCallbacksOptions } from "./types";
import { buildResetTransientUiState } from "./sessionTransition";
import {
  startActiveProviderRequest,
  startModeRequest,
  startThinkingEnabledRequest,
} from "./settingsBootstrap";
import { registerMessageCallbacks } from "./registerCallbacks/messageCallbacks";
import { registerStreamingCallbacks } from "./registerCallbacks/streamingCallbacks";
import { registerSessionAndSdkCallbacks } from "./registerCallbacks/sessionCallbacks";
import { registerUsageModeCallbacks } from "./registerCallbacks/usageModeCallbacks";
import { registerPermissionCallbacks } from "./registerCallbacks/permissionCallbacks";
import { registerAgentAndSelectionCallbacks } from "./registerCallbacks/agentCallbacks";

export async function registerWindowCallbacks(
  options: WindowCallbacksOptions,
): Promise<UnlistenFn[]> {
  // -------------------------------------------------------------------------
  // Session transition helpers
  // -------------------------------------------------------------------------

  const resetTransientUiState = buildResetTransientUiState({
    clearToasts: options.clearToasts,
    setStatus: options.setStatus,
    setLoading: options.setLoading,
    setLoadingStartTime: options.setLoadingStartTime,
    setIsThinking: options.setIsThinking,
    setStreamingActive: options.setStreamingActive,
    isStreamingRef: options.isStreamingRef,
    useBackendStreamingRenderRef: options.useBackendStreamingRenderRef,
    streamingMessageIndexRef: options.streamingMessageIndexRef,
    streamingContentRef: options.streamingContentRef,
    streamingThinkingRef: options.streamingThinkingRef,
    autoExpandedThinkingKeysRef: options.autoExpandedThinkingKeysRef,
    contentUpdateTimeoutRef: options.contentUpdateTimeoutRef,
    thinkingUpdateTimeoutRef: options.thinkingUpdateTimeoutRef,
    streamingTurnIdRef: options.streamingTurnIdRef,
  });

  // Expose as single entry point for session transition cleanup
  (window as unknown as Record<string, unknown>).__resetTransientUiState = resetTransientUiState;

  // =========================================================================
  // Register callback groups (each returns UnlistenFn[] for cleanup)
  // =========================================================================

  const allUnlisteners: UnlistenFn[] = [];

  const groups = [
    registerMessageCallbacks(options, resetTransientUiState),
    registerStreamingCallbacks(options),
    registerSessionAndSdkCallbacks(options),
    registerUsageModeCallbacks(options),
    registerPermissionCallbacks(options),
    registerAgentAndSelectionCallbacks(options),
  ];

  for (const group of groups) {
    const unlisteners = await group;
    allUnlisteners.push(...unlisteners);
  }

  // =========================================================================
  // Request Initial States
  // =========================================================================

  startActiveProviderRequest();
  startModeRequest();
  startThinkingEnabledRequest();

  return allUnlisteners;
}
