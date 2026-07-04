// ChatScreen — Sprint G: 主聊天界面，消费 useCcAgentState hook 渲染 UI
// 从 CcAgent.tsx 拆出，纯 UI 层

import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { toast } from "../../../useCopyFeedback";
import SplitPane from "../../../components/SplitPane";
import type {
  Engine,
} from "../types";
import {
  PROVIDER_PRESETS, MODELS, EFFORT_LEVELS, PERMISSION_MODES,
} from "../constants";
import {
  formatCost, formatTokens,
} from "../utils";
import {
  MessageRow, StatusPanel, PermissionDialog,
  AgentSection, PromptEnhancerDialog, ContextBar,
  PlanApprovalDialog, AskUserQuestionDialog, RewindDialog,
  ContextUsageDialog, UsageStatisticsDialog,
  HistoryView, ConversationSearch, MessageAnchorRail, TokenIndicator,
  CustomModelDialog, FileTreePanel, ContextPanel, SessionTabBar, FilePreviewPanel,
} from "../components";
import GitPanel from "../components/GitPanel";
import TerminalPanel from "../components/TerminalPanel";
import ChangelogDialog from "../components/ChangelogDialog";
import { CHANGELOG_DATA } from "../data/changelogData";
import type { CcAgentState } from "../hooks/useCcAgentState";
import { sessionAlwaysAllow } from "../hooks/useCcAgentState";

// MCP Config Editor (从 CcAgent.tsx 迁出)
const MCP_PRESETS = [
  { name: "filesystem", cmd: "npx", args: ["-y", "@modelcontextprotocol/server-filesystem", "."] },
  { name: "github",     cmd: "npx", args: ["-y", "@modelcontextprotocol/server-github"] },
  { name: "fetch",      cmd: "npx", args: ["-y", "@modelcontextprotocol/server-fetch"] },
];

