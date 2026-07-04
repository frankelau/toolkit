// ChatInputBoxHeader — 输入框头部（对齐 cc-gui ChatInputBoxHeader）
// Sprint B: 显示工作目录 + 引擎标识 + 上下文信息

interface ChatInputBoxHeaderProps {
  cwd: string;
  engine: "claude" | "codex";
  sessionId: string | null;
}

export function ChatInputBoxHeader({ cwd, engine, sessionId }: ChatInputBoxHeaderProps) {
  const dirName = cwd ? cwd.split("/").filter(Boolean).pop() || cwd : "未选目录";
  return (
    <div className="cc-input-header">
      <button className="cc-input-btn" title={`工作目录: ${cwd}`}>📁 {dirName}</button>
      <span className="cc-input-engine-badge">{engine === "claude" ? "🧠 Claude" : "⚡ Codex"}</span>
      {sessionId && <span className="cc-input-session-id" title={sessionId}>{sessionId.slice(0, 8)}</span>}
    </div>
  );
}
