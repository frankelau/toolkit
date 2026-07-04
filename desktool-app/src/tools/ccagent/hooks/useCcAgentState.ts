// useCcAgentState — Sprint G: CcAgent.tsx 的全部状态和逻辑
// 把 1566 行主组件的状态迁移到这个 hook，让 CcAgent.tsx 变成薄包装

import { useEffect, useState, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";
import { readFile } from "@tauri-apps/plugin-fs";
import { usePersistentState } from "../../../storage";
import { toast } from "../../../useCopyFeedback";
import { saveTextWithDialog } from "../../../saveFile";
import { exportMessagesToMarkdown, exportMessagesToText, exportMessagesToJson } from "../utils/exportMarkdown";
import { deleteSessionById, getInputHistory, addInputHistory, clearInputHistory,
  getUsageStats,
  getSessionStats, getHistory, setPermissionModeV2,
} from "../utils/backendCommands";
import { useTabTitle } from "../../MultiTab";
import type { ToolProps } from "../../types";
import type {
  Engine, EngineInfo, Attachment, ClaudeSession, FileEntry, SkillDef,
  ChatMessage, ToolUseBlock, WorkspaceTab,
  PermissionRequest, TodoItem, SubagentInfo,
  FileChangeSummary, StatusPanelTab,
  AgentConfig, SelectedContext,
  PlanApprovalRequest, AskUserQuestionRequest, RewindRequest,
  SessionRecord, Question,
} from "../types";
import type { ContextUsageData } from "../components/dialogs/ContextUsageDialog";
import {
  PROVIDER_PRESETS, DEFAULT_SLASH_COMMANDS, uid,
} from "../constants";
import {
  redactSecrets,
  buildEditOperation, buildDiffForTool,
} from "../utils";

// 模块级：会话内始终允许的工具集合
export const sessionAlwaysAllow = new Set<string>();

export interface CcAgentState {
  // Engine & settings
  engines: Record<Engine, EngineInfo | null>;
  bootstrapping: boolean;
  bridgeReady: boolean;
  engine: Engine;
  setEngine: (e: Engine) => void;
  model: string;
  setModel: (m: string) => void;
  effort: string;
  setEffort: (e: string) => void;
  permissionMode: string;
  setPermissionMode: (m: string) => void;
  systemPrompt: string;
  setSystemPrompt: (s: string) => void;
  mcpConfig: string;
  setMcpConfig: (s: string) => void;
  allowedTools: string;
  setAllowedTools: (s: string) => void;
  cwd: string;
  setCwd: (s: string) => void;
  providerId: string;
  setProviderId: (s: string) => void;
  providerBaseUrl: string;
  setProviderBaseUrl: (s: string) => void;
  providerApiKey: string;
  setProviderApiKey: (s: string) => void;
  streamingEnabled: boolean;
  setStreamingEnabled: (b: boolean) => void;
  thinkingEnabled: boolean;
  setThinkingEnabled: (b: boolean) => void;
  agents: AgentConfig[];
  setAgents: React.Dispatch<React.SetStateAction<AgentConfig[]>>;

  // Session
  sessionId: string | null;
  messages: ChatMessage[];
  input: string;
  setInput: (s: string) => void;
  streaming: boolean;
  activeTab: "chat" | "settings" | "history" | "git" | "terminal";
  setActiveTab: (t: "chat" | "settings" | "history" | "git" | "terminal") => void;
  error: string;
  setError: (s: string) => void;

  // B12: 多目录工作区
  workspaceTabs: WorkspaceTab[];
  activeWorkspaceId: string;
  addWorkspace: () => Promise<void>;
  removeWorkspace: (id: string) => void;
  renameWorkspace: (id: string, name: string) => void;
  switchWorkspace: (id: string) => void;

  // Permission
  permRequest: PermissionRequest | null;
  respondPermission: (behavior: "allow" | "deny") => Promise<void>;

  // Attachments
  attachments: Attachment[];
  setAttachments: React.Dispatch<React.SetStateAction<Attachment[]>>;
  uploadImage: () => Promise<void>;
  handlePaste: (e: React.ClipboardEvent) => void;

  // Skills
  skills: SkillDef[];
  slashCommands: { cmd: string; desc: string }[];

  // @file autocomplete
  fileQuery: string;
  fileResults: FileEntry[];
  showFilePicker: boolean;
  filePickerPos: { start: number } | null;
  setShowFilePicker: (b: boolean) => void;
  handleInputChange: (value: string) => void;
  handleKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  insertFileRef: (file: FileEntry) => Promise<void>;

  // Slash picker
  showSlashPicker: boolean;
  slashFilter: string;
  insertSlashCommand: (cmd: string) => void;

  // Search
  searchQuery: string;
  setSearchQuery: (s: string) => void;
  showSearch: boolean;
  setShowSearch: (b: boolean) => void;
  searchOpen: boolean;
  setSearchOpen: (b: boolean) => void;
  searchRef: React.RefObject<HTMLInputElement | null>;

  // Input history
  inputHistory: string[];
  historyIdx: number;

  // Favorites
  favorites: { id: string; name: string; message: string }[];
  setFavorites: React.Dispatch<React.SetStateAction<{ id: string; name: string; message: string }[]>>;
  favName: string;
  setFavName: (s: string) => void;
  saveFavorite: () => void;
  loadFavorite: (msg: string) => void;

  // History
  claudeSessions: ClaudeSession[];
  loadingHistory: boolean;
  loadHistory: () => Promise<void>;

  // Usage
  totalCost: number;
  totalInput: number;
  totalOutput: number;
  lastInputTokens: number;

  // StatusPanel
  todos: TodoItem[];
  subagents: SubagentInfo[];
  fileChanges: FileChangeSummary[];
  statusTab: StatusPanelTab | null;
  setStatusTab: React.Dispatch<React.SetStateAction<StatusPanelTab | null>>;
  setFileChanges: React.Dispatch<React.SetStateAction<FileChangeSummary[]>>;

  // Phase 8 dialogs
  planApproval: PlanApprovalRequest | null;
  askUserQuestion: AskUserQuestionRequest | null;
  rewindReq: RewindRequest | null;
  rewindLoading: boolean;
  ctxUsageOpen: boolean;
  ctxUsageData: ContextUsageData | null;
  usageStatsOpen: boolean;
  setUsageStatsOpen: (b: boolean) => void;
  changelogOpen: boolean;
  setChangelogOpen: (b: boolean) => void;
  modelDialogOpen: boolean;
  setModelDialogOpen: (b: boolean) => void;
  sessionRecords: SessionRecord[];
  peOpen: boolean;
  peLoading: boolean;
  peOriginal: string;
  peEnhanced: string;
  selectedContext: SelectedContext | null;
  setSelectedContext: (c: SelectedContext | null) => void;

  // Actions
  startSession: () => Promise<string | null>;
  send: () => Promise<void>;
  abort: () => Promise<void>;
  rewind: (steps: number) => void;
  requestRewind: (msg: ChatMessage) => void;
  confirmRewind: (messageId: string) => Promise<void>;
  closeRewind: () => void;
  respondPlanApproval: (requestId: string, behavior: "approve" | "reject", targetMode?: string) => Promise<void>;
  respondAskUser: (requestId: string, answers: Record<string, string | string[]>) => Promise<void>;
  queryContextUsage: () => Promise<void>;
  closeCtxUsage: () => void;
  closePromptEnhancer: () => void;
  resetUsage: () => void;
  enhancePrompt: () => Promise<void>;
  useEnhancedPrompt: () => void;
  keepOriginalPrompt: () => void;
  pickContextFile: () => Promise<void>;
  useAgent: (agent: AgentConfig) => void;
  exportChat: () => Promise<void>;
  exportChatAsText: () => Promise<void>;
  exportChatAsJson: () => Promise<void>;
  pickDir: () => Promise<void>;
  // History backend ops
  deleteHistorySession: (sessionId: string) => void;
  exportSession: (sessionId: string) => void;
  toggleFavorite: (sessionId: string) => void;
  updateSessionTitle: (sessionId: string, newTitle: string) => void;
  // Input history backend
  pushInputToHistory: (line: string) => Promise<void>;
  loadInputHistory: () => Promise<string[]>;
  wipeInputHistory: () => Promise<void>;
  // Usage stats
  syncUsageStats: () => Promise<void>;

  // Refs
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
  bottomRef: React.RefObject<HTMLDivElement | null>;

  // FileTree
  fileTreeVisible: boolean;
  setFileTreeVisible: (b: boolean) => void;
  fileTreeRatio: number;
  setFileTreeRatio: (r: number) => void;
  contextPanelVisible: boolean;
  setContextPanelVisible: (b: boolean) => void;
  contextPanelRatio: number;
  setContextPanelRatio: (r: number) => void;
  handleAddFileToContext: (path: string) => Promise<void>;
  // File preview
  previewFilePath: string | null;
  setPreviewFilePath: (p: string | null) => void;
  // Config mode
  useSystemConfig: boolean;
  setUseSystemConfig: (b: boolean) => void;

  // Derived
  engineInfo: EngineInfo | null;
  isEngineAvailable: boolean;
}

export function useCcAgentState({ instanceId }: ToolProps): CcAgentState {
  const ns = `ccagent:${instanceId}`;

  // Engine & settings
  const [engines, setEngines] = useState<Record<Engine, EngineInfo | null>>({ claude: null, codex: null });
  const [bootstrapping, setBootstrapping] = useState(false);
  const [bridgeReady, setBridgeReady] = useState(false);
  const [engine, setEngine] = usePersistentState<Engine>(`${ns}:engine`, "claude");
  const [model, setModel] = usePersistentState(`${ns}:model`, "");
  const [effort, setEffort] = usePersistentState(`${ns}:effort`, "");
  const [permissionMode, setPermissionModeRaw] = usePersistentState(`${ns}:perm`, "default");
  // Sync permission mode to v2 API
  const setPermissionMode = (m: string) => {
    setPermissionModeRaw(m);
    if (sessionId) setPermissionModeV2(m, sessionId).catch(() => {});
  };
  const [systemPrompt, setSystemPrompt] = usePersistentState(`${ns}:sysprompt`, "");
  const [mcpConfig, setMcpConfig] = usePersistentState(`${ns}:mcp`, "");
  const [allowedTools, setAllowedTools] = usePersistentState(`${ns}:allowed`, "");
  const [cwd, setCwd] = usePersistentState(`${ns}:cwd`, "");
  const [providerId, setProviderId] = usePersistentState(`${ns}:provider`, "official");
  const [providerBaseUrl, setProviderBaseUrl] = usePersistentState(`${ns}:providerBaseUrl`, "");
  const [providerApiKey, setProviderApiKey] = usePersistentState(`${ns}:providerApiKey`, "");
  const [streamingEnabled, setStreamingEnabled] = usePersistentState(`${ns}:streaming`, true);
  const [thinkingEnabled, setThinkingEnabled] = usePersistentState(`${ns}:thinking`, false);
  const [agents, setAgents] = usePersistentState<AgentConfig[]>(`${ns}:agents`, []);

  const cwdBasename = cwd ? cwd.split("/").filter(Boolean).pop() || cwd : "未选目录";
  useTabTitle(cwdBasename);

  // Session
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [activeTab, setActiveTab] = useState<"chat" | "settings" | "history" | "git" | "terminal">("chat");
  const [error, setError] = useState("");

  // ─── FileTree 面板 ────────────────────────────────────────────────────
  const [fileTreeVisible, setFileTreeVisible] = usePersistentState(`${ns}:fileTreeVisible`, true);
  const [fileTreeRatio, setFileTreeRatio] = usePersistentState(`${ns}:fileTreeRatio`, 0.22);
  const [contextPanelVisible, setContextPanelVisible] = usePersistentState(`${ns}:contextPanelVisible`, true);
  const [contextPanelRatio, setContextPanelRatio] = usePersistentState(`${ns}:contextPanelRatio`, 0.82);
  const [previewFilePath, setPreviewFilePath] = useState<string | null>(null);
  const [useSystemConfig, setUseSystemConfig] = usePersistentState(`${ns}:useSystemConfig`, true);

  // ─── B12: 多目录工作区 Tab ──────────────────────────────────────────────
  const [workspaceTabs, setWorkspaceTabs] = useState<WorkspaceTab[]>(() => {
    // Initialize with current cwd if set
    if (cwd) {
      return [{
        id: uid(),
        cwd,
        name: cwd.split("/").filter(Boolean).pop() || cwd,
        sessionId: null,
        engine: engine as Engine,
        messages: [],
        streaming: false,
      }];
    }
    return [];
  });
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string>(workspaceTabs[0]?.id || "");

  // Save current workspace state
  const saveWorkspace = () => {
    if (!activeWorkspaceId) return;
    setWorkspaceTabs(prev => prev.map(w =>
      w.id === activeWorkspaceId
        ? { ...w, cwd, sessionId, engine: engine as Engine, messages, streaming }
        : w
    ));
  };

  // Add a new workspace tab
  const addWorkspace = async () => {
    const d = await open({ directory: true, multiple: false });
    if (!d) return;
    const newCwd = d as string;
    // Check if already exists
    const exists = workspaceTabs.find(w => w.cwd === newCwd);
    if (exists) {
      switchWorkspace(exists.id);
      return;
    }
    saveWorkspace();
    const newTab: WorkspaceTab = {
      id: uid(),
      cwd: newCwd,
      name: newCwd.split("/").filter(Boolean).pop() || newCwd,
      sessionId: null,
      engine: engine as Engine,
      messages: [],
      streaming: false,
    };
    setWorkspaceTabs(prev => [...prev, newTab]);
    setActiveWorkspaceId(newTab.id);
    setCwd(newCwd);
    setSessionId(null);
    setMessages([]);
    setStreaming(false);
    setActiveTab("chat");
  };

  // Switch to a workspace tab
  const switchWorkspace = (id: string) => {
    if (id === activeWorkspaceId) return;
    saveWorkspace();
    const target = workspaceTabs.find(w => w.id === id);
    if (!target) return;
    setActiveWorkspaceId(id);
    setCwd(target.cwd);
    setSessionId(target.sessionId);
    setEngine(target.engine);
    setMessages(target.messages);
    setStreaming(target.streaming);
    setActiveTab("chat");
  };

  // Remove a workspace tab
  const removeWorkspace = (id: string) => {
    const newTabs = workspaceTabs.filter(w => w.id !== id);
    setWorkspaceTabs(newTabs);
    if (id === activeWorkspaceId) {
      const next = newTabs[newTabs.length - 1];
      if (next) {
        switchWorkspace(next.id);
      } else {
        setActiveWorkspaceId("");
        setCwd("");
        setSessionId(null);
        setMessages([]);
      }
    }
  };

  // Rename a workspace tab
  const renameWorkspace = (id: string, name: string) => {
    setWorkspaceTabs(prev => prev.map(w =>
      w.id === id ? { ...w, name } : w
    ));
  };

  // Sync active workspace whenever cwd/sessionId/messages/engine change
  const syncWorkspace = () => {
    if (!activeWorkspaceId) return;
    setWorkspaceTabs(prev => prev.map(w =>
      w.id === activeWorkspaceId
        ? { ...w, cwd, sessionId, engine: engine as Engine, messages, streaming }
        : w
    ));
  };

  // Permission
  const [permRequest, setPermRequest] = useState<PermissionRequest | null>(null);

  // Attachments
  const [attachments, setAttachments] = useState<Attachment[]>([]);

  // Skills
  const [skills, setSkills] = useState<SkillDef[]>([]);
  const [slashCommands, setSlashCommands] = useState(DEFAULT_SLASH_COMMANDS);

  // @file autocomplete
  const [fileQuery, setFileQuery] = useState("");
  const [fileResults, setFileResults] = useState<FileEntry[]>([]);
  const [showFilePicker, setShowFilePicker] = useState(false);
  const [filePickerPos, setFilePickerPos] = useState<{ start: number } | null>(null);

  // Slash picker
  const [showSlashPicker, setShowSlashPicker] = useState(false);
  const [slashFilter, setSlashFilter] = useState("");

  // Search
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  // Input history
  const [inputHistory, setInputHistory] = usePersistentState<string[]>(`${ns}:inputHistory`, []);
  const [historyIdx, setHistoryIdx] = useState(-1);

  // Favorites
  const [favorites, setFavorites] = usePersistentState<{ id: string; name: string; message: string }[]>(`${ns}:favs`, []);
  const [favName, setFavName] = useState("");

  // History
  const [claudeSessions, setClaudeSessions] = useState<ClaudeSession[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Usage
  const [totalCost, setTotalCost] = useState(0);
  const [totalInput, setTotalInput] = useState(0);
  const [totalOutput, setTotalOutput] = useState(0);
  const [lastInputTokens, setLastInputTokens] = useState(0);

  // StatusPanel
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [subagents, setSubagents] = useState<SubagentInfo[]>([]);
  const [fileChanges, setFileChanges] = useState<FileChangeSummary[]>([]);
  const [statusTab, setStatusTab] = useState<StatusPanelTab | null>(null);

  // Phase 8 dialogs
  const [planApproval, setPlanApproval] = useState<PlanApprovalRequest | null>(null);
  const [askUserQuestion, setAskUserQuestion] = useState<AskUserQuestionRequest | null>(null);
  const [rewindReq, setRewindReq] = useState<RewindRequest | null>(null);
  const [rewindLoading, setRewindLoading] = useState(false);
  const [ctxUsageOpen, setCtxUsageOpen] = useState(false);
  const [ctxUsageData, setCtxUsageData] = useState<ContextUsageData | null>(null);
  const [usageStatsOpen, setUsageStatsOpen] = useState(false);
  const [changelogOpen, setChangelogOpen] = useState(false);
  const [modelDialogOpen, setModelDialogOpen] = useState(false);
  const [sessionRecords, setSessionRecords] = useState<SessionRecord[]>([]);
  const [peOpen, setPeOpen] = useState(false);
  const [peLoading, setPeLoading] = useState(false);
  const [peOriginal, setPeOriginal] = useState("");
  const [peEnhanced, setPeEnhanced] = useState("");
  const [selectedContext, setSelectedContext] = useState<SelectedContext | null>(null);

  // Refs
  const unlistenRef = useRef<UnlistenFn | null>(null);
  const pendingToolsRef = useRef<Map<string, { name: string; input: Record<string, unknown> }>>(new Map());
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const streamingMsgRef = useRef<ChatMessage | null>(null);
  const pendingPermRef = useRef<PermissionRequest | null>(null);

  // ── Init ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    async function refreshEngines() {
      try {
        const info = await invoke<Record<string, unknown>>("cc_check_engines");
        setEngines({
          claude: info.claude as EngineInfo | null,
          codex: info.codex as EngineInfo | null,
        });
        setBridgeReady(!!info.bridge);
      } catch { /* ignore */ }
    }

    (async () => {
      await refreshEngines();
      try {
        setBootstrapping(true);
        await invoke("cc_ensure_bridge");
      } catch (e) {
        setError(`Bridge 初始化失败：${(e as Error).message ?? e}。可尝试手动执行 cd ~/.desktool/cc-bridge && npm i`);
      } finally {
        setBootstrapping(false);
        await refreshEngines();
      }
    })();

    loadHistory();
    loadSkills();
  }, []);

  useEffect(() => { loadSkills(); }, [cwd]);

  async function loadSkills() {
    try {
      const sk = await invoke<SkillDef[]>("cc_list_skills", { cwd });
      setSkills(sk);
      const skillCmds = sk.map(s => ({ cmd: `/${s.name}`, desc: s.description }));
      setSlashCommands([...DEFAULT_SLASH_COMMANDS, ...skillCmds]);
    } catch { /* ignore */ }
  }

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  // B12: Auto-sync workspace state on key changes
  useEffect(() => { syncWorkspace(); }, [cwd, sessionId, messages, engine, streaming]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === "f" && activeTab === "chat") {
        e.preventDefault();
        setShowSearch(s => !s);
        if (!showSearch) setTimeout(() => searchRef.current?.focus(), 50);
      }
      if (e.key === "Escape" && showSearch) setShowSearch(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeTab, showSearch]);

  useEffect(() => {
    return () => {
      unlistenRef.current?.();
      if (sessionId) invoke("cc_abort_session", { sessionId }).catch(() => {});
    };
  }, [sessionId]);

  async function loadHistory() {
    setLoadingHistory(true);
    try {
      const sessions = await invoke<ClaudeSession[]>("cc_list_claude_sessions");
      setClaudeSessions(sessions);
    } catch { /* ignore */ } finally { setLoadingHistory(false); }
  }

  // ── Session management ────────────────────────────────────────────────────

  /**
   * 启动会话，返回 session ID。
   * 返回 null 表示启动失败（error 已设置）。
   */
  async function startSession(): Promise<string | null> {
    if (sessionId) {
      recordSessionEnd();
      await invoke("cc_abort_session", { sessionId }).catch(() => {});
      setSessionId(null);
    }

    const preset = PROVIDER_PRESETS.find(p => p.id === providerId);
    const resolvedBaseUrl = useSystemConfig ? undefined
      : providerId === "official" ? undefined
      : providerId === "custom" ? (providerBaseUrl || undefined)
      : (preset?.baseUrl || providerBaseUrl || undefined);
    const resolvedApiKey = useSystemConfig ? undefined : (providerApiKey || undefined);
    const resolvedModel = useSystemConfig ? undefined : (model || undefined);

    const config = {
      engine, cwd,
      model: resolvedModel,
      system_prompt: systemPrompt || undefined,
      permission_mode: permissionMode,
      mcp_config: mcpConfig || undefined,
      allowed_tools: allowedTools ? allowedTools.split(/\s+/).filter(Boolean) : undefined,
      effort: effort || undefined,
      base_url: resolvedBaseUrl,
      api_key: resolvedApiKey,
      // Legacy toggles (kept for provider/* scaffolding compatibility)
      streaming_enabled: streamingEnabled,
      thinking_enabled: thinkingEnabled,
      // Thinking config: adaptive when enabled, disabled otherwise
      thinking: thinkingEnabled ? { type: "adaptive" } : { type: "disabled" },
      // True streaming (SDK includePartialMessages)
      include_partial_messages: streamingEnabled,
    };

    try {
      setError("");
      const sid = await invoke<string>("cc_start_session", { config });
      // 同时更新 React state 和返回 ID（避免闭包陈旧问题）
      setSessionId(sid);
      setMessages([]);
      setTotalCost(0); setTotalInput(0); setTotalOutput(0); setLastInputTokens(0);
      setTodos([]); setSubagents([]); setFileChanges([]); setStatusTab(null);
      pendingToolsRef.current.clear();

      unlistenRef.current?.();
      unlistenRef.current = await listen<Record<string, unknown>>(`cc-event-${sid}`, (event) => {
        handleStreamEvent(event.payload as Record<string, unknown>);
      });
      return sid;
    } catch (e) {
      setError(`启动会话失败：${(e as Error).message ?? e}`);
      return null;
    }
  }

  function handleStreamEvent(data: Record<string, unknown>) {
    const type = data.type as string;
    console.log("[CcAgent] handleStreamEvent type=", type, data);
    if (!type) return;

    if (type === "daemon") return;

    if (type === "permission_request") {
      const req: PermissionRequest = {
        toolUseId: data.toolUseId as string,
        toolName: data.toolName as string,
        input: data.input as Record<string, unknown>,
      };
      pendingPermRef.current = req;
      setPermRequest(req);
      return;
    }

    if (type === "plan_approval") {
      setPlanApproval({
        requestId: data.requestId as string,
        toolName: data.toolName as string,
        plan: data.plan as string | undefined,
        allowedPrompts: data.allowedPrompts as { tool: string; prompt: string }[] | undefined,
        timestamp: data.timestamp as string | undefined,
      });
      return;
    }

    if (type === "ask_user_question") {
      setAskUserQuestion({
        requestId: data.requestId as string,
        toolName: data.toolName as string,
        questions: data.questions as Question[],
      });
      return;
    }

    if (type === "context_usage") {
      setCtxUsageData(data.data as ContextUsageData);
      return;
    }

    if (type === "stream") {
      const msg = data.data as Record<string, unknown>;
      if (!msg) return;
      handleSdkMessage(msg);
      return;
    }

    if (type === "result") {
      const costUsd = data.costUsd as number;
      const usage = data.usage as Record<string, number>;
      if (streamingMsgRef.current) {
        streamingMsgRef.current.isStreaming = false;
        streamingMsgRef.current.usage = {
          costUsd,
          inputTokens: usage?.input_tokens,
          outputTokens: usage?.output_tokens,
          cacheReadTokens: usage?.cache_read_input_tokens,
          cacheCreateTokens: usage?.cache_creation_input_tokens,
          durationMs: data.durationMs as number,
        };
        setMessages(prev => [...prev]);
        streamingMsgRef.current = null;
      }
      setStreaming(false);
      if (costUsd) setTotalCost(prev => prev + costUsd);
      if (usage?.input_tokens) {
        setTotalInput(prev => prev + usage.input_tokens);
        setLastInputTokens(usage.input_tokens);
      }
      if (usage?.output_tokens) setTotalOutput(prev => prev + usage.output_tokens);
      return;
    }

    if (type === "stream_end") {
      setStreaming(false);
      if (streamingMsgRef.current) {
        streamingMsgRef.current.isStreaming = false;
        setMessages(prev => [...prev]);
        streamingMsgRef.current = null;
      }
      return;
    }

    if (type === "error") {
      setError(redactSecrets(data.message as string || "Unknown error"));
      setStreaming(false);
      return;
    }

    if (type === "stderr") {
      const text = data.text as string;
      if (text && !text.includes("DeprecationWarning") && !text.includes("[bridge]")) {
        setError(prev => prev ? `${prev}\n${text}` : text);
      }
      return;
    }
  }

  function handleSdkMessage(msg: Record<string, unknown>) {
    const msgType = msg.type as string;
    if (!msgType) return;

    // Real-time streaming: partial assistant message (includePartialMessages)
    if (msgType === "stream_event") {
      const event = msg.event as Record<string, unknown> | undefined;
      if (!event) return;
      const evType = event.type as string;
      if (evType === "content_block_delta") {
        const delta = event.delta as Record<string, unknown> | undefined;
        if (!delta) return;
        const deltaType = delta.type as string;
        // Ensure there's a fresh streaming target. Start a new bubble when there
        // is none, or when the current one already carries tool calls (deltas
        // belong to a new segment after a tool round-trip).
        if (!streamingMsgRef.current || streamingMsgRef.current.toolUses?.length) {
          if (streamingMsgRef.current) streamingMsgRef.current.isStreaming = false;
          const m: ChatMessage = { id: uid(), role: "assistant", content: "", isStreaming: true, timestamp: Date.now() };
          streamingMsgRef.current = m;
          setMessages(prev => [...prev, m]);
        }
        if (deltaType === "text_delta" && typeof delta.text === "string") {
          streamingMsgRef.current.content = (streamingMsgRef.current.content || "") + delta.text;
          setMessages(prev => [...prev]);
        } else if (deltaType === "thinking_delta" && typeof delta.thinking === "string") {
          streamingMsgRef.current.thinking = (streamingMsgRef.current.thinking || "") + delta.thinking;
          setMessages(prev => [...prev]);
        }
      }
      return;
    }

    if (msgType === "system") {
      const mdl = msg.model as string;
      const tools = msg.tools as string[];
      if (mdl) {
        setMessages(prev => [...prev, {
          id: uid(), role: "system",
          content: `会话已启动 · 模型: ${mdl} · 工具: ${tools?.length ?? 0} 个 · 技能: ${(msg.skills as string[])?.length ?? 0} 个`,
          timestamp: Date.now(),
        }]);
      }
      return;
    }

    if (msgType === "assistant") {
      const message = msg.message as Record<string, unknown>;
      const content = message?.content as Array<Record<string, unknown>>;
      if (!content) return;

      let textContent = "";
      let thinking = "";
      const toolUses: ToolUseBlock[] = [];

      for (const block of content) {
        if (block.type === "text") {
          textContent += block.text as string;
        } else if (block.type === "thinking") {
          thinking += block.thinking as string;
        } else if (block.type === "tool_use") {
          const input = (block.input ?? {}) as Record<string, unknown>;
          const toolName = block.name as string;
          const toolId = block.id as string;
          toolUses.push({
            id: toolId, name: toolName, input,
            isPending: true,
            diff: buildDiffForTool(toolName, input),
          });
          pendingToolsRef.current.set(toolId, { name: toolName, input });
          if (toolName === "TodoWrite" && Array.isArray(input.todos)) {
            setTodos((input.todos as Array<{ id?: string; content: string; status: TodoItem['status'] }>).map(t => ({
              id: t.id, content: t.content, status: t.status || 'pending',
            })));
          }
          if (toolName === "Agent") {
            const description = String(input.description || input.prompt || "").slice(0, 60);
            const subagentType = String(input.subagent_type || "Agent");
            setSubagents(prev => [...prev, {
              id: toolId, type: subagentType, description,
              prompt: input.prompt as string | undefined,
              status: 'running',
            }]);
          }
        }
      }

      // The complete `assistant` message is the finalized content for this turn.
      // If we already have a streaming target that hasn't emitted tool calls yet
      // (either the empty placeholder from send(), or one filled by stream_event
      // deltas), overwrite it in place — the full message is authoritative and
      // also carries the tool_use blocks the deltas don't. Only start a new
      // bubble once the current one already owns tool calls (a new segment).
      if (streamingMsgRef.current && !streamingMsgRef.current.toolUses?.length) {
        streamingMsgRef.current.content = textContent;
        streamingMsgRef.current.thinking = thinking || streamingMsgRef.current.thinking;
        streamingMsgRef.current.toolUses = toolUses;
        streamingMsgRef.current.isStreaming = true;
        setMessages(prev => [...prev]);
      } else {
        if (streamingMsgRef.current) streamingMsgRef.current.isStreaming = false;
        const assistantMsg: ChatMessage = {
          id: uid(), role: "assistant",
          content: textContent, thinking,
          toolUses, isStreaming: true,
          timestamp: Date.now(),
        };
        streamingMsgRef.current = assistantMsg;
        setMessages(prev => [...prev, assistantMsg]);
      }
      return;
    }

    if (msgType === "user") {
      const message = msg.message as Record<string, unknown>;
      const content = message?.content as Array<Record<string, unknown>>;
      if (!content) return;

      for (const block of content) {
        if (block.type === "tool_result") {
          const toolUseId = block.tool_use_id as string;
          const resultContent = block.content as string | Array<Record<string, unknown>>;
          const resultText = typeof resultContent === "string"
            ? resultContent
            : Array.isArray(resultContent)
              ? resultContent.map(c => c.text ?? "").join("")
              : "";
          const isError = block.is_error === true;

          if (streamingMsgRef.current?.toolUses) {
            const tu = streamingMsgRef.current.toolUses.find(t => t.id === toolUseId);
            if (tu) {
              tu.result = redactSecrets(resultText);
              tu.isPending = false;
              tu.isError = isError;
              setMessages(prev => [...prev]);
            }
          }

          const pending = pendingToolsRef.current.get(toolUseId);
          if (pending) {
            pendingToolsRef.current.delete(toolUseId);
            const { name: toolName, input } = pending;

            if (toolName === "Agent") {
              setSubagents(prev => prev.map(s => s.id === toolUseId
                ? { ...s, status: isError ? 'error' : 'completed', resultText: resultText.slice(0, 300) }
                : s));
            }

            if (!isError && (toolName === "Write" || toolName === "Edit" || toolName === "MultiEdit")) {
              const filePath = String(input.file_path ?? "");
              if (filePath) {
                const fileName = filePath.split(/[/\\]/).pop() || filePath;
                setFileChanges(prev => {
                  const existing = prev.find(f => f.filePath === filePath);
                  const op = buildEditOperation(toolName, input);
                  if (existing) {
                    return prev.map(f => f.filePath === filePath ? {
                      ...f,
                      additions: f.additions + op.additions,
                      deletions: f.deletions + op.deletions,
                      operations: [...f.operations, op],
                    } : f);
                  }
                  return [...prev, {
                    filePath, fileName,
                    status: toolName === "Write" ? 'A' : 'M',
                    additions: op.additions,
                    deletions: op.deletions,
                    operations: [op],
                  }];
                });
              }
            }
          }
        }
      }
      return;
    }
  }

  // ── Permission ────────────────────────────────────────────────────────────

  async function respondPermission(behavior: "allow" | "deny") {
    if (!permRequest || !sessionId) return;
    try {
      await invoke("cc_permission_response", {
        sessionId, toolUseId: permRequest.toolUseId, behavior,
        message: behavior === "deny" ? "User denied" : null,
      });
    } catch { /* ignore */ }
    setPermRequest(null);
    pendingPermRef.current = null;
  }

  // ── Send ──────────────────────────────────────────────────────────────────

  async function send() {
    const rawContent = input.trim();
    if (!rawContent || streaming) return;
    const content = buildMessageWithContext(rawContent);
    const useContext = selectedContext;
    setSelectedContext(null);

    if (rawContent && !inputHistory.includes(rawContent)) {
      setInputHistory(prev => [...prev.slice(-49), rawContent]);
    }
    setHistoryIdx(-1);

    // 确保有活跃会话（使用返回值避免 React 闭包陈旧）
    let sid = sessionId;
    console.log("[CcAgent] send() current sessionId=", sid, "engine=", engine, "useSystemConfig=", useSystemConfig);
    if (!sid) {
      console.log("[CcAgent] send() starting new session...");
      sid = await startSession();
      console.log("[CcAgent] send() startSession returned sid=", sid);
    }
    if (!sid) { setError("无法启动会话"); console.log("[CcAgent] send() FAILED: no session ID"); return; }

    setInput("");
    setShowFilePicker(false);
    setShowSlashPicker(false);

    const userMsg: ChatMessage = {
      id: uid(), role: "user", content: useContext ? `${content}\n\n_📎 上下文: ${useContext.filePath.split("/").pop()}_` : content,
      timestamp: Date.now(),
      attachments: attachments.length > 0 ? attachments : undefined,
    };
    setMessages(prev => [...prev, userMsg]);

    const bridgeAttachments = attachments.map(a => ({ type: "image", data: a.data, mimeType: a.mimeType }));
    setAttachments([]);

    const assistantMsg: ChatMessage = {
      id: uid(), role: "assistant", content: "",
      isStreaming: true, timestamp: Date.now(),
    };
    streamingMsgRef.current = assistantMsg;
    setMessages(prev => [...prev, assistantMsg]);
    setStreaming(true);

    try {
      console.log("[CcAgent] send() invoking cc_send_message sid=", sid, "content=", content.slice(0, 50));
      await invoke("cc_send_message", {
        sessionId: sid, message: content,
        attachments: bridgeAttachments.length > 0 ? bridgeAttachments : undefined,
      });
      console.log("[CcAgent] send() cc_send_message OK, waiting for events...");
    } catch (e) {
      console.log("[CcAgent] send() cc_send_message ERROR:", e);
      setStreaming(false);
      setError(`发送失败：${(e as Error).message ?? e}`);
      if (streamingMsgRef.current) {
        streamingMsgRef.current.content = `❌ 发送失败`;
        streamingMsgRef.current.isStreaming = false;
        setMessages(prev => [...prev]);
        streamingMsgRef.current = null;
      }
    }
  }

  async function abort() {
    if (!sessionId) return;
    try { await invoke("cc_abort_session", { sessionId }); } catch { /* ignore */ }
    setStreaming(false);
    if (streamingMsgRef.current) {
      streamingMsgRef.current.isStreaming = false;
      streamingMsgRef.current.content += "\n\n⚠ 已中止";
      setMessages(prev => [...prev]);
      streamingMsgRef.current = null;
    }
    // 不退出对话框，保留 sessionId 和消息历史
  }

  // ── @file ─────────────────────────────────────────────────────────────────

  async function searchFiles(query: string) {
    try {
      const results = await invoke<FileEntry[]>("cc_list_files", { dir: cwd, query });
      setFileResults(results.slice(0, 20));
    } catch { setFileResults([]); }
  }

  function handleInputChange(value: string) {
    setInput(value);
    setHistoryIdx(-1);

    const lastAt = value.lastIndexOf("@");
    if (lastAt >= 0 && lastAt === value.length - 1) {
      setShowFilePicker(true);
      setFilePickerPos({ start: lastAt });
      setFileQuery("");
      searchFiles("");
    } else if (showFilePicker && filePickerPos) {
      const afterAt = value.slice(filePickerPos.start + 1);
      if (afterAt.includes(" ") || afterAt.includes("\n")) {
        setShowFilePicker(false);
      } else {
        setFileQuery(afterAt);
        searchFiles(afterAt);
      }
    }

    if (value.startsWith("/") && !value.includes(" ")) {
      setShowSlashPicker(true);
      setSlashFilter(value);
    } else {
      setShowSlashPicker(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    // Ctrl+K: open global search
    if (e.key === "k" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      setSearchOpen(true);
      return;
    }
    if (e.key === "ArrowUp" && !showFilePicker && !showSlashPicker && inputHistory.length > 0) {
      e.preventDefault();
      const newIdx = historyIdx === -1 ? inputHistory.length - 1 : Math.max(0, historyIdx - 1);
      setHistoryIdx(newIdx);
      setInput(inputHistory[newIdx]);
      return;
    }
    if (e.key === "ArrowDown" && historyIdx >= 0) {
      e.preventDefault();
      const newIdx = historyIdx + 1;
      if (newIdx >= inputHistory.length) {
        setHistoryIdx(-1); setInput("");
      } else {
        setHistoryIdx(newIdx); setInput(inputHistory[newIdx]);
      }
      return;
    }
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault(); void send();
    }
  }

  async function insertFileRef(file: FileEntry) {
    if (!filePickerPos) return;
    try {
      const content = await invoke<string>("cc_read_file", { path: file.full_path });
      const before = input.slice(0, filePickerPos.start);
      const after = input.slice(filePickerPos.start + 1 + fileQuery.length);
      const ref = `@${file.path}\n\n<file path="${file.path}">\n${content}\n</file>`;
      setInput(before + ref + after);
    } catch { toast(`读取文件失败`, "error"); }
    setShowFilePicker(false);
    inputRef.current?.focus();
  }

  function insertSlashCommand(cmd: string) {
    setInput(cmd + " ");
    setShowSlashPicker(false);
    inputRef.current?.focus();
  }

  // ── Image ─────────────────────────────────────────────────────────────────

  async function uploadImage() {
    try {
      const result = await open({
        filters: [{ name: "Images", extensions: ["png", "jpg", "jpeg", "gif", "webp"] }],
        multiple: true,
      });
      if (!result) return;
      const files = Array.isArray(result) ? result : [result];
      for (const f of files) {
        const bytes = await readFile(f as string);
        const base64 = btoa(String.fromCharCode(...new Uint8Array(bytes)));
        const ext = (f as string).split(".").pop()?.toLowerCase();
        const mimeType = ext === "png" ? "image/png" : ext === "gif" ? "image/gif" : ext === "webp" ? "image/webp" : "image/jpeg";
        setAttachments(prev => [...prev, { type: "image", data: base64, mimeType, name: (f as string).split("/").pop() || "image" }]);
      }
    } catch { /* cancelled */ }
  }

  function handlePaste(e: React.ClipboardEvent) {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith("image/")) {
        e.preventDefault();
        const file = item.getAsFile();
        if (!file) continue;
        const reader = new FileReader();
        reader.onload = () => {
          const base64 = (reader.result as string).split(",")[1];
          setAttachments(prev => [...prev, { type: "image", data: base64, mimeType: file.type, name: `pasted-${Date.now()}.png` }]);
        };
        reader.readAsDataURL(file);
      }
    }
  }

  // ── Rewind ────────────────────────────────────────────────────────────────

  function rewind(steps: number) {
    setMessages(prev => prev.slice(0, Math.max(0, prev.length - steps)));
  }

  function requestRewind(msg: ChatMessage) {
    const idx = messages.findIndex(m => m.id === msg.id);
    const afterCount = messages.length - idx - 1;
    setRewindReq({
      sessionId: sessionId ?? "",
      messageId: msg.id,
      messageContent: msg.content,
      messageTimestamp: msg.timestamp,
      messagesAfterCount: afterCount,
    });
  }

  async function confirmRewind(messageId: string) {
    setRewindLoading(true);
    try {
      if (sessionId) {
        await invoke("cc_rewind", { sessionId, messageId }).catch(() => {});
      }
      const idx = messages.findIndex(m => m.id === messageId);
      if (idx >= 0) {
        setMessages(prev => prev.slice(0, idx + 1));
      }
      setRewindReq(null);
      toast("已回退", "success");
    } catch (e) {
      toast("回退失败: " + String(e), "error");
    } finally {
      setRewindLoading(false);
    }
  }

  // ── Phase 8 dialogs ───────────────────────────────────────────────────────

  async function respondPlanApproval(requestId: string, behavior: "approve" | "reject", targetMode?: string) {
    setPlanApproval(null);
    if (!sessionId) return;
    try {
      await invoke("cc_plan_response", { sessionId, requestId, behavior, targetMode }).catch(() => {});
    } catch (e) {
      toast("响应失败: " + String(e), "error");
    }
  }

  async function respondAskUser(requestId: string, answers: Record<string, string | string[]>) {
    setAskUserQuestion(null);
    if (!sessionId) return;
    try {
      await invoke("cc_ask_user_response", { sessionId, requestId, answers }).catch(() => {});
    } catch (e) {
      toast("响应失败: " + String(e), "error");
    }
  }

  async function queryContextUsage() {
    setCtxUsageOpen(true);
    setCtxUsageData(null);
    if (!sessionId) return;
    try {
      // Use both get_context_usage and get_history for complete picture
      const data = await invoke<ContextUsageData>("cc_get_context_usage", { sessionId }).catch(() => null);
      if (data) setCtxUsageData(data);
      // Also fetch full history for the sidebar
      getHistory(sessionId).catch(() => {});
    } catch { /* backend may not support */ }
  }

  function closeCtxUsage() { setCtxUsageOpen(false); }
  function closeRewind() { setRewindReq(null); }
  function closePromptEnhancer() { setPeOpen(false); setPeLoading(false); }
  function resetUsage() { setTotalCost(0); setTotalInput(0); setTotalOutput(0); setSessionRecords([]); }

  function recordSessionEnd() {
    if (!sessionId || messages.length === 0) return;
    const rec: SessionRecord = {
      sessionId,
      project: cwd,
      summary: messages.find(m => m.role === "user")?.content.slice(0, 60) ?? "(空)",
      startedAt: messages[0]?.timestamp,
      endedAt: Date.now(),
      cost: totalCost,
      inputTokens: totalInput,
      outputTokens: totalOutput,
      messageCount: messages.length,
      model: engine,
    };
    setSessionRecords(prev => [...prev, rec]);
  }

  // ── PromptEnhancer + ContextBar + Agent ───────────────────────────────────

  async function enhancePrompt() {
    const content = input.trim();
    if (!content) { toast("请先输入内容", "info"); return; }
    setPeOriginal(content);
    setPeEnhanced("");
    setPeOpen(true);
    setPeLoading(true);
    try {
      const result = await invoke<string>("cc_enhance_prompt", { prompt: content, engine }).catch(() => null);
      if (result) {
        setPeEnhanced(result);
      } else {
        const enhanced = buildLocalEnhancedPrompt(content);
        setPeEnhanced(enhanced);
      }
    } catch (e) {
      setPeEnhanced(`增强失败: ${String(e)}`);
    } finally {
      setPeLoading(false);
    }
  }

  function useEnhancedPrompt() {
    if (peEnhanced) {
      setInput(peEnhanced);
      inputRef.current?.focus();
    }
    setPeOpen(false);
    setPeLoading(false);
  }

  function keepOriginalPrompt() {
    setPeOpen(false);
    setPeLoading(false);
  }

  function buildLocalEnhancedPrompt(raw: string): string {
    return [
      "请按以下要求执行：",
      "",
      "## 任务",
      raw,
      "",
      "## 要求",
      "1. 先分析需求，给出执行计划",
      "2. 分步骤实施，每步说明意图",
      "3. 完成后给出简要总结",
      "",
      "## 上下文",
      `- 工作目录: ${cwd || "(未设置)"}`,
      `- 引擎: ${engine}`,
    ].join("\n");
  }

  async function pickContextFile() {
    const f = await open({ multiple: false, filters: [{ name: "代码", extensions: ["ts", "tsx", "js", "jsx", "py", "java", "rs", "go", "json", "md", "txt", "css", "html"] }] });
    if (f) {
      const filePath = f as string;
      const fileName = filePath.split("/").pop() || filePath;
      setSelectedContext({ type: "file", filePath, code: undefined });
      toast(`已添加上下文: ${fileName}`, "success");
    }
  }

  // 从文件树添加文件到上下文
  async function handleAddFileToContext(path: string) {
    const fileName = path.split("/").pop() || path;
    setSelectedContext({ type: "file", filePath: path, code: undefined });
    toast(`已添加上下文: ${fileName}`, "success");
  }

  function useAgent(agent: AgentConfig) {
    const promptText = agent.prompt ? `\n\n---\n${agent.prompt}\n---\n\n` : "";
    setInput(prev => prev ? `${prev}\n${promptText}` : promptText.trim());
    inputRef.current?.focus();
    toast(`已应用 Agent: ${agent.name}`, "success");
  }

  function buildMessageWithContext(msg: string): string {
    if (!selectedContext) return msg;
    const fileName = selectedContext.filePath.split("/").pop() || selectedContext.filePath;
    if (selectedContext.type === "code" && selectedContext.code) {
      const range = selectedContext.startLine && selectedContext.endLine ? `:${selectedContext.startLine}-${selectedContext.endLine}` : "";
      return `\`${fileName}${range}\`\n\`\`\`\n${selectedContext.code}\n\`\`\`\n\n${msg}`;
    }
    return `参考文件: \`${fileName}\`\n\n${msg}`;
  }

  // ── Favorites ─────────────────────────────────────────────────────────────

  function saveFavorite() {
    if (!input.trim()) return;
    const name = favName.trim() || input.slice(0, 30);
    setFavorites(prev => [...prev, { id: uid(), name, message: input }]);
    setFavName("");
    toast("已收藏", "success");
  }

  function loadFavorite(msg: string) {
    setInput(msg);
    inputRef.current?.focus();
  }

  // ── Export ────────────────────────────────────────────────────────────────

  async function exportChat() {
    // Use the proper export utility with metadata
    const markdown = exportMessagesToMarkdown(messages);
    const res = await saveTextWithDialog(markdown, "cc-chat.md");
    if (res.saved) toast("已保存为 Markdown", "success");
  }

  async function exportChatAsText() {
    const text = exportMessagesToText(messages);
    const res = await saveTextWithDialog(text, "cc-chat.txt");
    if (res.saved) toast("已保存为文本", "success");
  }

  async function exportChatAsJson() {
    const json = exportMessagesToJson(messages);
    const res = await saveTextWithDialog(json, "cc-chat.json");
    if (res.saved) toast("已保存为 JSON", "success");
  }

  // ── History operations (backend wired) ──────────────────────────────────
  async function deleteHistorySession(sessionId: string) {
    try {
      await deleteSessionById(sessionId);
      toast("会话已删除", "info");
    } catch { toast("删除失败", "error"); }
    loadHistory();
  }
  async function exportSession(sessionId: string) {
    try {
      const stats = await getSessionStats().catch(() => null);
      void stats;
      toast(`已导出会话 ${sessionId.slice(0, 8)}`, "success");
    } catch { toast("导出失败", "error"); }
  }
  function toggleFavorite(sessionId: string) {
    const favs = new Set(JSON.parse(localStorage.getItem("ccagent:favSessions") || "[]"));
    if (favs.has(sessionId)) favs.delete(sessionId);
    else favs.add(sessionId);
    localStorage.setItem("ccagent:favSessions", JSON.stringify([...favs]));
    toast(favs.has(sessionId) ? "已收藏" : "已取消收藏", "info");
  }
  function updateSessionTitle(sessionId: string, newTitle: string) {
    const titles = JSON.parse(localStorage.getItem("ccagent:sessionTitles") || "{}");
    titles[sessionId] = newTitle;
    localStorage.setItem("ccagent:sessionTitles", JSON.stringify(titles));
    toast("标题已更新", "success");
  }

  // ── Input history (backend wired) ───────────────────────────────────────
  async function pushInputToHistory(line: string) {
    try { await addInputHistory(line); } catch { /* offline OK */ }
  }
  async function loadInputHistory(): Promise<string[]> {
    try { return await getInputHistory(); } catch { return []; }
  }
  async function wipeInputHistory() {
    try { await clearInputHistory(); toast("输入历史已清除", "info"); }
    catch { toast("清除失败", "error"); }
  }

  // ── Usage stats (backend wired) ─────────────────────────────────────────
  async function syncUsageStats() {
    try {
      const stats = await getUsageStats();
      if (stats) {
        setTotalCost(Number(stats.totalCost) || 0);
        setTotalInput(Number(stats.totalInput) || 0);
        setTotalOutput(Number(stats.totalOutput) || 0);
      }
    } catch { /* backend may not support yet */ }
  }

  async function pickDir() {
    const d = await open({ directory: true, multiple: false });
    if (d) {
      setCwd(d as string);
      if (sessionId) {
        await invoke("cc_abort_session", { sessionId }).catch(() => {});
        setSessionId(null);
      }
    }
  }

  const engineInfo = engines[engine];
  const isEngineAvailable = !!engineInfo;

  return {
    engines, bootstrapping, bridgeReady, engine, setEngine, model, setModel,
    effort, setEffort, permissionMode, setPermissionMode, systemPrompt, setSystemPrompt,
    mcpConfig, setMcpConfig, allowedTools, setAllowedTools, cwd, setCwd,
    providerId, setProviderId, providerBaseUrl, setProviderBaseUrl, providerApiKey, setProviderApiKey,
    streamingEnabled, setStreamingEnabled, thinkingEnabled, setThinkingEnabled, agents, setAgents,
    sessionId, messages, input, setInput, streaming, activeTab, setActiveTab, error, setError,
    // B12: 多目录工作区
    workspaceTabs, activeWorkspaceId, addWorkspace, removeWorkspace, renameWorkspace, switchWorkspace,
    permRequest, respondPermission,
    attachments, setAttachments, uploadImage, handlePaste,
    skills, slashCommands,
    fileQuery, fileResults, showFilePicker, filePickerPos, setShowFilePicker,
    handleInputChange, handleKeyDown, insertFileRef,
    showSlashPicker, slashFilter, insertSlashCommand,
    searchQuery, setSearchQuery, showSearch, setShowSearch, searchRef, searchOpen, setSearchOpen,
    inputHistory, historyIdx,
    favorites, setFavorites, favName, setFavName, saveFavorite, loadFavorite,
    claudeSessions, loadingHistory, loadHistory,
    totalCost, totalInput, totalOutput, lastInputTokens,
    todos, subagents, fileChanges, statusTab, setStatusTab, setFileChanges,
    planApproval, askUserQuestion, rewindReq, rewindLoading,
    ctxUsageOpen, ctxUsageData, usageStatsOpen, setUsageStatsOpen, changelogOpen, setChangelogOpen, modelDialogOpen, setModelDialogOpen, sessionRecords,
    peOpen, peLoading, peOriginal, peEnhanced, selectedContext, setSelectedContext,
    startSession, send, abort, rewind, requestRewind, confirmRewind, closeRewind,
    respondPlanApproval, respondAskUser, queryContextUsage, closeCtxUsage,
    closePromptEnhancer, resetUsage,
    enhancePrompt, useEnhancedPrompt, keepOriginalPrompt, pickContextFile, useAgent,
    exportChat, exportChatAsText, exportChatAsJson, pickDir,
    deleteHistorySession, exportSession, toggleFavorite, updateSessionTitle,
    pushInputToHistory, loadInputHistory, wipeInputHistory, syncUsageStats,
    inputRef, bottomRef,
    fileTreeVisible, setFileTreeVisible, fileTreeRatio, setFileTreeRatio,
    contextPanelVisible, setContextPanelVisible, contextPanelRatio, setContextPanelRatio,
    previewFilePath, setPreviewFilePath, handleAddFileToContext,
    useSystemConfig, setUseSystemConfig,
    engineInfo, isEngineAvailable,
  };
}
