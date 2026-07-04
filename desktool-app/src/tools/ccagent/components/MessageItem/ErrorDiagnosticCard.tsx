// ErrorDiagnosticCard — 错误诊断卡片，自动匹配错误模式给出修复建议
// 对齐 cc-gui ErrorDiagnosticCard + errorMatcher

import { useLocale } from "../../hooks/useLocale";
import { useState } from "react";
import { CollapsibleTextBlock } from "../CollapsibleTextBlock";

export interface DiagnosticPattern {
  id: string;
  /** 错误标题 */
  title: string;
  /** 修复步骤 */
  steps: string[];
  /** 可执行命令 */
  commands?: string[];
  /** 跳转设置入口 */
  settingsLink?: "dependencies" | "permissions" | "provider";
}

export interface ErrorDiagnosticCardProps {
  pattern: DiagnosticPattern;
  onNavigateToSettings?: (target: string) => void;
}

export function ErrorDiagnosticCard(props: ErrorDiagnosticCardProps) {
  const { pattern, onNavigateToSettings } = props;
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  const copy = async (text: string, idx: number) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIdx(idx);
      setTimeout(() => setCopiedIdx(null), 1500);
    } catch {
      // ignore
    }
  };

  return (
    <div className="cc-error-diag">
      <div className="cc-error-diag-header">
        <span className="cc-error-diag-icon">ℹ️</span>
        <div className="cc-error-diag-title">{pattern.title}</div>
      </div>

      {pattern.steps.length > 0 && (
        <ol className="cc-error-diag-steps">
          {pattern.steps.map((s, i) => <li key={i}>{s}</li>)}
        </ol>
      )}

      {pattern.commands && pattern.commands.length > 0 && (
        <div className="cc-error-diag-commands">
          {pattern.commands.map((cmd, i) => (
            <div key={i} className="cc-error-diag-cmd">
              <code className="cc-error-diag-cmd-text">{cmd}</code>
              <button
                className={`cc-error-diag-copy ${copiedIdx === i ? "copied" : ""}`}
                onClick={() => copy(cmd, i)}
              >
                {copiedIdx === i ? "✓" : "复制"}
              </button>
            </div>
          ))}
        </div>
      )}

      {pattern.settingsLink && onNavigateToSettings && (
        <button
          className="cc-error-diag-link"
          onClick={() => onNavigateToSettings(pattern.settingsLink!)}
        >
          前往设置 →
        </button>
      )}
    </div>
  );
}

// ── 错误模式匹配 ──

const ERROR_PATTERNS: Array<{ regex: RegExp; pattern: Omit<DiagnosticPattern, "id"> }> = [
  {
    regex: /command not found|not recognized as an internal/i,
    pattern: {
      title: "命令未找到",
      steps: [
        "检查命令拼写是否正确",
        "确认对应工具已安装并加入 PATH",
        "查看「设置 → 依赖检查」确认环境",
      ],
      commands: ["which <command>", "echo $PATH"],
      settingsLink: "dependencies",
    },
  },
  {
    regex: /permission denied|EACCES/i,
    pattern: {
      title: "权限不足",
      steps: [
        "检查文件/目录权限",
        "若为 Claude Code 工具调用，可在「设置 → 权限」中授权",
      ],
      settingsLink: "permissions",
    },
  },
  {
    regex: /ENOTFOUND|getaddrinfo|network|connection refused/i,
    pattern: {
      title: "网络连接失败",
      steps: [
        "检查网络/代理设置",
        "确认 API base URL 是否可达",
        "若使用代理，请检查系统代理状态",
      ],
      commands: ["curl -I <base_url>"],
      settingsLink: "provider",
    },
  },
  {
    regex: /401|unauthorized|invalid api key|invalid_api_key/i,
    pattern: {
      title: "API Key 无效",
      steps: [
        "前往「设置 → Provider」检查 API Key",
        "确认 Key 未过期/未被吊销",
        "切换到官方或其它可用 Provider",
      ],
      settingsLink: "provider",
    },
  },
  {
    regex: /429|rate limit|too many requests/i,
    pattern: {
      title: "请求频率超限",
      steps: [
        "降低请求频率",
        "升级账户额度",
        "切换到其它 Provider",
      ],
    },
  },
  {
    regex: /context length|context window|too long/i,
    pattern: {
      title: "上下文超长",
      steps: [
        "使用 /compact 压缩对话",
        "新建会话",
        "清理无用的历史消息",
      ],
    },
  },
];

/** 从错误文本匹配诊断模式 */
export function matchErrorPattern(errorText: string): DiagnosticPattern | null {
  for (let i = 0; i < ERROR_PATTERNS.length; i++) {
    const { regex, pattern } = ERROR_PATTERNS[i];
    if (regex.test(errorText)) {
      return { id: `err-${i}`, ...pattern };
    }
  }
  return null;
}

/** 渲染错误消息时，若匹配到模式，附带诊断卡片 */
export function ErrorTextWithDiagnostic({
  text,
  onNavigateToSettings,
}: {
  text: string;
  onNavigateToSettings?: (target: string) => void;
}) {
  const { t } = useLocale();
  const pattern = matchErrorPattern(text);
  return (
    <div className="cc-error-text-with-diag">
      <CollapsibleTextBlock content={text} mono defaultExpanded maxHeight={120} title={t("errorDiagnosticCard.errorDiagnosticCard.k2")} />
      {pattern && <ErrorDiagnosticCard pattern={pattern} onNavigateToSettings={onNavigateToSettings} />}
    </div>
  );
}
