/**
 * registerCallbacks/sessionCallbacks.ts
 *
 * Registers Tauri event listeners for session management, SDK dependency status,
 * and rewind result.
 *
 * 对齐 cc-gui hooks/windowCallbacks/registerCallbacks/sessionCallbacks.ts
 * 适配：window.xxx = (json) => {} → listen("cc-xxx", (event) => {})
 */

import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type { WindowCallbacksOptions } from "../types";
import { releaseSessionTransition } from "../sessionTransition";
import { drainAndRequestDependencyStatus } from "../settingsBootstrap";
import { sendBridgeEventQuiet } from "../../../utils/bridge";

const CUSTOM_TITLE_MAX_LENGTH = 50;

export async function registerSessionAndSdkCallbacks(
  options: WindowCallbacksOptions,
): Promise<UnlistenFn[]> {
  const {
    addToast,
    setCurrentSessionId,
    setSdkStatus,
    setSdkStatusLoaded,
    setIsRewinding,
    setRewindDialogOpen,
    setCurrentRewindRequest,
    customSessionTitleRef,
    currentSessionIdRef,
    updateHistoryTitle,
    applyHistoryTitleLocal,
    setCustomSessionTitle,
  } = options;

  const unlisteners: UnlistenFn[] = [];

  // Session ID set
  unlisteners.push(
    await listen<string>("cc-set-session-id", (event) => {
      const sessionId = typeof event.payload === "string" ? event.payload : "";
      const oldId = currentSessionIdRef.current;
      releaseSessionTransition();
      setCurrentSessionId(sessionId);

      const title = customSessionTitleRef.current;
      if (title && oldId !== sessionId) {
        if (title.length <= CUSTOM_TITLE_MAX_LENGTH) {
          updateHistoryTitle(sessionId, title);
        } else {
          applyHistoryTitleLocal(sessionId, title);
        }
      }
    }),
  );

  // Toast
  unlisteners.push(
    await listen<string>("cc-add-toast", (event) => {
      try {
        const data = typeof event.payload === "string"
          ? JSON.parse(event.payload)
          : event.payload;
        addToast(data.message ?? "", data.type);
      } catch {
        addToast(typeof event.payload === "string" ? event.payload : "", undefined);
      }
    }),
  );

  // Export session data
  unlisteners.push(
    await listen<string>("cc-export-session-data", (event) => {
      try {
        const data = typeof event.payload === "string"
          ? JSON.parse(event.payload)
          : event.payload;
        if (data.sessionId && data.messages) {
          // Trigger download
          const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          const sanitizedTitle = (data.title || "session")
            .replace(/[<>:"/\\|?*]/g, "_")
            .replace(/\s+/g, "_")
            .substring(0, 50);
          a.download = `${sanitizedTitle}_${data.sessionId.substring(0, 8)}.json`;
          a.click();
          URL.revokeObjectURL(url);
        } else if (data.error) {
          addToast(data.error, "error");
        }
      } catch (error) {
        console.error("[sessionCallbacks] Failed to process export data:", error);
      }
    }),
  );

  // Dependency status
  unlisteners.push(
    await listen<string>("cc-dependency-status", (event) => {
      try {
        const data = typeof event.payload === "string"
          ? JSON.parse(event.payload)
          : event.payload;
        setSdkStatus(data);
        setSdkStatusLoaded(true);
      } catch (error) {
        console.error("[sessionCallbacks] Failed to parse dependency status:", error);
      }
    }),
  );

  drainAndRequestDependencyStatus();

  // Rewind result
  unlisteners.push(
    await listen<string>("cc-rewind-result", (event) => {
      try {
        const result = typeof event.payload === "string"
          ? JSON.parse(event.payload)
          : event.payload;
        setIsRewinding(false);
        if (result.success) {
          setRewindDialogOpen(false);
          setCurrentRewindRequest(null);
          addToast("Rewind successful", "success");
        } else {
          addToast(result.message || "Rewind failed", "error");
        }
      } catch (error) {
        console.error("[sessionCallbacks] Failed to parse rewind result:", error);
        setIsRewinding(false);
        setRewindDialogOpen(false);
        setCurrentRewindRequest(null);
      }
    }),
  );

  // Session title update
  unlisteners.push(
    await listen<string>("cc-update-session-title", (event) => {
      try {
        const data = typeof event.payload === "string"
          ? JSON.parse(event.payload)
          : event.payload;
        const { sessionId, title } = data;
        if (!title || !title.trim() || !sessionId) return;
        if (currentSessionIdRef.current !== sessionId) return;
        setCustomSessionTitle(title.trim());
        applyHistoryTitleLocal(sessionId, title.trim());
      } catch (error) {
        console.error("[sessionCallbacks] Failed to parse session title:", error);
      }
    }),
  );

  // Conversion result
  unlisteners.push(
    await listen<string>("cc-conversion-result", (event) => {
      const reloadHistory = () => {
        const provider = options.currentProviderRef.current;
        if (provider) {
          sendBridgeEventQuiet("deep_search_history", provider);
        }
      };

      try {
        const result = typeof event.payload === "string"
          ? JSON.parse(event.payload)
          : event.payload;
        if (result.success) {
          if (result.infoCode === "ALREADY_CLI_SESSION") {
            addToast("Already a CLI session", "info");
          } else {
            addToast("Conversion successful", "success");
            reloadHistory();
          }
          return;
        }
        addToast(result.message || "Conversion failed", "error");
        reloadHistory();
      } catch (error) {
        console.error("[sessionCallbacks] Failed to parse conversion result:", error);
        reloadHistory();
      }
    }),
  );

  return unlisteners;
}
