// HomePage.tsx — 应用主页 / Dashboard
// 启动时显示，展示常用工具快速入口

import { useMemo } from "react";
import { TOOLS, TOOL_MAP } from "./tools/registry";
import type { ToolCategory } from "./tools/types";
import { CATEGORY_LABELS } from "./tools/types";

interface HomePageProps {
  openTool: (toolId: string) => void;
  favorites: string[];
  recent: string[];
}

const CATEGORY_ICONS: Record<ToolCategory, string> = {
  format: "📝",
  encode: "🔀",
  network: "🌐",
  image: "🖼️",
  ai: "🤖",
  reference: "📚",
  productivity: "⚡",
};

export default function HomePage({ openTool, favorites, recent }: HomePageProps) {
  const recentTools = useMemo(
    () => recent.map(rid => TOOL_MAP.get(rid)).filter(Boolean),
    [recent]
  );

  const favTools = useMemo(
    () => favorites.map(fid => TOOL_MAP.get(fid)).filter(Boolean),
    [favorites]
  );

  const categoryCounts = useMemo(() => {
    const map = new Map<ToolCategory, number>();
    for (const t of TOOLS) {
      map.set(t.category, (map.get(t.category) || 0) + 1);
    }
    return map;
  }, []);

  return (
    <div className="home-page">
      {/* 头部 */}
      <div className="home-header">
        <div className="home-brand">
          <span className="home-logo">🧰</span>
          <div>
            <h1 className="home-title">DevKit</h1>
            <p className="home-subtitle">极客工具箱 — {TOOLS.length} 个实用工具</p>
          </div>
        </div>
      </div>

      {/* 快速入口 */}
      <div className="home-section">
        <div className="home-section-title">🚀 快速开始</div>
        <div className="home-quick-grid">
          {/* CC Agent */}
          <button className="home-quick-card home-quick-primary" onClick={() => openTool("F40")}>
            <span className="home-quick-icon">🧠</span>
            <span className="home-quick-label">CC Agent</span>
            <span className="home-quick-desc">Claude Code / Codex CLI 可视化</span>
          </button>
          {/* 智能助手 */}
          <button className="home-quick-card" onClick={() => openTool("F20")}>
            <span className="home-quick-icon">🤖</span>
            <span className="home-quick-label">智能助手</span>
            <span className="home-quick-desc">AI 流式对话</span>
          </button>
          {/* Postman */}
          <button className="home-quick-card" onClick={() => openTool("F05")}>
            <span className="home-quick-icon">⇅</span>
            <span className="home-quick-label">简易 Postman</span>
            <span className="home-quick-desc">HTTP 接口调试</span>
          </button>
          {/* JSON */}
          <button className="home-quick-card" onClick={() => openTool("F01")}>
            <span className="home-quick-icon">{}</span>
            <span className="home-quick-label">JSON 美化</span>
            <span className="home-quick-desc">格式化/校验/压缩</span>
          </button>
        </div>
      </div>

      {/* 收藏 */}
      {favTools.length > 0 && (
        <div className="home-section">
          <div className="home-section-title">⭐ 收藏工具</div>
          <div className="home-tool-grid">
            {favTools.map(t => t && (
              <button key={t.id} className="home-tool-card" onClick={() => openTool(t.id)}>
                <span className="home-tool-icon">{t.icon}</span>
                <span className="home-tool-name">{t.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 最近使用 */}
      {recentTools.length > 0 && (
        <div className="home-section">
          <div className="home-section-title">🕐 最近使用</div>
          <div className="home-tool-grid">
            {recentTools.map(t => t && (
              <button key={t.id} className="home-tool-card" onClick={() => openTool(t.id)}>
                <span className="home-tool-icon">{t.icon}</span>
                <span className="home-tool-name">{t.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 分类浏览 */}
      <div className="home-section">
        <div className="home-section-title">📂 工具分类</div>
        <div className="home-categories">
          {([...categoryCounts.entries()] as [ToolCategory, number][]).map(([cat, count]) => (
            <div key={cat} className="home-cat-card">
              <span className="home-cat-icon">{CATEGORY_ICONS[cat]}</span>
              <div>
                <div className="home-cat-name">{CATEGORY_LABELS[cat]}</div>
                <div className="home-cat-count">{count} 个工具</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 底部 */}
      <div className="home-footer">
        <span>Ctrl/Cmd+P 快速搜索 · 左侧栏浏览所有工具</span>
      </div>
    </div>
  );
}
