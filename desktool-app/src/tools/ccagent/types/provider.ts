// provider.ts — Provider 相关类型

export interface ProviderPreset {
  id: string;
  name: string;
  baseUrl?: string;
  apiKey?: string;
  customModels?: { value: string; label: string }[];
}

// ============ Codex Provider ============

/** 单个环境变量条目 */
export interface EnvVarEntry {
  /** 环境变量名 */
  key: string;
  /** 环境变量值 */
  value: string;
}

/** Codex 受保护的环境变量名（不可被自定义覆盖） */
export const CODEX_PROTECTED_ENV_KEYS: ReadonlySet<string> = new Set([
  "CODEX_USE_STDIN", "CODEX_MODEL", "CODEX_SANDBOX_MODE", "CODEX_SANDBOX",
  "CODEX_APPROVAL_POLICY", "CODEX_CI", "CODEX_SANDBOX_NETWORK_DISABLED",
  "CODEX_HOME", "CLAUDE_SESSION_ID", "CLAUDE_PERMISSION_DIR",
  "HOME", "PATH", "TMPDIR", "TEMP", "TMP",
  "IDEA_PROJECT_PATH", "PROJECT_PATH", "CLAUDE_USE_STDIN",
]);

/** 环境变量值最大长度（避免超过 OS ARG_MAX） */
export const ENV_VAR_VALUE_MAX_LENGTH = 16 * 1024;

/** 校验环境变量名是否合法（字母/下划线开头，后接字母/数字/下划线） */
export function isValidEnvVarKey(key: string): boolean {
  if (!key || typeof key !== "string") return false;
  return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key);
}

/** 检查是否为受保护的 Codex 内置变量（大小写不敏感） */
export function isProtectedEnvVarKey(key: string): boolean {
  return CODEX_PROTECTED_ENV_KEYS.has(key.toUpperCase());
}

export interface EnvVarValidationIssue {
  index: number;
  field: "key" | "value";
  reason: "invalid" | "protected" | "duplicate" | "value_too_long";
  key?: string;
}

/** 批量校验环境变量条目，返回每行首个问题 */
export function validateEnvVarEntries(entries: EnvVarEntry[]): EnvVarValidationIssue[] {
  const issues: EnvVarValidationIssue[] = [];
  const seenKeys = new Set<string>();
  entries.forEach((entry, index) => {
    if (entry.value.length > ENV_VAR_VALUE_MAX_LENGTH) {
      issues.push({ index, field: "value", reason: "value_too_long" });
    }
    const key = entry.key.trim();
    if (!key) return;
    if (!isValidEnvVarKey(key)) {
      issues.push({ index, field: "key", reason: "invalid", key });
      return;
    }
    if (isProtectedEnvVarKey(key)) {
      issues.push({ index, field: "key", reason: "protected", key });
      return;
    }
    const upperKey = key.toUpperCase();
    if (seenKeys.has(upperKey)) {
      issues.push({ index, field: "key", reason: "duplicate", key });
      return;
    }
    seenKeys.add(upperKey);
  });
  return issues;
}

/** Codex Provider 配置 */
export interface CodexProviderConfig {
  id: string;
  name: string;
  remark?: string;
  createdAt?: number;
  isActive?: boolean;
  /** config.toml 原始内容 */
  configToml?: string;
  /** auth.json 原始内容 */
  authJson?: string;
  customModels?: { value: string; label: string; description?: string }[];
  /** sendMessage 子进程的环境变量 */
  messageEnvVars?: EnvVarEntry[];
  /** getMcpServerTools 子进程的环境变量 */
  mcpEnvVars?: EnvVarEntry[];
}

/** 版本日志条目 */
export interface ChangelogEntry {
  version: string;
  date: string;
  content: { en: string; zh: string };
}
