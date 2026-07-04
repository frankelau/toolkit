// useSettingsBasicActions — 基础设置操作（对齐 cc-gui useSettingsBasicActions）
// Sprint U2: 深化实现 — 完整设置项管理 + bridge 同步 + localStorage 持久化

import { useState, useEffect, useCallback } from "react";
import { sendBridgeEventQuiet } from "../../../utils/bridge";
import {
  getSkipNewSessionConfirm,
  SKIP_NEW_SESSION_CONFIRM_EVENT,
} from "../../../utils/skipNewSessionConfirm";
import type { SkipNewSessionConfirmChangedDetail } from "../../../utils/skipNewSessionConfirm";

// ─── 类型 ────────────────────────────────────────────────────────────────────

export interface UseSettingsBasicActionsProps {
  streamingEnabledProp?: boolean;
  onStreamingEnabledChangeProp?: (enabled: boolean) => void;
  sendShortcutProp?: "enter" | "cmdEnter";
  onSendShortcutChangeProp?: (shortcut: "enter" | "cmdEnter") => void;
  autoOpenFileEnabledProp?: boolean;
  onAutoOpenFileEnabledChangeProp?: (enabled: boolean) => void;
  permissionDialogTimeoutSecondsProp?: number;
  onPermissionDialogTimeoutChangeProp?: (seconds: number) => void;
}

export interface UseSettingsBasicActionsReturn {
  // Node 路径
  nodePath: string;
  nodeVersion: string | null;
  minNodeVersion: number;
  savingNodePath: boolean;

  // CLI 路径
  claudeCliPath: string;
  savingClaudeCliPath: boolean;

  // 工作目录
  workingDirectory: string;
  savingWorkingDirectory: boolean;

  // 流式
  streamingEnabled: boolean;
  localStreamingEnabled: boolean;
  setStreamingEnabled: (v: boolean) => void;

  // 发送快捷键
  sendShortcut: "enter" | "cmdEnter";
  localSendShortcut: "enter" | "cmdEnter";
  setSendShortcut: (v: "enter" | "cmdEnter") => void;

  // 自动打开文件
  autoOpenFileEnabled: boolean;
  localAutoOpenFileEnabled: boolean;
  setAutoOpenFileEnabled: (v: boolean) => void;

  // Codex 沙箱模式
  codexSandboxMode: "workspace-write" | "danger-full-access";
  setCodexSandboxMode: (v: "workspace-write" | "danger-full-access") => void;

  // Commit Prompt
  commitPrompt: string;
  savingCommitPrompt: boolean;
  setCommitPrompt: (v: string) => void;
  saveCommitPrompt: () => void;

  // 项目级 Commit Prompt
  projectCommitPrompt: string;
  savingProjectCommitPrompt: boolean;
  setProjectCommitPrompt: (v: string) => void;
  saveProjectCommitPrompt: () => void;

  // 声音通知
  soundNotificationEnabled: boolean;
  soundOnlyWhenUnfocused: boolean;
  selectedSound: string;
  customSoundPath: string;

  // Diff 默认展开
  diffExpandedByDefault: boolean;
  setDiffExpandedByDefault: (v: boolean) => void;

  // 历史补全
  historyCompletionEnabled: boolean;
  setHistoryCompletionEnabled: (v: boolean) => void;

  // 跳过新会话确认
  skipNewSessionConfirm: boolean;
  setSkipNewSessionConfirm: (v: boolean) => void;

  // Commit 生成
  commitGenerationEnabled: boolean;
  setCommitGenerationEnabled: (v: boolean) => void;

  // AI 标题生成
  aiTitleGenerationEnabled: boolean;
  setAiTitleGenerationEnabled: (v: boolean) => void;

  // Node 路径操作
  setNodePath: (v: string) => void;
  saveNodePath: () => void;

  // CLI 路径操作
  setClaudeCliPath: (v: string) => void;
  saveClaudeCliPath: () => void;

  // 工作目录操作
  setWorkingDirectory: (v: string) => void;
  saveWorkingDirectory: () => void;
}

// ─── 默认值 ──────────────────────────────────────────────────────────────────

