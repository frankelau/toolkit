// errorMatcher.ts — 错误模式匹配（增强版，对齐 cc-gui errorMatcher）

export interface DiagnosticPattern {
  id: string;
  title: string;
  steps: string[];
  commands?: string[];
  settingsLink?: "dependencies" | "permissions" | "provider";
}

const ERROR_PATTERNS: Array<{ regex: RegExp; pattern: Omit<DiagnosticPattern, "id"> }> = [
  {
    regex: /command not found|not recognized as an internal/i,
    pattern: {
      title: "命令未找到",
      steps: ["检查命令拼写是否正确", "确认对应工具已安装并加入 PATH", "查看「设置 → 依赖检查」确认环境"],
      commands: ["which <command>", "echo $PATH"],
      settingsLink: "dependencies",
    },
  },
  {
    regex: /permission denied|EACCES/i,
    pattern: {
      title: "权限不足",
      steps: ["检查文件/目录权限", "若为 Claude Code 工具调用，可在「设置 → 权限」中授权"],
      settingsLink: "permissions",
    },
  },
  {
    regex: /ENOTFOUND|getaddrinfo|network|connection refused/i,
    pattern: {
      title: "网络连接失败",
      steps: ["检查网络/代理设置", "确认 API base URL 是否可达", "若使用代理，请检查系统代理状态"],
      commands: ["curl -I <base_url>"],
      settingsLink: "provider",
    },
  },
  {
    regex: /401|unauthorized|invalid api key|invalid_api_key/i,
    pattern: {
      title: "API Key 无效",
      steps: ["前往「设置 → Provider」检查 API Key", "确认 Key 未过期/未被吊销", "切换到官方或其它可用 Provider"],
      settingsLink: "provider",
    },
  },
  {
    regex: /429|rate limit|too many requests/i,
    pattern: {
      title: "请求频率超限",
      steps: ["降低请求频率", "升级账户额度", "切换到其它 Provider"],
    },
  },
  {
    regex: /context length|context window|too long/i,
    pattern: {
      title: "上下文超长",
      steps: ["使用 /compact 压缩对话", "新建会话", "清理无用的历史消息"],
    },
  },
  {
    regex: /ENOENT|no such file or directory/i,
    pattern: {
      title: "文件不存在",
      steps: ["检查文件路径是否正确", "确认工作目录设置", "使用绝对路径而非相对路径"],
    },
  },
  {
    regex: /EADDRINUSE|address already in use/i,
    pattern: {
      title: "端口被占用",
      steps: ["检查端口是否被其他进程占用", "更换端口", "终止占用端口的进程"],
      commands: ["lsof -i :<port>"],
    },
  },
];

export function matchErrorPattern(errorText: string): DiagnosticPattern | null {
  for (let i = 0; i < ERROR_PATTERNS.length; i++) {
    const { regex, pattern } = ERROR_PATTERNS[i];
    if (regex.test(errorText)) {
      return { id: `err-${i}`, ...pattern };
    }
  }
  return null;
}
