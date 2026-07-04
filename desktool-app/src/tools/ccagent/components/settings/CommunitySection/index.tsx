// CommunitySection — 社区（对齐 cc-gui CommunitySection）
// Sprint D: 项目链接/反馈/更新

export function CommunitySection() {
  return (
    <div className="cc-settings-block">
      <div className="cc-settings-block-title">🌐 社区</div>

      <div className="cc-community-links">
        <a className="cc-community-link" href="https://github.com/anthropics/claude-code" target="_blank" rel="noreferrer">
          <span className="cc-community-icon">🐙</span>
          <div>
            <div className="cc-community-name">Claude Code GitHub</div>
            <div className="cc-community-desc">官方仓库，问题反馈</div>
          </div>
        </a>

        <a className="cc-community-link" href="https://docs.anthropic.com" target="_blank" rel="noreferrer">
          <span className="cc-community-icon">📚</span>
          <div>
            <div className="cc-community-name">Anthropic 文档</div>
            <div className="cc-community-desc">API 文档与指南</div>
          </div>
        </a>

        <a className="cc-community-link" href="https://modelcontextprotocol.io" target="_blank" rel="noreferrer">
          <span className="cc-community-icon">🔌</span>
          <div>
            <div className="cc-community-name">MCP 协议</div>
            <div className="cc-community-desc">Model Context Protocol 官网</div>
          </div>
        </a>

        <a className="cc-community-link" href="https://discord.gg/anthropic" target="_blank" rel="noreferrer">
          <span className="cc-community-icon">💬</span>
          <div>
            <div className="cc-community-name">Discord 社区</div>
            <div className="cc-community-desc">加入讨论与获取帮助</div>
          </div>
        </a>
      </div>

      <div className="cc-setting-hint">
        💡 DeskTool CC Agent 基于 Claude Code Agent SDK 和 cc-gui 开源项目构建。
      </div>
    </div>
  );
}
