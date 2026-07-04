// MCP 预设服务器（对齐 cc-gui McpPresetDialog 数据）
// Sprint C: 常用 MCP 服务器一键添加

import type { McpPreset } from "../types";

export const MCP_PRESETS: McpPreset[] = [
  {
    name: "filesystem",
    description: "文件系统访问（读写本地文件）",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-filesystem", "."],
  },
  {
    name: "github",
    description: "GitHub 仓库操作（issues/PR/搜索）",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-github"],
    env: { GITHUB_PERSONAL_ACCESS_TOKEN: "" },
  },
  {
    name: "fetch",
    description: "网页抓取（URL → 文本）",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-fetch"],
  },
  {
    name: "memory",
    description: "知识图谱记忆（持久化上下文）",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-memory"],
  },
  {
    name: "sqlite",
    description: "SQLite 数据库查询",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-sqlite", "--db-path", "data.db"],
  },
  {
    name: "postgres",
    description: "PostgreSQL 数据库（只读查询）",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-postgres"],
    env: { DATABASE_URL: "" },
  },
  {
    name: "puppeteer",
    description: "浏览器自动化（截图/点击/表单）",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-puppeteer"],
  },
  {
    name: "brave-search",
    description: "Brave 搜索引擎",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-brave-search"],
    env: { BRAVE_API_KEY: "" },
  },
  {
    name: "sequential-thinking",
    description: "顺序思考（动态问题解决）",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-sequential-thinking"],
  },
  {
    name: "time",
    description: "时间与时区",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-time"],
  },
];
