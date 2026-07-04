import { useEffect } from "react";
import { sendBridgeEventQuiet } from "../../utils/bridge";
import {
  CLAUDE_MODELS,
  CODEX_MODELS,
  isValidPermissionMode,
  normalizeClaudeModelId,
  apply1MContextSuffix,
  strip1MContextSuffix,
  isValidReasoningEffort,
  isValidCodexFastMode,
} from "../../components/ChatInputBox/types";
import type { CodexFastMode, PermissionMode, ReasoningEffort } from "../../components/ChatInputBox/types";

const STORAGE_KEY = "model-selection-state";

const getCustomModels = (key: string): { id: string }[] => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

export interface UseModelStatePersistenceOptions {
  // Cross-slice load setters (run once on mount)
  setCurrentProvider: (value: string) => void;
  setSelectedClaudeModel: (value: string) => void;
  setSelectedCodexModel: (value: string) => void;
  setClaudePermissionMode: (value: PermissionMode) => void;
  setCodexPermissionMode: (value: PermissionMode) => void;
  setPermissionMode: (value: PermissionMode) => void;
  setLongContextEnabled: (value: boolean) => void;
  setReasoningEffort: (value: ReasoningEffort) => void;
  setCodexFastMode: (value: CodexFastMode) => void;
  // Cross-slice save deps (re-saves on any change)
  currentProvider: string;
  selectedClaudeModel: string;
  selectedCodexModel: string;
  claudePermissionMode: PermissionMode;
  codexPermissionMode: PermissionMode;
  longContextEnabled: boolean;
  reasoningEffort: ReasoningEffort;
  codexFastMode: CodexFastMode;
}

/**
 * Two effects for persisting cross-slice provider/model state to localStorage:
 *  1. On mount: hydrate state from localStorage and sync the restored values
 *     to the backend.
 *  2. On change: re-save the snapshot to localStorage.
 *
 * 对齐 cc-gui hooks/providers/useModelStatePersistence.ts
 * 适配：window.sendToJava 检测 → 直接调用 sendBridgeEventQuiet（Tauri 后端不存在时静默）
 */
export function useModelStatePersistence(options: UseModelStatePersistenceOptions) {
  const {
    setCurrentProvider,
    setSelectedClaudeModel,
    setSelectedCodexModel,
    setClaudePermissionMode,
    setCodexPermissionMode,
    setPermissionMode,
    setLongContextEnabled,
    setReasoningEffort,
    setCodexFastMode,
    currentProvider,
    selectedClaudeModel,
    selectedCodexModel,
    claudePermissionMode,
    codexPermissionMode,
    longContextEnabled,
    reasoningEffort,
    codexFastMode,
  } = options;

  // Hydrate from localStorage and sync to backend (mount only).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      let restoredProvider = "claude";
      let restoredClaudeModel = CLAUDE_MODELS[0].id;
      let restoredCodexModel = CODEX_MODELS[0].id;
      let restoredClaudePermissionMode: PermissionMode = "bypassPermissions";
      let restoredCodexPermissionMode: PermissionMode = "default";
      let restoredLongContextEnabled = true;
      let restoredCodexFastMode: CodexFastMode = "normal";

      if (saved) {
        const state = JSON.parse(saved);

        if (["claude", "codex"].includes(state.provider)) {
          restoredProvider = state.provider;
          setCurrentProvider(state.provider);
        }

        if (isValidPermissionMode(state.claudePermissionMode)) {
          restoredClaudePermissionMode = state.claudePermissionMode;
        }
        if (isValidPermissionMode(state.codexPermissionMode)) {
          restoredCodexPermissionMode = state.codexPermissionMode === "plan"
            ? "default"
            : state.codexPermissionMode;
        }

        if (typeof state.longContextEnabled === "boolean") {
          restoredLongContextEnabled = state.longContextEnabled;
          setLongContextEnabled(state.longContextEnabled);
        }

        if (isValidReasoningEffort(state.reasoningEffort)) {
          setReasoningEffort(state.reasoningEffort);
        }
        if (isValidCodexFastMode(state.codexFastMode)) {
          restoredCodexFastMode = state.codexFastMode;
          setCodexFastMode(restoredCodexFastMode);
        }

        const savedClaudeCustomModels = getCustomModels("claude-custom-models");
        const strippedClaudeModel = strip1MContextSuffix(state.claudeModel ?? "");
        const normalizedClaudeModel = normalizeClaudeModelId(strippedClaudeModel);
        if (
          CLAUDE_MODELS.find((m) => m.id === normalizedClaudeModel) ||
          savedClaudeCustomModels.find((m) => m.id === normalizedClaudeModel)
        ) {
          restoredClaudeModel = normalizedClaudeModel;
          setSelectedClaudeModel(normalizedClaudeModel);
        }

        const savedCodexCustomModels = getCustomModels("codex-custom-models");
        if (
          CODEX_MODELS.find((m) => m.id === state.codexModel) ||
          savedCodexCustomModels.find((m) => m.id === state.codexModel)
        ) {
          restoredCodexModel = state.codexModel;
          setSelectedCodexModel(state.codexModel);
        }
      }

      const initialPermissionMode: PermissionMode = restoredProvider === "codex"
        ? restoredCodexPermissionMode
        : restoredClaudePermissionMode;
      setClaudePermissionMode(restoredClaudePermissionMode);
      setCodexPermissionMode(restoredCodexPermissionMode);
      setPermissionMode(initialPermissionMode);

      // Sync to backend — Tauri 后端命令可能未注册，静默忽略
      const syncToBackend = () => {
        sendBridgeEventQuiet("set_provider", restoredProvider);
        const modelToSync = restoredProvider === "codex"
          ? restoredCodexModel
          : apply1MContextSuffix(restoredClaudeModel, restoredLongContextEnabled);
        sendBridgeEventQuiet("set_model", modelToSync);
        sendBridgeEventQuiet("set_mode", initialPermissionMode);
        sendBridgeEventQuiet("set_codex_fast_mode", restoredCodexFastMode);
      };
      // 延迟 200ms 等待后端就绪
      const timer = setTimeout(syncToBackend, 200);
      return () => clearTimeout(timer);
    } catch {
      // Failed to load model selection state — fall back to defaults
    }
  }, []);

  // Persist snapshot whenever any of the keys change.
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        provider: currentProvider,
        claudeModel: selectedClaudeModel,
        codexModel: selectedCodexModel,
        claudePermissionMode,
        codexPermissionMode,
        longContextEnabled,
        reasoningEffort,
        codexFastMode,
      }));
    } catch {
      // Failed to save — non-fatal
    }
  }, [
    currentProvider,
    selectedClaudeModel,
    selectedCodexModel,
    claudePermissionMode,
    codexPermissionMode,
    longContextEnabled,
    reasoningEffort,
    codexFastMode,
  ]);
}
