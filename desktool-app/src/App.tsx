import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { TOOLS, TOOL_MAP } from "./tools/registry";
import { CATEGORY_LABELS, type ToolCategory } from "./tools/types";
import { useTheme } from "./useTheme";
import { loadState, saveState } from "./storage";
import { installEditorShortcuts, installTabIndent } from "./editorShortcuts";
import { listenCompose } from "./tools/proxyCompose";
import { toast } from "./useCopyFeedback";
import HomePage from "./HomePage";
import ToastHost from "./components/Toast";
import "./App.css";

interface Tab {
  key: string;
  toolId: string;
}

interface Session {
  tabs: Tab[];
  activeKey: string;
  seq: number;
  favorites?: string[];
  recent?: string[];
  sidebarWidth?: number;
}

const DEFAULT_SESSION: Session = {
  tabs: [],
  activeKey: "",
  seq: 1,
  favorites: [],
  recent: [],
  sidebarWidth: 220,
};

function App() {
  const [theme, toggleTheme] = useTheme();
  const [search, setSearch] = useState("");

  // 恢复上次会话，去重
  const initial = useMemo(() => {
    const raw = loadState<Session>("session", DEFAULT_SESSION) as Session;
    // 恢复上次打开的标签页（刷新不丢失当前状态）
    const savedTabs = (raw.tabs ?? []).filter(t => TOOL_MAP.has(t.toolId));
    const savedActive = savedTabs.find(t => t.key === raw.activeKey) ? raw.activeKey : (savedTabs[0]?.key ?? "");
    return {
      tabs: savedTabs,
      activeKey: savedActive,
      seq: raw.seq,
      favorites: raw.favorites ?? [],
      recent: raw.recent ?? [],
      sidebarWidth: raw.sidebarWidth ?? 220,
    };
  }, []);
  const [tabs, setTabs] = useState<Tab[]>(initial.tabs);
  const [activeKey, setActiveKey] = useState(initial.activeKey);
  const seqRef = useRef(initial.seq);
  const [favorites, setFavorites] = useState<string[]>(initial.favorites ?? []);
  const [recent, setRecent] = useState<string[]>(initial.recent ?? []);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [paletteQuery, setPaletteQuery] = useState("");
  const [paletteSelIdx, setPaletteSelIdx] = useState(0);
  const [sidebarWidth, setSidebarWidth] = useState(initial.sidebarWidth);
  const sidebarDragRef = useRef<{ startX: number; startW: number } | null>(null);

  // 会话变化时持久化
  useEffect(() => {
    saveState<Session>("session", { tabs, activeKey, seq: seqRef.current, favorites, recent, sidebarWidth });
  }, [tabs, activeKey, favorites, recent, sidebarWidth]);

  // 全局编辑器快捷键
  useEffect(() => installEditorShortcuts(), []);
  // 全局 Tab 缩进（textarea 内 Tab 插入缩进而非跳焦点）
  useEffect(() => installTabIndent(), []);

  // Ctrl/Cmd+P 打开全局搜索面板
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "p") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
        setPaletteQuery("");
        setPaletteSelIdx(0);
      }
      if (e.key === "Escape") setPaletteOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // 侧边栏拖拽
  useEffect(() => {
    function onMove(e: MouseEvent) {
      if (!sidebarDragRef.current) return;
      const dx = e.clientX - sidebarDragRef.current.startX;
      const newW = Math.max(160, Math.min(400, sidebarDragRef.current.startW + dx));
      setSidebarWidth(newW);
    }
    function onUp() { sidebarDragRef.current = null; document.body.style.cursor = ""; }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, []);

  // 数据备份/恢复
  const exportData = useCallback(() => {
    const allKeys = Object.keys(localStorage).filter(k => !k.startsWith("__"));
    const data: Record<string, string> = {};
    for (const k of allKeys) data[k] = localStorage.getItem(k) ?? "";
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `devkit-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast("数据已导出", "success");
  }, []);

  const importData = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result as string) as Record<string, string>;
        for (const [k, v] of Object.entries(data)) localStorage.setItem(k, v);
        toast("数据已导入，刷新后生效", "success");
      } catch {
        toast("导入失败：文件格式错误", "error");
      }
    };
    reader.readAsText(file);
  }, []);

  // Compose：从 HTTP 代理切换到简易 Postman
  const openTool = useCallback((toolId: string) => {
    setTabs(prev => {
      const existing = prev.find((t) => t.toolId === toolId);
      if (existing) {
        setActiveKey(existing.key);
        return prev;
      }
      const key = `t${seqRef.current++}`;
      setActiveKey(key);
      return [...prev, { key, toolId }];
    });
    setRecent((prev) => [toolId, ...prev.filter((t) => t !== toolId)].slice(0, 8));
    setPaletteOpen(false);
  }, []);

  useEffect(() => {
    return listenCompose(() => openTool("F05"));
  }, [openTool]);

  const groups = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = TOOLS.filter(
      (t) =>
        !q ||
        t.name.toLowerCase().includes(q) ||
        t.desc.toLowerCase().includes(q) ||
        t.id.toLowerCase().includes(q),
    );
    const map = new Map<ToolCategory, typeof TOOLS>();
    for (const t of filtered) {
      const arr = map.get(t.category) ?? [];
      arr.push(t);
      map.set(t.category, arr);
    }
    return map;
  }, [search]);

  // Palette search results
  const paletteResults = useMemo(() => {
    const q = paletteQuery.trim().toLowerCase();
    if (!q) return TOOLS;
    return TOOLS.filter(t =>
      t.name.toLowerCase().includes(q) ||
      t.desc.toLowerCase().includes(q) ||
      t.id.toLowerCase().includes(q)
    );
  }, [paletteQuery]);

  // Reset selection when results change
  useEffect(() => { setPaletteSelIdx(0); }, [paletteQuery]);

  function toggleFavorite(toolId: string) {
    setFavorites((prev) => prev.includes(toolId) ? prev.filter(t => t !== toolId) : [...prev, toolId]);
  }

  const activeToolId = tabs.find((t) => t.key === activeKey)?.toolId;
  const hasTabs = tabs.length > 0;

  return (
    <div className="app">
      <aside className="sidebar" style={{ width: sidebarWidth }}>
        <div className="brand" onClick={() => { setTabs([]); setActiveKey(""); }} style={{ cursor: "pointer" }} title="回到首页">
          <span className="brand-name">DevKit</span>
          <span className="brand-tag">极客工具箱</span>
        </div>
        <div className="search-wrap">
          <input
            className="search"
            placeholder="搜索工具..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button className="search-clear" onClick={() => setSearch("")} title="清除" aria-label="清除搜索">×</button>
          )}
        </div>
        <nav className="nav">
          {favorites.length > 0 && (
            <div className="nav-group">
              <div className="nav-group-title">★ 收藏</div>
              {favorites.map(fid => {
                const t = TOOL_MAP.get(fid);
                if (!t) return null;
                return (
                  <button key={fid} className={`nav-item ${fid === activeToolId ? "active" : ""}`} title={t.desc} onClick={() => openTool(fid)}>
                    <span className="nav-icon">{t.icon}</span>
                    <span className="nav-name">{t.name}</span>
                    <span className="nav-fav" onClick={(e) => { e.stopPropagation(); toggleFavorite(fid); }}>★</span>
                  </button>
                );
              })}
            </div>
          )}
          {[...groups.entries()].map(([cat, tools]) => (
            <div key={cat} className="nav-group">
              <div className="nav-group-title">{CATEGORY_LABELS[cat]}</div>
              {tools.map((t) => (
                <button key={t.id} className={`nav-item ${t.id === activeToolId ? "active" : ""}`} title={t.desc} onClick={() => openTool(t.id)}>
                  <span className="nav-icon">{t.icon}</span>
                  <span className="nav-name">{t.name}</span>
                  <span className="nav-fav-toggle" onClick={(e) => { e.stopPropagation(); toggleFavorite(t.id); }} title="收藏/取消收藏">
                    {favorites.includes(t.id) ? "★" : "☆"}
                  </span>
                </button>
              ))}
            </div>
          ))}
        </nav>
        <button className="theme-btn" onClick={toggleTheme}>
          {theme === "dark" ? "☀ 浅色" : "🌙 深色"}
        </button>
        <div className="sidebar-actions">
          <button className="sidebar-action-btn" onClick={() => setPaletteOpen(true)} title="Ctrl/Cmd+P 快速搜索">
            ⌘ 搜索
          </button>
          <button className="sidebar-action-btn" onClick={exportData} title="导出所有数据">
            💾 备份
          </button>
          <label className="sidebar-action-btn" title="导入数据">
            📂 恢复
            <input type="file" accept="application/json,.json" hidden onChange={(e) => {
              const f = e.target.files?.[0]; if (f) importData(f); e.target.value = "";
            }} />
          </label>
        </div>
      </aside>
      <div
        className="sidebar-resizer"
        onMouseDown={(e) => {
          sidebarDragRef.current = { startX: e.clientX, startW: sidebarWidth };
          document.body.style.cursor = "col-resize";
        }}
      />

      <main className="main">
        <div className="workspace">
          {!hasTabs && (
            <HomePage
              openTool={openTool}
              favorites={favorites}
              recent={recent}
            />
          )}
          {tabs.map((tab) => {
            const Comp = TOOL_MAP.get(tab.toolId)?.component;
            if (!Comp) return null;
            return (
              <div
                key={tab.key}
                className="tool-host"
                style={{ display: tab.key === activeKey ? "flex" : "none" }}
              >
                <Comp instanceId={tab.key} />
              </div>
            );
          })}
        </div>
      </main>
      {paletteOpen && (
        <div className="palette-overlay" onClick={() => setPaletteOpen(false)}>
          <div className="palette-modal" onClick={(e) => e.stopPropagation()}>
            <input
              className="palette-input"
              autoFocus
              value={paletteQuery}
              onChange={(e) => setPaletteQuery(e.target.value)}
              placeholder="搜索工具... (↑↓ 选择, Enter 打开, Esc 关闭)"
              onKeyDown={(e) => {
                if (e.key === "Escape") setPaletteOpen(false);
                if (e.key === "ArrowDown") { e.preventDefault(); setPaletteSelIdx(i => Math.min(i + 1, paletteResults.length - 1)); }
                if (e.key === "ArrowUp") { e.preventDefault(); setPaletteSelIdx(i => Math.max(i - 1, 0)); }
                if (e.key === "Enter") {
                  const item = paletteResults[paletteSelIdx];
                  if (item) openTool(item.id);
                }
              }}
            />
            <div className="palette-results">
              {paletteResults.length === 0 ? (
                <div className="palette-empty">未找到匹配工具</div>
              ) : paletteResults.map((t, i) => (
                <button
                  key={t.id}
                  className={`palette-item ${i === paletteSelIdx ? "sel" : ""}`}
                  onMouseEnter={() => setPaletteSelIdx(i)}
                  onClick={() => openTool(t.id)}
                >
                  <span className="palette-icon">{t.icon}</span>
                  <span className="palette-name">{t.name}</span>
                  <span className="palette-desc">{t.desc}</span>
                  {favorites.includes(t.id) && <span className="palette-fav">★</span>}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
      <ToastHost />
    </div>
  );
}

export default App;
