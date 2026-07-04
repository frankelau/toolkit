// ProviderNotConfiguredCard — Provider 未配置时的引导卡片

export interface ProviderNotConfiguredCardProps {
  provider: "claude" | "codex";
  reason: "no-api-key" | "not-installed" | "invalid";
  onOpenSettings?: () => void;
}

export function ProviderNotConfiguredCard(props: ProviderNotConfiguredCardProps) {
  const { provider, reason, onOpenSettings } = props;

  const title = provider === "claude" ? "Claude Code 未配置" : "Codex 未配置";
  const icon = provider === "claude" ? "🤖" : "💻";

  const messages: Record<typeof reason, { desc: string; action: string }> = {
    "no-api-key": {
      desc: "未配置 API Key，请前往设置填写",
      action: "配置 API Key",
    },
    "not-installed": {
      desc: `${provider === "claude" ? "claude" : "codex"} CLI 未安装或不在 PATH`,
      action: "查看依赖",
    },
    invalid: {
      desc: "API Key 无效或已过期",
      action: "更新 API Key",
    },
  };

  const { desc, action } = messages[reason];

  return (
    <div className="cc-provider-not-configured">
      <div className="cc-provider-not-configured-icon">{icon}</div>
      <div className="cc-provider-not-configured-title">{title}</div>
      <div className="cc-provider-not-configured-desc">{desc}</div>
      {onOpenSettings && (
        <button className="cc-provider-not-configured-btn" onClick={onOpenSettings}>
          {action} →
        </button>
      )}
    </div>
  );
}
