/**
 * registerCallbacks/permissionCallbacks.ts
 *
 * Registers Tauri event listeners for permission dialogs:
 * showPermissionDialog, showAskUserQuestionDialog, showPlanApprovalDialog.
 *
 * 对齐 cc-gui hooks/windowCallbacks/registerCallbacks/permissionCallbacks.ts
 * 适配：window.showPermissionDialog = (json) => {} → listen("cc-permission-dialog", (event) => {})
 */

import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type { WindowCallbacksOptions } from "../types";

export async function registerPermissionCallbacks(
  options: WindowCallbacksOptions,
): Promise<UnlistenFn[]> {
  const {
    openPermissionDialog,
    openAskUserQuestionDialog,
    openPlanApprovalDialog,
  } = options;

  const unlisteners: UnlistenFn[] = [];

  // Permission dialog
  unlisteners.push(
    await listen<string>("cc-permission-dialog", (event) => {
      try {
        const payload = typeof event.payload === "string"
          ? JSON.parse(event.payload)
          : event.payload;
        openPermissionDialog(payload);
      } catch (error) {
        console.error("[permissionCallbacks] Failed to parse permission request:", error);
      }
    }),
  );

  // Ask user question dialog
  unlisteners.push(
    await listen<string>("cc-ask-user-question", (event) => {
      try {
        const payload = typeof event.payload === "string"
          ? JSON.parse(event.payload)
          : event.payload;
        openAskUserQuestionDialog(payload);
      } catch (error) {
        console.error("[permissionCallbacks] Failed to parse ask user question request:", error);
      }
    }),
  );

  // Plan approval dialog
  unlisteners.push(
    await listen<string>("cc-plan-approval", (event) => {
      try {
        const payload = typeof event.payload === "string"
          ? JSON.parse(event.payload)
          : event.payload;
        openPlanApprovalDialog(payload);
      } catch (error) {
        console.error("[permissionCallbacks] Failed to parse plan approval request:", error);
      }
    }),
  );

  return unlisteners;
}
