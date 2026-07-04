// slashCommandProvider — 斜杠命令补全（对齐 cc-gui slashCommandProvider）
// Sprint B: 触发 / 字符时，提供斜杠命令列表

import type { CompletionItem } from "../hooks/useCompletionDropdown";

interface SlashCommand {
  cmd: string;
  desc: string;
}

const DEFAULT_COMMANDS: SlashCommand[] = [
  { cmd: "/init", desc: "初始化项目 CLAUDE.md" },
  { cmd: "/review", desc: "代码审查" },
  { cmd: "/clear", desc: "清空对话" },
  { cmd: "/compact", desc: "压缩上下文" },
  { cmd: "/security-review", desc: "安全审计" },
  { cmd: "/code-review", desc: "代码评审" },
  { cmd: "/debug", desc: "调试模式" },
  { cmd: "/simplify", desc: "简化代码" },
  { cmd: "/resume", desc: "恢复历史会话" },
  { cmd: "/cost", desc: "查看消耗" },
  { cmd: "/help", desc: "帮助" },
];

export function getSlashCompletions(
  query: string,
  customCommands?: SlashCommand[],
): CompletionItem[] {
  const all = [...DEFAULT_COMMANDS, ...(customCommands ?? [])];
  const q = query.toLowerCase();
  return all
    .filter(c => !q || c.cmd.toLowerCase().includes(q))
    .slice(0, 20)
    .map(c => ({
      id: c.cmd,
      label: c.cmd,
      description: c.desc,
      icon: "⚡",
      insertText: c.cmd + " ",
      data: c,
    }));
}
