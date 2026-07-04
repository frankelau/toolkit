// McpHelpDialog — MCP 帮助弹窗
// Sprint C: MCP 协议说明 + 配置格式

interface McpHelpDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function McpHelpDialog({ isOpen, onClose }: McpHelpDialogProps) {
  if (!isOpen) return null;
  return (
    <div className="cc-mcp-dialog-overlay" onClick={onClose}>
      <div className="cc-mcp-help-dialog" onClick={e => e.stopPropagation()}>
        <div className="cc-mcp-dialog-title">📖 MCP 帮助</div>
        <div className="cc-mcp-help-content">
          <h4>什么是 MCP？</h4>
          <p>MCP (Model Context Protocol) 是 Anthropic 推出的标准协议，让 AI 模型可以连接外部工具和数据源。</p>

          <h4>连接类型</h4>
          <ul>
            <li><b>stdio</b>：通过启动本地子进程通信（最常用）</li>
            <li><b>http</b>：连接 HTTP 服务器</li>
            <li><b>sse</b>：通过 Server-Sent Events 连接</li>
          </ul>

          <h4>配置示例</h4>
          <pre>{`{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "."]
    }
  }
}`}</pre>

          <h4>常用命令</h4>
          <ul>
            <li>添加预设：点击「+ 预设」从常用 MCP 服务器列表选择</li>
            <li>自定义添加：点击「+ 添加」手动配置</li>
            <li>查看工具：点击服务器卡片展开</li>
            <li>启用/停用：点击服务器卡片上的开关</li>
          </ul>

          <h4>环境变量</h4>
          <p>部分服务器需要环境变量（如 GitHub 的 GITHUB_PERSONAL_ACCESS_TOKEN），在服务器配置中填写。</p>
        </div>
        <div className="cc-mcp-dialog-actions">
          <button className="cc-mcp-save" onClick={onClose}>知道了</button>
        </div>
      </div>
    </div>
  );
}
