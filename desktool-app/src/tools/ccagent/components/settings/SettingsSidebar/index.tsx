// SettingsSidebar — 设置侧边导航（对齐 cc-gui SettingsSidebar）
// Sprint D: 按分区组织设置项

export type SettingsTab =
  | "basic" | "provider" | "codexProvider" | "promptEnhancer"
  | "agent" | "prompt" | "mcp" | "skills" | "permissions"
  | "usage" | "dependency" | "commit" | "community" | "other";

export interface SettingsSidebarItem {
  id: SettingsTab;
  label: string;
  icon: string;
  group: "基础" | "AI 能力" | "集成" | "其它";
}

export const SETTINGS_TABS: SettingsSidebarItem[] = [
  { id: "basic", label: "基础配置", icon: "⚙️", group: "基础" },
  { id: "provider", label: "Claude Provider", icon: "🧠", group: "AI 能力" },
  { id: "codexProvider", label: "Codex Provider", icon: "⚡", group: "AI 能力" },
  { id: "promptEnhancer", label: "提示词增强", icon: "✨", group: "AI 能力" },
  { id: "agent", label: "Agent 管理", icon: "🤖", group: "AI 能力" },
  { id: "prompt", label: "系统 Prompt", icon: "📝", group: "AI 能力" },
  { id: "mcp", label: "MCP 服务器", icon: "🔌", group: "集成" },
  { id: "skills", label: "技能管理", icon: "🎭", group: "集成" },
  { id: "permissions", label: "权限配置", icon: "🔒", group: "集成" },
  { id: "usage", label: "使用统计", icon: "📊", group: "集成" },
  { id: "dependency", label: "依赖检查", icon: "📦", group: "其它" },
  { id: "commit", label: "提交配置", icon: "💾", group: "其它" },
  { id: "community", label: "社区", icon: "🌐", group: "其它" },
  { id: "other", label: "其它设置", icon: "🔧", group: "其它" },
];

interface SettingsSidebarProps {
  activeTab: SettingsTab;
  onTabChange: (tab: SettingsTab) => void;
}

export function SettingsSidebar({ activeTab, onTabChange }: SettingsSidebarProps) {
  const groups = ["基础", "AI 能力", "集成", "其它"] as const;
  return (
    <div className="cc-settings-sidebar">
      {groups.map(group => (
        <div key={group} className="cc-settings-sidebar-group">
          <div className="cc-settings-sidebar-group-title">{group}</div>
          {SETTINGS_TABS.filter(t => t.group === group).map(tab => (
            <button
              key={tab.id}
              className={`cc-settings-sidebar-item ${activeTab === tab.id ? "active" : ""}`}
              onClick={() => onTabChange(tab.id)}
            >
              <span className="cc-settings-sidebar-icon">{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}