function McpConfigEditor({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { t } = useLocale();
  const [parseError, setParseError] = useState("");
  function addPreset(preset: typeof MCP_PRESETS[number]) {
    try {
      const cfg = value.trim() ? JSON.parse(value) : { mcpServers: {} };
      cfg.mcpServers = cfg.mcpServers || {};
      cfg.mcpServers[preset.name] = { command: preset.cmd, args: preset.args };
      onChange(JSON.stringify(cfg, null, 2));
      setParseError("");
    } catch { setParseError(t("chatScreen.jsonFormatErrorFix")); }
  }
  function onChangeRaw(raw: string) {
    onChange(raw);
    if (raw.trim()) {
      try { JSON.parse(raw); setParseError(""); }
      catch { setParseError(t("chatScreen.jsonFormatError")); }
    } else { setParseError(""); }
  }
  return (
    <div className="cc-mcp-editor">
      <div className="cc-mcp-presets">
        {MCP_PRESETS.map(p => (
          <button key={p.name} className="cc-mcp-preset-btn" onClick={() => addPreset(p)}>
            + {p.name}
          </button>
        ))}
      </div>
      <textarea
        className={`cc-mcp-textarea ${parseError ? "cc-mcp-error" : ""}`}
        rows={5}
        value={value}
        onChange={e => onChangeRaw(e.target.value)}
        placeholder={'{"mcpServers":{"my-server":{"command":"node","args":["path/to/server.js"]}}}'}
        spellCheck={false}
      />
      {parseError && <div className="cc-mcp-err-msg">{parseError}</div>}
    </div>
  );
}

import { useState, useEffect } from "react";
import { useLocale } from "../hooks/useLocale";

export function ChatScreen({ state }: { state: CcAgentState }) {
  const s = state;
  const { t } = useLocale();

  return (
    <div className="cc-agent">
      {s.bootstrapping && (
        <div className="cc-bootstrap-bar">⏳ {t("chatScreen.bootstrapBar")}</div>
      )}

      {/* Session Tab Bar — ccgui 风格 */}
      <SessionTabBar
        workspaces={s.workspaceTabs}
        activeId={s.activeWorkspaceId}
        onSwitch={s.switchWorkspace}
        onAdd={s.addWorkspace}
        onRemove={s.removeWorkspace}
        onRename={s.renameWorkspace}
        engine={s.engine}
        onEngineChange={s.setEngine}
        onOpenSettings={() => s.setActiveTab("settings")}
        onOpenHistory={() => { s.setActiveTab("history"); s.loadHistory(); }}
        onOpenGit={() => s.setActiveTab("git")}
        streaming={s.streaming}
        onNewSession={s.startSession}
        model={s.model}
      />

      {/* Top bar: compact status bar (usage only — cwd shown in Tab label) */}
      {(s.totalCost > 0 || s.totalInput > 0) && (
        <div className="cc-topbar cc-topbar-compact">
          <div className="cc-usage-bar cc-usage-bar-inline">
            <span>💰 {formatCost(s.totalCost)}</span>
            <span>📥 {formatTokens(s.totalInput)}</span>
            <span>📤 {formatTokens(s.totalOutput)}</span>
            <button className="cc-usage-btn" onClick={s.queryContextUsage} title={t("chatScreen.contextUsage")}>📊</button>
          </div>
        </div>
      )}

      {/* Conversation search (Ctrl+K) */}
      <ConversationSearch
        isOpen={s.searchOpen}
        messages={s.messages}
        onClose={() => s.setSearchOpen(false)}
        onJumpTo={(idx) => {
          s.setSearchOpen(false);
          const el = document.getElementById(`cc-msg-${idx}`);
          if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
        }}
      />

      {/* Error */}
      {s.error && (
        <div className="cc-error-bar">
          <pre>{s.error}</pre>
          <button onClick={() => s.setError("")}>×</button>
        </div>
      )}

      {/* Dialogs */}
      {s.permRequest && (
        <PermissionDialog
          request={s.permRequest}
          onAllow={() => s.respondPermission("allow")}
          onDeny={() => s.respondPermission("deny")}
          sessionAlwaysAllow={sessionAlwaysAllow}
        />
      )}
      {s.planApproval && (
        <PlanApprovalDialog
          request={s.planApproval}
          onApprove={(rid, mode) => s.respondPlanApproval(rid, "approve", mode)}
          onReject={(rid) => s.respondPlanApproval(rid, "reject")}
        />
      )}
      {s.askUserQuestion && (
        <AskUserQuestionDialog
          request={s.askUserQuestion}
          onSubmit={s.respondAskUser}
          onCancel={(rid) => s.respondAskUser(rid, {})}
        />
      )}
      <RewindDialog
        request={s.rewindReq}
        loading={s.rewindLoading}
        onConfirm={s.confirmRewind}
        onCancel={s.closeRewind}
      />
      <ContextUsageDialog
        isOpen={s.ctxUsageOpen}
        data={s.ctxUsageData}
        onClose={s.closeCtxUsage}
      />
      <UsageStatisticsDialog
        isOpen={s.usageStatsOpen}
        onClose={() => s.setUsageStatsOpen(false)}
        totalCost={s.totalCost}
        totalInput={s.totalInput}
        totalOutput={s.totalOutput}
        totalSessions={s.sessionRecords.length}
        messages={s.messages}
        sessions={s.sessionRecords}
        onReset={s.resetUsage}
      />
      <FilePreviewPanel
        filePath={s.previewFilePath}
        onClose={() => s.setPreviewFilePath(null)}
      />
      <ChangelogDialog
        isOpen={s.changelogOpen}
        onClose={() => s.setChangelogOpen(false)}
        entries={CHANGELOG_DATA}
      />
      <CustomModelDialog
        isOpen={s.modelDialogOpen}
        engine={s.engine}
        onClose={() => s.setModelDialogOpen(false)}
        onAdd={(modelId, displayName, ctxWindow) => {
          const newModel = { value: modelId, label: displayName, contextWindow: ctxWindow };
          void newModel;
          s.setModel(modelId);
          toast(`已添加模型: ${displayName}`, "success");
        }}
      />
      <PromptEnhancerDialog
        isOpen={s.peOpen}
        isLoading={s.peLoading}
        originalPrompt={s.peOriginal}
        enhancedPrompt={s.peEnhanced}
        onUseEnhanced={s.useEnhancedPrompt}
        onKeepOriginal={s.keepOriginalPrompt}
        onClose={s.closePromptEnhancer}
      />

      {/* Chat tab */}
      {s.activeTab === "chat" && (
        <ChatTab state={s} />
      )}

      {/* Settings tab */}
      {s.activeTab === "settings" && (
        <>
          <div className="cc-subpage-bar">
            <button className="cc-back-btn" onClick={() => s.setActiveTab("chat")}>← 返回聊天</button>
            <span className="cc-subpage-title">⚙️ 设置</span>
          </div>
          <SettingsTab state={s} McpConfigEditor={McpConfigEditor} />
        </>
      )}

      {/* History tab */}
      {s.activeTab === "history" && (
        <>
          <div className="cc-subpage-bar">
            <button className="cc-back-btn" onClick={() => s.setActiveTab("chat")}>← 返回聊天</button>
            <span className="cc-subpage-title">📜 会话历史</span>
          </div>
          <HistoryTab state={s} />
        </>
      )}

      {/* Git tab */}
      {s.activeTab === "git" && (
        <>
          <div className="cc-subpage-bar">
            <button className="cc-back-btn" onClick={() => s.setActiveTab("chat")}>← 返回聊天</button>
            <span className="cc-subpage-title">🌿 Git</span>
          </div>
          <GitPanel />
        </>
      )}

      {/* Terminal tab */}
      {s.activeTab === "terminal" && (
        <>
          <div className="cc-subpage-bar">
            <button className="cc-back-btn" onClick={() => s.setActiveTab("chat")}>← 返回聊天</button>
            <span className="cc-subpage-title">💻 Terminal</span>
          </div>
          <TerminalPanel />
        </>
      )}
    </div>
  );
}

// ── Chat Tab ────────────────────────────────────────────────────────────────

function ChatTab({ state: s }: { state: CcAgentState }) {
  const { t } = useLocale();

  // 自动启动会话：bridge 就绪且无 session 时立即启动，无需手动点击
  useEffect(() => {
    if (s.cwd && s.isEngineAvailable && s.bridgeReady && !s.sessionId && !s.streaming) {
      s.startSession();
    }
  }, [s.cwd, s.isEngineAvailable, s.bridgeReady, s.sessionId, s.streaming]);

  if (!s.cwd) {
    return (
      <div className="cc-welcome">
        <div className="cc-welcome-icon">📁</div>
        <div className="cc-welcome-title">{t("chatScreen.welcomeSelectCwd")}</div>
        <div className="cc-welcome-desc">{t("chatScreen.welcomeEachTabProject")}</div>
        <button className="cc-start-btn" onClick={s.pickDir}>{t("chatScreen.browseSelectDir")}</button>
      </div>
    );
  }
  if (!s.isEngineAvailable) {
    return (
      <div className="cc-welcome">
        <div className="cc-welcome-icon">⚠️</div>
        <div>{t("chatScreen.engineNotInstalledShort", { engine: s.engine === "claude" ? t("chatScreen.claudeCode") : t("chatScreen.codexCli") })}</div>
        <div className="cc-no-engine-hint">
          {s.engine === "claude" ? "npm i -g @anthropic-ai/claude-code" : "npm i -g @openai/codex"}
        </div>
      </div>
    );
  }
  if (!s.sessionId) {
    return (
      <div className="cc-welcome">
        <div className="cc-welcome-icon">{s.engine === "claude" ? "🧠" : "⚡"}</div>
        <div className="cc-welcome-title">{t("chatScreen.claudeCodeAgent")}</div>
        <div className="cc-welcome-desc cc-no-engine-hint">
          {s.bridgeReady ? t("chatScreen.startingSession") : t("chatScreen.bridgeNotReady")}
        </div>
      </div>
    );
  }

  // ── 聊天内容（消息 + 附件 + StatusPanel + 输入区） ──────────────────
  const chatContent = (
    <>
      <div className="cc-messages" style={{ display: "flex" }}>
        <MessageAnchorRail
          messages={s.messages}
          minMessages={3}
          onJumpTo={(idx) => {
            const el = document.getElementById(`cc-msg-row-${idx}`);
            if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
          }}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
        {s.showSearch && (
          <div className="cc-search-bar">
            <input
              ref={s.searchRef}
              className="cc-search-input"
              placeholder={t("chatScreen.searchMessages")}
              value={s.searchQuery}
              onChange={e => s.setSearchQuery(e.target.value)}
              onKeyDown={e => e.key === "Escape" && s.setShowSearch(false)}
            />
            <span className="cc-search-count">
              {s.searchQuery ? t("chatScreen.countItems", { count: s.messages.filter(m => m.content.toLowerCase().includes(s.searchQuery.toLowerCase())).length }) : ""}
            </span>
            <button className="cc-search-close" onClick={() => { s.setShowSearch(false); s.setSearchQuery(""); }}>×</button>
          </div>
        )}
        {s.messages.length === 0 && (
          <div className="cc-empty">
            <div className="cc-empty-icon">{s.engine === "claude" ? "🧠" : "⚡"}</div>
            <div>{t("chatScreen.startConversation")}</div>
            <div className="cc-empty-hint">{t("chatScreen.emptyHint")}</div>
          </div>
        )}
        {s.messages
          .filter(m => !s.searchQuery || m.content.toLowerCase().includes(s.searchQuery.toLowerCase()) || m.thinking?.toLowerCase().includes(s.searchQuery.toLowerCase()))
          .map((m) => <MessageRow key={m.id} msg={m} onRewind={(steps) => {
            if (steps === 2) s.requestRewind(m);
            else s.rewind(steps);
          }} canRewind={!s.streaming} searchQuery={s.searchQuery} />)}
        <div ref={s.bottomRef} />
      </div>
      </div>

      {s.attachments.length > 0 && (
        <div className="cc-attachments">
          {s.attachments.map((a, i) => (
            <div key={i} className="cc-attachment-chip">
              🖼️ {a.name}
              <button onClick={() => s.setAttachments(prev => prev.filter((_, j) => j !== i))}>×</button>
            </div>
          ))}
        </div>
      )}

      <StatusPanel
        todos={s.todos}
        subagents={s.subagents}
        fileChanges={s.fileChanges}
        isStreaming={s.streaming}
        activeTab={s.statusTab}
        onTabClick={(tab) => s.setStatusTab(prev => prev === tab ? null : tab)}
        onClearFiles={() => s.setFileChanges([])}
        contextUsed={s.lastInputTokens}
        contextMax={s.model.includes("[1m]") ? 1_000_000 : 200_000}
      />

      <div className="cc-input-area" onPaste={s.handlePaste}>
        <ContextBar context={s.selectedContext} onClear={() => s.setSelectedContext(null)} onPickFile={s.pickContextFile} />

        {s.showSlashPicker && (
          <div className="cc-slash-picker">
            {s.slashCommands.filter(c => c.cmd.startsWith(s.slashFilter)).map(c => (
              <button key={c.cmd} className="cc-slash-item" onClick={() => s.insertSlashCommand(c.cmd)}>
                <span className="cc-slash-cmd">{c.cmd}</span>
                <span className="cc-slash-desc">{c.desc}</span>
              </button>
            ))}
          </div>
        )}

        {s.showFilePicker && (
          <div className="cc-file-picker">
            <div className="cc-file-picker-title">{t("chatScreen.referenceFiles", { query: s.fileQuery })}</div>
            {s.fileResults.length === 0 ? <div className="cc-file-empty">{t("chatScreen.noMatchingFiles")}</div> : (
              s.fileResults.map(f => (
                <button key={f.full_path} className="cc-file-item" onClick={() => s.insertFileRef(f)}>
                  <span className="cc-file-icon">{f.is_dir ? "📁" : "📄"}</span>
                  <span className="cc-file-path">{f.path}</span>
                  <span className="cc-file-size">{f.size > 0 ? `${(f.size / 1024).toFixed(1)}KB` : ""}</span>
                </button>
              ))
            )}
          </div>
        )}

        <textarea ref={s.inputRef} className="cc-input" rows={4}
          value={s.input} onChange={e => s.handleInputChange(e.target.value)}
          onKeyDown={s.handleKeyDown}
          placeholder={t("chatScreen.inputPlaceholder", { engine: s.engine === "claude" ? "Claude" : "Codex" })}
          disabled={s.streaming} spellCheck={false} />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 4px" }}>
          <TokenIndicator text={s.input} />
          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Ctrl+K 全局搜索</span>
        </div>

        <div className="cc-input-actions">
          <button className="cc-input-btn" onClick={s.uploadImage} title={t("chatScreen.uploadImage")}>🖼️</button>
          <button className="cc-input-btn" onClick={s.enhancePrompt} disabled={!s.input.trim() || s.streaming} title={t("chatScreen.promptEnhance")}>✨</button>
          <button className="cc-input-btn" title={t("chatScreen.workingDirectory", { cwd: s.cwd })}>📁 {s.cwd.split("/").pop()}</button>

          {s.favorites.length > 0 && (
            <select className="cc-fav-select" onChange={e => e.target.value && s.loadFavorite(e.target.value)} value="">
              <option value="">{t("chatScreen.favorites", { count: s.favorites.length })}</option>
              {s.favorites.map(f => <option key={f.id} value={f.message}>{f.name}</option>)}
            </select>
          )}
          <button className="cc-input-btn" onClick={s.saveFavorite} disabled={!s.input.trim()} title={t("chatScreen.saveFavorite")}>⭐</button>

          <div style={{ flex: 1 }} />
          {s.messages.length > 0 && <button className="cc-input-btn" onClick={() => s.rewind(2)} disabled={s.streaming}>{t("chatScreen.rewind")}</button>}
          <button className="cc-input-btn" onClick={s.exportChat} disabled={s.messages.length === 0}>{t("chatScreen.export")}</button>
          {s.streaming ? (
            <button className="cc-stop-btn" onClick={s.abort}>{t("chatScreen.stop")}</button>
          ) : (
            <button className="cc-send-btn" onClick={() => void s.send()} disabled={!s.input.trim() || !s.isEngineAvailable}>{t("chatScreen.send")}</button>
          )}
        </div>
      </div>
    </>
  );

  // ── 上下文面板 ──────────────────────────────────────────────────────────
  const contextPanel = (
    <ContextPanel
      visible={s.contextPanelVisible}
      onToggleVisibility={() => s.setContextPanelVisible(!s.contextPanelVisible)}
      cwd={s.cwd}
      sessionId={s.sessionId}
      model={s.model}
      engine={s.engine}
      lastInputTokens={s.lastInputTokens}
      totalInput={s.totalInput}
      totalOutput={s.totalOutput}
      totalCost={s.totalCost}
      selectedContext={s.selectedContext}
      onClearContext={() => s.setSelectedContext(null)}
      fileChanges={s.fileChanges}
      subagents={s.subagents}
      todos={s.todos}
      streaming={s.streaming}
    />
  );

  return (
    <div className="cc-chat-with-filetree" style={{ position: "relative" }}>
      {s.fileTreeVisible ? (
        <SplitPane
          left={<FileTreePanel
            cwd={s.cwd}
            visible={true}
            onToggleVisibility={() => s.setFileTreeVisible(false)}
            onAddToContext={(path) => { void s.handleAddFileToContext(path); }}
            onPreviewFile={(path) => { s.setPreviewFilePath(path); }}
            onOpenFile={async (path) => {
              try {
                const content = await invoke("cc_read_file", { path });
                s.setInput(s.input + `\n\n<file path="${path.split('/').pop() || path}">\n${content}\n</file>`);
                toast(`已插入: ${path.split("/").pop()}`, "info");
              } catch { toast("读取文件失败", "error"); }
            }}
          />}
          right={
            <SplitPane
              left={<div className="cc-chat-main">{chatContent}</div>}
              right={contextPanel}
              ratio={s.contextPanelRatio}
              onRatioChange={s.setContextPanelRatio}
              min={0.65}
              max={0.92}
            />
          }
          ratio={s.fileTreeRatio}
          onRatioChange={s.setFileTreeRatio}
          min={0.08}
          max={0.5}
        />
      ) : (
        <div style={{ display: "flex", flex: 1, minHeight: 0, position: "relative" }}>
          <button
            className="cc-ft-toggle-btn"
            style={{ position: "absolute", top: 8, left: 4, zIndex: 10 }}
            onClick={() => s.setFileTreeVisible(true)}
            title="显示文件树"
          >📁</button>
          <SplitPane
            left={<div className="cc-chat-main">{chatContent}</div>}
            right={contextPanel}
            ratio={s.contextPanelRatio}
            onRatioChange={s.setContextPanelRatio}
            min={0.65}
            max={0.92}
          />
        </div>
      )}
    </div>
  );
}

// ── Settings Tab ────────────────────────────────────────────────────────────

function SettingsTab({ state: s, McpConfigEditor }: { state: CcAgentState; McpConfigEditor: React.FC<{ value: string; onChange: (v: string) => void }> }) {
  return (
    <div className="cc-settings">
      <div className="cc-settings-section">
        <div className="cc-settings-title">引擎设置</div>

        {/* 配置模式：系统默认 vs 自定义 */}
        <div className="cc-setting-row">
          <label>配置来源</label>
          <div style={{ display: "flex", gap: 4 }}>
            <button
              className={`cc-engine-btn ${s.useSystemConfig ? "active" : ""}`}
              onClick={() => s.setUseSystemConfig(true)}
            >系统默认</button>
            <button
              className={`cc-engine-btn ${!s.useSystemConfig ? "active" : ""}`}
              onClick={() => s.setUseSystemConfig(false)}
            >自定义</button>
          </div>
        </div>
        {s.useSystemConfig && (
          <div className="cc-setting-hint">
            💡 使用系统已安装的 Claude Code / Codex CLI 配置（~/.claude.json 或环境变量），无需重复配置 API Key 或模型。
          </div>
        )}

        <div className="cc-setting-row">
          <label>引擎</label>
          <select value={s.engine} onChange={e => s.setEngine(e.target.value as Engine)}>
            <option value="claude" disabled={!s.engines.claude}>Claude Code {s.engines.claude ? `(${s.engines.claude.version})` : "(未安装)"}</option>
            <option value="codex" disabled={!s.engines.codex}>Codex {s.engines.codex ? `(${s.engines.codex.version})` : "(未安装)"}</option>
          </select>
        </div>

        {!s.useSystemConfig && (
          <>
            <div className="cc-setting-row">
              <label>模型</label>
              <select value={s.model} onChange={e => s.setModel(e.target.value)}>
                {(MODELS[s.engine] || []).map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
            {s.engine === "claude" && (
              <>
                <div className="cc-setting-row">
                  <label>推理力度</label>
                  <select value={s.effort} onChange={e => s.setEffort(e.target.value)}>
                    <option value="">默认</option>
                    {EFFORT_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                </div>
                <div className="cc-setting-row">
                  <label>1M 上下文</label>
                  <select value={s.model.includes("[1m]") ? "1" : "0"} onChange={e => {
                    if (e.target.value === "1" && !s.model.includes("[1m]")) s.setModel(s.model + "[1m]");
                    else if (e.target.value === "0") s.setModel(s.model.replace("[1m]", ""));
                  }}>
                    <option value="0">标准 (200K)</option>
                    <option value="1">扩展 (1M)</option>
                  </select>
                </div>
              </>
            )}
          </>
        )}

        {s.engine === "claude" && (
          <div className="cc-setting-row">
            <label>权限模式</label>
            <select value={s.permissionMode} onChange={e => s.setPermissionMode(e.target.value)}>
              {PERMISSION_MODES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </div>
        )}
        <div className="cc-setting-row">
          <label>流式输出</label>
          <label className="cc-toggle-switch">
            <input type="checkbox" checked={s.streamingEnabled} onChange={e => s.setStreamingEnabled(e.target.checked)} />
            <span className="cc-toggle-slider"></span>
            <span className="cc-toggle-label">{s.streamingEnabled ? "开启" : "关闭"}</span>
          </label>
        </div>
        {s.engine === "claude" && (
          <div className="cc-setting-row">
            <label>思考模式</label>
            <label className="cc-toggle-switch">
              <input type="checkbox" checked={s.thinkingEnabled} onChange={e => s.setThinkingEnabled(e.target.checked)} />
              <span className="cc-toggle-slider"></span>
              <span className="cc-toggle-label">{s.thinkingEnabled ? "始终思考" : "按需"}</span>
            </label>
          </div>
        )}
      </div>

      <div className="cc-settings-section">
        <AgentSection
          agents={s.agents}
          onAdd={(a) => { s.setAgents(prev => [...prev, a]); toast("Agent 已创建", "success"); }}
          onUpdate={(a) => { s.setAgents(prev => prev.map(x => x.id === a.id ? a : x)); toast("Agent 已更新", "success"); }}
          onDelete={(id) => { s.setAgents(prev => prev.filter(x => x.id !== id)); toast("Agent 已删除", "info"); }}
          onUse={s.useAgent}
        />
      </div>

      <div className="cc-settings-section">
        <div className="cc-settings-title">工作环境</div>
        <div className="cc-setting-row">
          <label>工作目录</label>
          <input value={s.cwd} onChange={e => s.setCwd(e.target.value)} />
          <button onClick={async () => { const d = await open({ directory: true, multiple: false }); if (d) s.setCwd(d as string); }}>浏览</button>
        </div>
        {s.engine === "claude" && (
          <>
            <div className="cc-setting-row">
              <label>系统 Prompt</label>
              <textarea rows={3} value={s.systemPrompt} onChange={e => s.setSystemPrompt(e.target.value)} placeholder="覆盖默认系统 prompt" />
            </div>
            <div className="cc-setting-row cc-setting-row-stack">
              <label>MCP 配置</label>
              <McpConfigEditor value={s.mcpConfig} onChange={s.setMcpConfig} />
            </div>
            <div className="cc-setting-row">
              <label>允许工具</label>
              <input value={s.allowedTools} onChange={e => s.setAllowedTools(e.target.value)} placeholder="空格分隔" />
            </div>
          </>
        )}
      </div>

      {s.engine === "claude" && !s.useSystemConfig && (
        <div className="cc-settings-section">
          <div className="cc-settings-title">API 供应商（自定义）</div>
          <div className="cc-setting-row">
            <label>供应商</label>
            <select value={s.providerId} onChange={e => {
              const id = e.target.value;
              s.setProviderId(id);
              const preset = PROVIDER_PRESETS.find(p => p.id === id);
              if (preset?.baseUrl) s.setProviderBaseUrl(preset.baseUrl);
              else if (id !== "custom") s.setProviderBaseUrl("");
              if (preset?.customModels?.length) s.setModel(preset.customModels[0].value);
              else if (id === "official") s.setModel("");
            }}>
              {PROVIDER_PRESETS.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          {(s.providerId === "custom" || s.providerId !== "official") && (
            <div className="cc-setting-row">
              <label>Base URL</label>
              <input
                value={s.providerBaseUrl}
                onChange={e => s.setProviderBaseUrl(e.target.value)}
                placeholder="https://api.example.com/anthropic"
                disabled={s.providerId !== "custom" && !!PROVIDER_PRESETS.find(p=>p.id===s.providerId)?.baseUrl}
              />
            </div>
          )}
          <div className="cc-setting-row">
            <label>API Key</label>
            <input type="password" value={s.providerApiKey} onChange={e => s.setProviderApiKey(e.target.value)} placeholder="留空使用系统环境变量" />
          </div>
          {s.providerId !== "official" && (
            <div className="cc-setting-row">
              <label>模型</label>
              <select value={s.model} onChange={e => s.setModel(e.target.value)}>
                <option value="">默认</option>
                {PROVIDER_PRESETS.find(p=>p.id===s.providerId)?.customModels?.map(m =>
                  <option key={m.value} value={m.value}>{m.label}</option>
                )}
              </select>
            </div>
          )}
        </div>
      )}

      {s.skills.length > 0 && (
        <div className="cc-settings-section">
          <div className="cc-settings-title">已加载技能 ({s.skills.length})</div>
          <div className="cc-slash-grid">
            {s.skills.map(sk => (
              <div key={sk.name} className="cc-slash-grid-item">
                <span className="cc-slash-cmd">/{sk.name}</span>
                <span className="cc-slash-desc">{sk.description}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="cc-settings-section">
        <div className="cc-settings-title">快捷命令</div>
        <div className="cc-slash-grid">
          {s.slashCommands.map(c => (
            <button key={c.cmd} className="cc-slash-grid-item" onClick={() => { s.setActiveTab("chat"); s.setInput(c.cmd + " "); setTimeout(() => s.inputRef.current?.focus(), 100); }}>
              <span className="cc-slash-cmd">{c.cmd}</span>
              <span className="cc-slash-desc">{c.desc}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="cc-settings-section">
        <div className="cc-settings-title">收藏 ({s.favorites.length})</div>
        {s.favorites.length === 0 ? <div className="cc-file-empty">暂无收藏</div> : (
          <div className="cc-fav-list">
            {s.favorites.map(f => (
              <div key={f.id} className="cc-fav-item">
                <span className="cc-fav-name" onClick={() => s.loadFavorite(f.message)}>{f.name}</span>
                <button onClick={() => s.setFavorites(prev => prev.filter(x => x.id !== f.id))}>×</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── History Tab ─────────────────────────────────────────────────────────────

function HistoryTab({ state: s }: { state: CcAgentState }) {
  return (
    <HistoryView
      sessions={s.claudeSessions}
      currentSessionId={s.sessionId || null}
      onLoadSession={(sessionId) => { s.setInput(`/resume ${sessionId}`); s.setActiveTab("chat"); toast("已填入 resume 命令", "info"); }}
      onDeleteSession={(sessionId) => { s.deleteHistorySession(sessionId); }}
      onDeleteSessions={(sessionIds) => { sessionIds.forEach(id => s.deleteHistorySession(id)); }}
      onExportSession={(sessionId) => { s.exportSession(sessionId); }}
      onToggleFavorite={(sessionId) => { s.toggleFavorite(sessionId); }}
      onUpdateTitle={(sessionId, newTitle) => { s.updateSessionTitle(sessionId, newTitle); }}
    />
  );
}
