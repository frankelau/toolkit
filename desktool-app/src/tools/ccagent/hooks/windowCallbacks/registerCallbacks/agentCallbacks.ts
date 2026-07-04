/**
 * registerCallbacks/agentCallbacks.ts
 *
 * Registers Tauri event listeners for agent management and selection context:
 * addSelectionInfo, addCodeSnippet, clearSelectionInfo,
 * onSelectedAgentReceived, onSelectedAgentChanged.
 *
 * 对齐 cc-gui hooks/windowCallbacks/registerCallbacks/agentCallbacks.ts
 * 适配：window.xxx = (json) => {} → listen("cc-xxx", (event) => {})
 */

import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type { WindowCallbacksOptions } from "../types";

export async function registerAgentAndSelectionCallbacks(
  options: WindowCallbacksOptions,
): Promise<UnlistenFn[]> {
  const { setContextInfo, setSelectedAgent } = options;

  const unlisteners: UnlistenFn[] = [];

  // Selection info
  unlisteners.push(
    await listen<string>("cc-add-selection-info", (event) => {
      const selectionInfo = typeof event.payload === "string" ? event.payload : "";
      if (selectionInfo) {
        const match = selectionInfo.match(/^@([^#]+)(?:#L(\d+)(?:-(\d+))?)?$/);
        if (match) {
          const file = match[1];
          const startLine = match[2] ? parseInt(match[2], 10) : undefined;
          const endLine = match[3]
            ? parseInt(match[3], 10)
            : startLine !== undefined
              ? startLine
              : undefined;
          setContextInfo({ file, startLine, endLine, raw: selectionInfo });
        }
      }
    }),
  );

  // Clear selection info
  unlisteners.push(
    await listen("cc-clear-selection-info", () => {
      setContextInfo(null);
    }),
  );

  // Selected agent received
  unlisteners.push(
    await listen<string>("cc-selected-agent-received", (event) => {
      const json = typeof event.payload === "string" ? event.payload : "";
      try {
        if (!json || json === "null" || json === "{}") {
          setSelectedAgent(null);
          return;
        }
        const data = JSON.parse(json);
        const agentData = data?.agent?.id ? data.agent : data?.id ? data : null;
        if (!agentData) {
          setSelectedAgent(null);
          return;
        }
        setSelectedAgent({
          id: agentData.id,
          name: agentData.name || "",
          prompt: agentData.prompt,
        });
      } catch (error) {
        console.error("[agentCallbacks] Failed to parse selected agent:", error);
        setSelectedAgent(null);
      }
    }),
  );

  // Selected agent changed
  unlisteners.push(
    await listen<string>("cc-selected-agent-changed", (event) => {
      const json = typeof event.payload === "string" ? event.payload : "";
      try {
        if (!json || json === "null" || json === "{}") {
          setSelectedAgent(null);
          return;
        }
        const data = JSON.parse(json);
        if (data?.success === false) return;
        const agentData = data?.agent;
        if (!agentData || !agentData.id) {
          setSelectedAgent(null);
          return;
        }
        setSelectedAgent({
          id: agentData.id,
          name: agentData.name || "",
          prompt: agentData.prompt,
        });
      } catch (error) {
        console.error("[agentCallbacks] Failed to parse selected agent changed:", error);
      }
    }),
  );

  return unlisteners;
}
