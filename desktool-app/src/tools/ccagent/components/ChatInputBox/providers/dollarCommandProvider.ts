// dollarCommandProvider — $ 命令补全（对齐 cc-gui dollarCommandProvider）
// Sprint B: 触发 $ 字符时，提供环境变量/特殊命令补全

import type { CompletionItem } from "../hooks/useCompletionDropdown";

const DOLLAR_COMMANDS: { cmd: string; desc: string }[] = [
  { cmd: "$HOME", desc: "用户主目录" },
  { cmd: "$CWD", desc: "当前工作目录" },
  { cmd: "$PROJECT", desc: "项目根目录" },
  { cmd: "$SESSION_ID", desc: "当前会话 ID" },
  { cmd: "$MODEL", desc: "当前模型" },
  { cmd: "$ENGINE", desc: "当前引擎" },
  { cmd: "$DATE", desc: "当前日期" },
  { cmd: "$TIME", desc: "当前时间" },
];

export function getDollarCompletions(query: string): CompletionItem[] {
  const q = query.toLowerCase();
  return DOLLAR_COMMANDS
    .filter(c => !q || c.cmd.toLowerCase().includes(q))
    .map(c => ({
      id: c.cmd,
      label: c.cmd,
      description: c.desc,
      icon: "💲",
      insertText: c.cmd,
      data: c,
    }));
}
