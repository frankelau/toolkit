// dollarCommandProvider — $命令自动补全提供器

interface DollarCommand {
  cmd: string;
  desc: string;
}

/** $命令列表 */
export const DOLLAR_COMMANDS: DollarCommand[] = [
  { cmd: "$RENAME", desc: "重命名当前会话" },
  { cmd: "$SWITCH", desc: "切换引擎 (claude/codex)" },
  { cmd: "$CLEAR", desc: "清空当前对话" },
  { cmd: "$EXPORT", desc: "导出当前会话" },
  { cmd: "$RESET", desc: "重置会话上下文" },
  { cmd: "$TOGGLE_STREAMING", desc: "切换流式输出" },
  { cmd: "$TOGGLE_THINKING", desc: "切换思考模式" },
];

/** 检查输入是否触发了 $ 命令 */
export function detectDollarCommand(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed.startsWith("$")) return null;

  for (const cmd of DOLLAR_COMMANDS) {
    if (trimmed.startsWith(cmd.cmd)) return cmd.cmd;
  }
  return null;
}

/** 获取匹配当前输入的 $ 命令列表（用于自动补全） */
export function getMatchingDollarCommands(input: string): DollarCommand[] {
  const trimmed = input.trim();
  if (!trimmed.startsWith("$")) return [];

  const prefix = trimmed.toUpperCase();
  return DOLLAR_COMMANDS.filter(c => c.cmd.startsWith(prefix));
}

/** 执行 $ 命令返回操作类型和参数 */
export function parseDollarCommand(input: string): { action: string; args: string } | null {
  const cmd = detectDollarCommand(input);
  if (!cmd) return null;

  const args = input.slice(cmd.length).trim();
  return { action: cmd, args };
}
