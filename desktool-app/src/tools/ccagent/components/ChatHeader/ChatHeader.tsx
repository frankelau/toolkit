// ChatHeader — 顶部工具栏，对齐 cc-gui ChatHeader

export interface ChatHeaderProps {
  /** 当前会话 id（短哈希） */
  sessionId?: string | null;
  /** 引擎名 */
  engine: string;
  /** 工作目录 */
  cwd: string;
  /** 模型 */
  model?: string;
  /** 流式中 */
  streaming: boolean;
  /** 消息数 */
  messageCount: number;
  /** 操作 */
  onNewSession?: () => void;
  onOpenHistory?: () => void;
  onOpenSettings?: () => void;
  onOpenUsage?: () => void;
  onOpenContext?: () => void;
  onAbort?: () => void;
  /** 是否有消息（控制回退/导出按钮显示） */
  hasMessages: boolean;
  onRewind?: () => void;
  onExport?: () => void;
  onSearch?: () => void;
  searchActive?: boolean;
}

export function ChatHeader(props: ChatHeaderProps) {
  const {
    sessionId, engine, cwd, model, streaming, messageCount,
    onNewSession, onOpenHistory, onOpenSettings, onOpenUsage,
    onOpenContext, onAbort, hasMessages, onRewind, onExport, onSearch, searchActive,
  } = props;

  return (
    <div className="cc-chat-header">
      <div className="cc-chat-header-left">
        <button
          className="cc-header-btn cc-header-new"
          onClick={onNewSession}
          title="新建会话"
          disabled={streaming}
        >
          ＋
        </button>
        <span className="cc-header-engine-badge">{engine === "claude" ? "Claude" : "Codex"}</span>
        {model && <span className="cc-header-model">{model}</span>}
        {sessionId && (
          <span className="cc-header-session-id" title={sessionId}>
            #{sessionId.slice(0, 8)}
          </span>
        )}
        <span className="cc-header-cwd" title={cwd}>📁 {cwd.split("/").pop() || cwd}</span>
      </div>

      <div className="cc-chat-header-right">
        {streaming && (
          <button className="cc-header-btn cc-header-abort" onClick={onAbort} title="中断">
            ⏹
          </button>
        )}
        {hasMessages && !streaming && (
          <>
            <button
              className={`cc-header-btn ${searchActive ? "active" : ""}`}
              onClick={onSearch}
              title="对话搜索 (Ctrl+F)"
            >
              🔍
            </button>
            <button className="cc-header-btn" onClick={onRewind} title="回退">
              ↩
            </button>
            <button className="cc-header-btn" onClick={onExport} title="导出">
              ⬇
            </button>
          </>
        )}
        <button className="cc-header-btn" onClick={onOpenContext} title="上下文用量">
          📊
        </button>
        <button className="cc-header-btn" onClick={onOpenUsage} title="使用统计">
          📈
        </button>
        <button className="cc-header-btn" onClick={onOpenHistory} title="历史会话">
          🕘
        </button>
        <button className="cc-header-btn" onClick={onOpenSettings} title="设置">
          ⚙
        </button>
      </div>

      {messageCount > 0 && (
        <span className="cc-header-msg-count">{messageCount} msg</span>
      )}
    </div>
  );
}
