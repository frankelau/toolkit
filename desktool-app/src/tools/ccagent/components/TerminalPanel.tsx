// TerminalPanel.tsx — 终端面板（带命令提示）
// 对齐 cc-gui 终端功能，基于 cc_agent/terminal.rs 后端

import { useState, useRef, useCallback, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

interface TerminalSession {
  id: string;
  cwd: string;
}

interface CommandSuggestion {
  cmd: string;
  desc: string;
  category: "git" | "npm" | "system" | "claude" | "codex";
}

/** 命令提示列表 */
const COMMAND_SUGGESTIONS: CommandSuggestion[] = [
  // Git
  { cmd: "git status", desc: "查看仓库状态", category: "git" },
  { cmd: "git diff --staged", desc: "查看暂存变更", category: "git" },
  { cmd: "git add .", desc: "暂存所有变更", category: "git" },
  { cmd: "git commit -m ''", desc: "提交暂存变更", category: "git" },
  { cmd: "git log --oneline -10", desc: "最近10条提交", category: "git" },
  { cmd: "git branch", desc: "列出分支", category: "git" },
  { cmd: "git pull --rebase", desc: "拉取并变基", category: "git" },
  { cmd: "git push", desc: "推送到远程", category: "git" },
  // npm
  { cmd: "npm install", desc: "安装依赖", category: "npm" },
  { cmd: "npm run build", desc: "构建项目", category: "npm" },
  { cmd: "npm run dev", desc: "启动开发服务器", category: "npm" },
  { cmd: "npm test", desc: "运行测试", category: "npm" },
  { cmd: "npx tsc --noEmit", desc: "TypeScript 类型检查", category: "npm" },
  // Claude/Codex
  { cmd: "claude", desc: "启动 Claude Code 交互", category: "claude" },
  { cmd: "claude -p 'prompt'", desc: "Claude 单次查询", category: "claude" },
  { cmd: "codex", desc: "启动 Codex 交互", category: "codex" },
  // System
  { cmd: "ls -la", desc: "列出文件详情", category: "system" },
  { cmd: "pwd", desc: "当前目录", category: "system" },
  { cmd: "cargo build", desc: "Rust 构建", category: "system" },
  { cmd: "cargo check", desc: "Rust 快速检查", category: "system" },
];

export default function TerminalPanel() {
  const [sessions, setSessions] = useState<TerminalSession[]>([]);
  const [activeSession, setActiveSession] = useState<string | null>(null);
  const [output, setOutput] = useState<string[]>([]);
  const [input, setInput] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [filteredSuggestions, setFilteredSuggestions] = useState(COMMAND_SUGGESTIONS);
  const outputRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // 自动滚动到底部
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [output]);

  // 启动终端会话
  const startTerminal = useCallback(async () => {
    try {
      const cwd = await invoke<string>("cc_get_working_directory", {
        key: "default",
      }).catch(() => ".");
      const sid = await invoke<string>("cc_start_terminal", {
        cwd: cwd || ".",
        command: null,
      });
      setSessions((prev) => [...prev, { id: sid, cwd: cwd || "." }]);
      setActiveSession(sid);
      setOutput([`$ Terminal started in ${cwd || "."}`]);

      // 监听输出
      const unlisten = await listen(`cc-terminal-${sid}`, (event: any) => {
        const payload = event.payload as { type: string; data?: string };
        if (payload.type === "exit") {
          setOutput((prev) => [...prev, "[Process exited]"]);
        } else if (payload.data != null) {
          setOutput((prev) => [...prev, payload.data!]);
        }
      });

      return () => unlisten();
    } catch (e) {
      setOutput((prev) => [...prev, `Error: ${e}`]);
    }
  }, []);

  // 执行命令
  const runCommand = useCallback(
    async (cmd: string) => {
      if (!cmd.trim()) return;
      setOutput((prev) => [...prev, `$ ${cmd}`]);

      try {
        const result = await invoke<{
          stdout: string;
          stderr: string;
          success: boolean;
          exit_code: number | null;
        }>("cc_execute_terminal_command", {
          command: cmd,
          cwd: sessions.find((s) => s.id === activeSession)?.cwd || ".",
          timeoutSecs: 30,
        });

        if (result.stdout) {
          for (const line of result.stdout.split("\n")) {
            if (line.trim()) setOutput((prev) => [...prev, line]);
          }
        }
        if (result.stderr) {
          for (const line of result.stderr.split("\n")) {
            if (line.trim()) setOutput((prev) => [...prev, `[stderr] ${line}`]);
          }
        }
        if (result.exit_code !== 0) {
          setOutput((prev) => [...prev, `[exit code: ${result.exit_code}]`]);
        }
      } catch (e) {
        setOutput((prev) => [...prev, `Error: ${e}`]);
      }
    },
    [activeSession, sessions],
  );

  // 输入处理
  const handleInputChange = (value: string) => {
    setInput(value);
    if (value.trim()) {
      const filtered = COMMAND_SUGGESTIONS.filter(
        (s) =>
          s.cmd.includes(value.trim()) || s.desc.includes(value.trim()),
      );
      setFilteredSuggestions(filtered);
      setShowSuggestions(filtered.length > 0);
    } else {
      setShowSuggestions(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      runCommand(input);
      setInput("");
      setShowSuggestions(false);
    } else if (e.key === "Tab" && showSuggestions && filteredSuggestions.length > 0) {
      e.preventDefault();
      setInput(filteredSuggestions[0].cmd);
      setShowSuggestions(false);
    }
  };

  // 分类颜色
  const categoryColor = (cat: string) => {
    switch (cat) {
      case "git": return "#f14e32";
      case "npm": return "#cb3837";
      case "claude": return "#d97706";
      case "codex": return "#10b981";
      default: return "#6b7280";
    }
  };

  return (
    <div className="cc-terminal-panel">
      <div className="cc-terminal-toolbar">
        <span className="cc-terminal-title">🖥 Terminal</span>
        <div className="cc-terminal-actions">
          {sessions.length === 0 ? (
            <button className="cc-terminal-btn" onClick={startTerminal}>
              ▶ 启动终端
            </button>
          ) : (
            <>
              <button
                className="cc-terminal-btn"
                onClick={() => setOutput([])}
              >
                🗑 清屏
              </button>
              <button className="cc-terminal-btn" onClick={startTerminal}>
                + 新会话
              </button>
            </>
          )}
        </div>
      </div>

      {/* 输出区 */}
      <div className="cc-terminal-output" ref={outputRef}>
        {output.map((line, i) => (
          <div key={i} className="cc-terminal-line">
            {line}
          </div>
        ))}
      </div>

      {/* 输入区 */}
      <div className="cc-terminal-input-area">
        <span className="cc-terminal-prompt">$</span>
        <div className="cc-terminal-input-wrap">
          <input
            ref={inputRef}
            type="text"
            className="cc-terminal-input"
            value={input}
            onChange={(e) => handleInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => {
              if (input.trim()) setShowSuggestions(true);
            }}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
            placeholder="输入命令 (Tab 补全)..."
            disabled={sessions.length === 0}
          />

          {/* 命令提示下拉 */}
          {showSuggestions && (
            <div className="cc-terminal-suggestions">
              {filteredSuggestions.map((s, i) => (
                <div
                  key={i}
                  className="cc-terminal-suggestion"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    setInput(s.cmd);
                    setShowSuggestions(false);
                    inputRef.current?.focus();
                  }}
                >
                  <span
                    className="cc-suggestion-cat"
                    style={{ color: categoryColor(s.category) }}
                  >
                    [{s.category}]
                  </span>
                  <span className="cc-suggestion-cmd">{s.cmd}</span>
                  <span className="cc-suggestion-desc">{s.desc}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