const DEFAULT_NODE_PATH = "";
const DEFAULT_CLAUDE_CLI_PATH = "";
const DEFAULT_WORKING_DIRECTORY = "";
const MIN_NODE_VERSION = 18;

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useSettingsBasicActions(
  props: UseSettingsBasicActionsProps = {},
): UseSettingsBasicActionsReturn {
  const {
    streamingEnabledProp,
    onStreamingEnabledChangeProp,
    sendShortcutProp,
    onSendShortcutChangeProp,
    autoOpenFileEnabledProp,
    onAutoOpenFileEnabledChangeProp,
  } = props;

  // Node 路径
  const [nodePath, setNodePath] = useState(DEFAULT_NODE_PATH);
  const [nodeVersion, _setNodeVersion] = useState<string | null>(null);
  const [savingNodePath, setSavingNodePath] = useState(false);

  // CLI 路径
  const [claudeCliPath, setClaudeCliPath] = useState(DEFAULT_CLAUDE_CLI_PATH);
  const [savingClaudeCliPath, setSavingClaudeCliPath] = useState(false);

  // 工作目录
  const [workingDirectory, setWorkingDirectory] = useState(DEFAULT_WORKING_DIRECTORY);
  const [savingWorkingDirectory, setSavingWorkingDirectory] = useState(false);

  // 流式
  const [localStreamingEnabled, setLocalStreamingEnabled] = useState(true);

  // 发送快捷键
  const [localSendShortcut, setLocalSendShortcut] = useState<"enter" | "cmdEnter">("enter");

  // 自动打开文件
  const [localAutoOpenFileEnabled, setLocalAutoOpenFileEnabled] = useState(false);

  // Codex 沙箱模式
  const [codexSandboxMode, setCodexSandboxMode] = useState<"workspace-write" | "danger-full-access">("workspace-write");

  // Commit Prompt
  const [commitPrompt, setCommitPrompt] = useState("");
  const [savingCommitPrompt, setSavingCommitPrompt] = useState(false);

  // 项目级 Commit Prompt
  const [projectCommitPrompt, setProjectCommitPrompt] = useState("");
  const [savingProjectCommitPrompt, setSavingProjectCommitPrompt] = useState(false);

  // 声音通知
  const [soundNotificationEnabled, _setSoundNotificationEnabled] = useState(true);
  const [soundOnlyWhenUnfocused, _setSoundOnlyWhenUnfocused] = useState(true);
  const [selectedSound, _setSelectedSound] = useState("default");
  const [customSoundPath, _setCustomSoundPath] = useState("");

  // Diff 默认展开
  const [diffExpandedByDefault, setDiffExpandedByDefault] = useState(true);

  // 历史补全
  const [historyCompletionEnabled, setHistoryCompletionEnabled] = useState(true);

  // 跳过新会话确认
  const [skipNewSessionConfirm, setSkipNewSessionConfirmState] = useState(getSkipNewSessionConfirm());

  // Commit 生成
  const [commitGenerationEnabled, setCommitGenerationEnabled] = useState(true);

  // AI 标题生成
  const [aiTitleGenerationEnabled, setAiTitleGenerationEnabled] = useState(true);

  // ─── 同步状态（优先使用 props，回退到 local）────────────────────────────────

  const streamingEnabled = streamingEnabledProp ?? localStreamingEnabled;
  const sendShortcut = sendShortcutProp ?? localSendShortcut;
  const autoOpenFileEnabled = autoOpenFileEnabledProp ?? localAutoOpenFileEnabled;

  // ─── 状态变更处理 ────────────────────────────────────────────────────────────

  const setStreamingEnabled = useCallback((v: boolean) => {
    if (onStreamingEnabledChangeProp) {
      onStreamingEnabledChangeProp(v);
    } else {
      setLocalStreamingEnabled(v);
      sendBridgeEventQuiet("set_streaming_enabled", JSON.stringify({ streamingEnabled: v }));
    }
  }, [onStreamingEnabledChangeProp]);

  const setSendShortcut = useCallback((v: "enter" | "cmdEnter") => {
    if (onSendShortcutChangeProp) {
      onSendShortcutChangeProp(v);
    } else {
      setLocalSendShortcut(v);
      sendBridgeEventQuiet("set_send_shortcut", JSON.stringify({ sendShortcut: v }));
    }
  }, [onSendShortcutChangeProp]);

  const setAutoOpenFileEnabled = useCallback((v: boolean) => {
    if (onAutoOpenFileEnabledChangeProp) {
      onAutoOpenFileEnabledChangeProp(v);
    } else {
      setLocalAutoOpenFileEnabled(v);
      sendBridgeEventQuiet("set_auto_open_file_enabled", JSON.stringify({ autoOpenFileEnabled: v }));
    }
  }, [onAutoOpenFileEnabledChangeProp]);

  const setSkipNewSessionConfirm = useCallback((v: boolean) => {
    setSkipNewSessionConfirmState(v);
    try {
      localStorage.setItem("skipNewSessionConfirm", v ? "true" : "false");
    } catch { /* ignore */ }
  }, []);

  // ─── 保存操作 ────────────────────────────────────────────────────────────────

  const saveNodePath = useCallback(() => {
    setSavingNodePath(true);
    sendBridgeEventQuiet("save_node_path", JSON.stringify({ path: nodePath }));
    setTimeout(() => setSavingNodePath(false), 1000);
  }, [nodePath]);

  const saveClaudeCliPath = useCallback(() => {
    setSavingClaudeCliPath(true);
    sendBridgeEventQuiet("save_claude_cli_path", JSON.stringify({ path: claudeCliPath }));
    setTimeout(() => setSavingClaudeCliPath(false), 1000);
  }, [claudeCliPath]);

  const saveWorkingDirectory = useCallback(() => {
    setSavingWorkingDirectory(true);
    sendBridgeEventQuiet("save_working_directory", JSON.stringify({ path: workingDirectory }));
    setTimeout(() => setSavingWorkingDirectory(false), 1000);
  }, [workingDirectory]);

  const saveCommitPrompt = useCallback(() => {
    setSavingCommitPrompt(true);
    sendBridgeEventQuiet("save_commit_prompt", JSON.stringify({ prompt: commitPrompt }));
    setTimeout(() => setSavingCommitPrompt(false), 1000);
  }, [commitPrompt]);

  const saveProjectCommitPrompt = useCallback(() => {
    setSavingProjectCommitPrompt(true);
    sendBridgeEventQuiet("save_project_commit_prompt", JSON.stringify({ prompt: projectCommitPrompt }));
    setTimeout(() => setSavingProjectCommitPrompt(false), 1000);
  }, [projectCommitPrompt]);

  // ─── 事件监听 ────────────────────────────────────────────────────────────────

  // 监听 skipNewSessionConfirm 变化
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<SkipNewSessionConfirmChangedDetail>).detail;
      setSkipNewSessionConfirmState(detail.enabled);
    };
    window.addEventListener(SKIP_NEW_SESSION_CONFIRM_EVENT, handler);
    return () => window.removeEventListener(SKIP_NEW_SESSION_CONFIRM_EVENT, handler);
  }, []);

  // 初始加载设置
  useEffect(() => {
    sendBridgeEventQuiet("get_node_path");
    sendBridgeEventQuiet("get_claude_cli_path");
    sendBridgeEventQuiet("get_working_directory");
    sendBridgeEventQuiet("get_commit_prompt");
    sendBridgeEventQuiet("get_codex_sandbox_mode");
  }, []);

  return {
    // Node 路径
    nodePath,
    nodeVersion,
    minNodeVersion: MIN_NODE_VERSION,
    savingNodePath,
    setNodePath,
    saveNodePath,

    // CLI 路径
    claudeCliPath,
    savingClaudeCliPath,
    setClaudeCliPath,
    saveClaudeCliPath,

    // 工作目录
    workingDirectory,
    savingWorkingDirectory,
    setWorkingDirectory,
    saveWorkingDirectory,

    // 流式
    streamingEnabled,
    localStreamingEnabled,
    setStreamingEnabled,

    // 发送快捷键
    sendShortcut,
    localSendShortcut,
    setSendShortcut,

    // 自动打开文件
    autoOpenFileEnabled,
    localAutoOpenFileEnabled,
    setAutoOpenFileEnabled,

    // Codex 沙箱
    codexSandboxMode,
    setCodexSandboxMode: (v: "workspace-write" | "danger-full-access") => {
      setCodexSandboxMode(v);
      sendBridgeEventQuiet("set_codex_sandbox_mode", v);
    },

    // Commit Prompt
    commitPrompt,
    savingCommitPrompt,
    setCommitPrompt,
    saveCommitPrompt,

    // 项目级 Commit Prompt
    projectCommitPrompt,
    savingProjectCommitPrompt,
    setProjectCommitPrompt,
    saveProjectCommitPrompt,

    // 声音通知
    soundNotificationEnabled,
    soundOnlyWhenUnfocused,
    selectedSound,
    customSoundPath,

    // Diff 默认展开
    diffExpandedByDefault,
    setDiffExpandedByDefault: (v: boolean) => {
      setDiffExpandedByDefault(v);
      sendBridgeEventQuiet("set_diff_expanded_by_default", JSON.stringify({ enabled: v }));
    },

    // 历史补全
    historyCompletionEnabled,
    setHistoryCompletionEnabled: (v: boolean) => {
      setHistoryCompletionEnabled(v);
      sendBridgeEventQuiet("set_history_completion_enabled", JSON.stringify({ enabled: v }));
    },

    // 跳过新会话确认
    skipNewSessionConfirm,
    setSkipNewSessionConfirm,

    // Commit 生成
    commitGenerationEnabled,
    setCommitGenerationEnabled: (v: boolean) => {
      setCommitGenerationEnabled(v);
      sendBridgeEventQuiet("set_commit_generation_enabled", JSON.stringify({ enabled: v }));
    },

    // AI 标题生成
    aiTitleGenerationEnabled,
    setAiTitleGenerationEnabled: (v: boolean) => {
      setAiTitleGenerationEnabled(v);
      sendBridgeEventQuiet("set_ai_title_generation_enabled", JSON.stringify({ enabled: v }));
    },
  };
}
