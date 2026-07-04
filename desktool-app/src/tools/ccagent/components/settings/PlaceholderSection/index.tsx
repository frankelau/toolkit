// PlaceholderSection — 占位设置区
// 对齐 cc-gui PlaceholderSection/index.tsx
// 用于"即将推出"的设置分区（permissions/mcp/agents/skills）

export interface PlaceholderSectionProps {
  type: "permissions" | "mcp" | "agents" | "skills";
  currentProvider?: string;
  children?: React.ReactNode;
}

const SECTION_CONFIG: Record<PlaceholderSectionProps["type"], {
  title: string;
  desc: string;
  icon: string;
  message: string | null;
}> = {
  permissions: {
    title: "权限配置",
    desc: "管理工具的允许/禁止列表",
    icon: "🛡️",
    message: "权限配置功能即将推出",
  },
  mcp: {
    title: "MCP 服务器",
    desc: "管理 Model Context Protocol 服务器",
    icon: "🖥️",
    message: null,
  },
  agents: {
    title: "Agent 管理",
    desc: "配置子 Agent",
    icon: "🤖",
    message: "Agent 管理功能即将推出",
  },
  skills: {
    title: "Skills 管理",
    desc: "管理 AI 技能包",
    icon: "🎭",
    message: null,
  },
};

export function PlaceholderSection({ type, children }: PlaceholderSectionProps) {
  const config = SECTION_CONFIG[type];

  return (
    <div className="cc-settings-block cc-placeholder-section">
      <div className="cc-settings-block-title">
        <span className="cc-placeholder-icon">{config.icon}</span>
        {config.title}
      </div>
      <div className="cc-settings-block-desc">{config.desc}</div>

      {children ? (
        <div className="cc-placeholder-content">{children}</div>
      ) : config.message ? (
        <div className="cc-placeholder-empty">
          <span className="cc-placeholder-empty-icon">🚧</span>
          <p>{config.message}</p>
        </div>
      ) : null}
    </div>
  );
}

export default PlaceholderSection;
