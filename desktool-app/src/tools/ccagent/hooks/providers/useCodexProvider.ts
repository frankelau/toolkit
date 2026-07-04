import { useCallback, useState } from "react";
import { sendBridgeEventQuiet } from "../../utils/bridge";
import { CODEX_MODELS } from "../../components/ChatInputBox/types";
import type { CodexFastMode, PermissionMode, ReasoningEffort } from "../../components/ChatInputBox/types";

/**
 * Codex-specific selectable state. `reasoningEffort` lives here because the
 * value set is a Codex/OpenAI concept (low/medium/high/xhigh/max). The change
 * handler forwards directly to the backend via bridge event.
 *
 * 对齐 cc-gui hooks/providers/useCodexProvider.ts
 * 适配：sendBridgeEvent → sendBridgeEventQuiet（Tauri 后端命令可能未注册时静默忽略）
 */
export function useCodexProvider() {
  const [selectedCodexModel, setSelectedCodexModel] = useState(CODEX_MODELS[0].id);
  const [codexPermissionMode, setCodexPermissionMode] = useState<PermissionMode>("default");
  const [reasoningEffort, setReasoningEffort] = useState<ReasoningEffort>("high");
  const [codexFastMode, setCodexFastMode] = useState<CodexFastMode>("normal");

  const handleReasoningChange = useCallback((effort: ReasoningEffort) => {
    setReasoningEffort(effort);
    sendBridgeEventQuiet("set_reasoning_effort", effort);
  }, []);

  const handleCodexFastModeChange = useCallback((mode: CodexFastMode) => {
    setCodexFastMode(mode);
    sendBridgeEventQuiet("set_codex_fast_mode", mode);
  }, []);

  return {
    selectedCodexModel,
    setSelectedCodexModel,
    codexPermissionMode,
    setCodexPermissionMode,
    reasoningEffort,
    setReasoningEffort,
    codexFastMode,
    setCodexFastMode,
    handleReasoningChange,
    handleCodexFastModeChange,
  };
}

export type UseCodexProviderReturn = ReturnType<typeof useCodexProvider>;
