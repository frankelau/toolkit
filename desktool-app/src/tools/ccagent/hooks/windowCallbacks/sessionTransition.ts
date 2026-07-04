/**
 * sessionTransition.ts
 *
 * Helpers for session transition guard management and transient UI state reset.
 * These functions encapsulate the logic that coordinates the React state setters
 * and streaming refs when a new session is initiated.
 *
 * 对齐 cc-gui hooks/windowCallbacks/sessionTransition.ts
 * 适配：window.__resetTransientUiState / __sessionTransitioning 等全局槽位
 *       → ccagent 保留为 window 属性（兼容），但主要消费方是 useSessionManagement
 */

import type { MutableRefObject } from "react";
import { forceWebviewRepaint } from "../../utils/forceWebviewRepaint";

export interface ResetTransientUiStateOptions {
  clearToasts: () => void;
  setStatus: React.Dispatch<React.SetStateAction<string>>;
  setLoading: React.Dispatch<React.SetStateAction<boolean>>;
  setLoadingStartTime: React.Dispatch<React.SetStateAction<number | null>>;
  setIsThinking: React.Dispatch<React.SetStateAction<boolean>>;
  setStreamingActive: React.Dispatch<React.SetStateAction<boolean>>;

  // Streaming refs
  isStreamingRef: MutableRefObject<boolean>;
  useBackendStreamingRenderRef: MutableRefObject<boolean>;
  streamingMessageIndexRef: MutableRefObject<number>;
  streamingContentRef: MutableRefObject<string>;
  streamingThinkingRef: MutableRefObject<string>;
  autoExpandedThinkingKeysRef: MutableRefObject<Set<string>>;
  contentUpdateTimeoutRef: MutableRefObject<number | null>;
  thinkingUpdateTimeoutRef: MutableRefObject<number | null>;

  // Turn tracking ref (for streaming assistant isolation)
  streamingTurnIdRef: MutableRefObject<number>;
}

/**
 * Clear all transient UI state (streaming refs + React state flags).
 * Called on clearMessages and exposed as window.__resetTransientUiState so
 * useSessionManagement can invoke it synchronously during session transitions.
 */
export const buildResetTransientUiState = (opts: ResetTransientUiStateOptions) => {
  return () => {
    opts.clearToasts();
    opts.setStatus("");
    opts.setLoading(false);
    opts.setLoadingStartTime(null);
    opts.setIsThinking(false);
    opts.setStreamingActive(false);
    opts.isStreamingRef.current = false;
    opts.useBackendStreamingRenderRef.current = false;
    opts.streamingMessageIndexRef.current = -1;
    opts.streamingContentRef.current = "";
    opts.streamingThinkingRef.current = "";
    opts.autoExpandedThinkingKeysRef.current.clear();
    // Reset active turn ID to prevent stale streaming assistant recovery.
    opts.streamingTurnIdRef.current = -1;
    // Clear stream-end idempotency guard
    (window as unknown as Record<string, unknown>).__streamEndProcessedTurnId = undefined;
    if (opts.contentUpdateTimeoutRef.current != null) {
      cancelAnimationFrame(opts.contentUpdateTimeoutRef.current);
      opts.contentUpdateTimeoutRef.current = null;
    }
    if (opts.thinkingUpdateTimeoutRef.current != null) {
      cancelAnimationFrame(opts.thinkingUpdateTimeoutRef.current);
      opts.thinkingUpdateTimeoutRef.current = null;
    }
    // Clear native-rendering ghosting left by the outgoing session's overlays
    forceWebviewRepaint("session-transition");
  };
};

/**
 * Release the session transition guard flags set by beginSessionTransition
 * (useSessionManagement).
 */
export const releaseSessionTransition = (): void => {
  const w = window as unknown as Record<string, unknown>;
  if (w.__sessionTransitioning) {
    w.__sessionTransitioning = false;
  }
  w.__sessionTransitionToken = null;
};
