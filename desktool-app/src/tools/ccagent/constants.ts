// CC Agent 常量

import type { Engine, ProviderPreset } from "./types";

export const PROVIDER_PRESETS: ProviderPreset[] = [
  { id: "official", name: "Anthropic 官方" },
  { id: "zhipu", name: "智谱 GLM", baseUrl: "https://open.bigmodel.cn/api/anthropic", customModels: [{ value: "glm-4.7", label: "GLM-4.7" }] },
  { id: "kimi", name: "Kimi (月之暗面)", baseUrl: "https://api.moonshot.cn/anthropic", customModels: [{ value: "kimi-k2.5", label: "Kimi-K2.5" }] },
  { id: "deepseek", name: "DeepSeek", baseUrl: "https://api.deepseek.com/anthropic", customModels: [{ value: "deepseek-v4-flash", label: "DeepSeek-V4-Flash" }, { value: "deepseek-v4-pro[1m]", label: "DeepSeek-V4-Pro" }] },
  { id: "minimax", name: "MiniMax", baseUrl: "https://api.minimaxi.com/anthropic", customModels: [{ value: "MiniMax-M2.1", label: "MiniMax M2.1" }] },
  { id: "xiaomi", name: "小米 Mimo", baseUrl: "https://api.xiaomimimo.com/anthropic", customModels: [{ value: "mimo-v2.5-pro", label: "Mimo-V2.5-Pro" }] },
  { id: "qwen", name: "通义千问", baseUrl: "https://dashscope.aliyuncs.com/apps/anthropic", customModels: [{ value: "qwen3-max", label: "Qwen3-Max" }] },
  { id: "openrouter", name: "OpenRouter", baseUrl: "https://openrouter.ai/api", customModels: [{ value: "anthropic/claude-opus-4.5", label: "Opus 4.5 (OpenRouter)" }, { value: "anthropic/claude-sonnet-4.5", label: "Sonnet 4.5 (OpenRouter)" }] },
  { id: "custom", name: "自定义" },
];

export const MODELS: Record<Engine, { value: string; label: string }[]> = {
  claude: [
    { value: "", label: "默认" },
    { value: "opus", label: "Opus (最强)" },
    { value: "sonnet", label: "Sonnet (均衡)" },
    { value: "haiku", label: "Haiku (快速)" },
    { value: "claude-opus-4-8", label: "Opus 4.8" },
  ],
  codex: [
    { value: "", label: "默认" },
    { value: "o3", label: "o3" },
    { value: "o4-mini", label: "o4-mini" },
    { value: "gpt-4.1", label: "GPT-4.1" },
  ],
};

export const EFFORT_LEVELS = ["low", "medium", "high", "xhigh", "max"];

export const PERMISSION_MODES = [
  { value: "default", label: "默认（交互审批）" },
  { value: "acceptEdits", label: "自动接受编辑" },
  { value: "bypassPermissions", label: "跳过所有权限" },
];

export const DEFAULT_SLASH_COMMANDS = [
  { cmd: "/init", desc: "初始化项目 CLAUDE.md" },
  { cmd: "/review", desc: "代码审查" },
  { cmd: "/clear", desc: "清空对话" },
  { cmd: "/compact", desc: "压缩上下文" },
  { cmd: "/security-review", desc: "安全审计" },
  { cmd: "/code-review", desc: "代码评审" },
  { cmd: "/debug", desc: "调试模式" },
  { cmd: "/simplify", desc: "简化代码" },
];

export const TOOL_LABELS: Record<string, string> = {
  Bash: "⚡ 终端命令", Read: "📖 读取文件", Write: "✏️ 写入文件",
  Edit: "📝 编辑文件", WebFetch: "🌐 获取网页", WebSearch: "🔍 搜索网页",
  Task: "📋 任务管理", TaskCreate: "📋 创建任务", TaskUpdate: "📋 更新任务",
  LSP: "🔧 LSP", Skill: "🎭 技能", MultiEdit: "📝 批量编辑",
  NotebookEdit: "📓 笔记本编辑", Agent: "🤖 子Agent",
};

export const SAFE_TOOLS = new Set([
  "Read", "Glob", "Grep", "LSP", "TodoWrite",
  "TaskCreate", "TaskUpdate", "TaskGet", "TaskList",
]);

export const uid = () => Math.random().toString(36).slice(2, 10);
