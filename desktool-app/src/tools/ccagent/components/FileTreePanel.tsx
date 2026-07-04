// FileTreePanel — ccgui 风格文件树侧边栏
// 自包含组件：树加载、展开折叠、搜索过滤、右键菜单、点击添加上下文

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { toast } from "../../../useCopyFeedback";

// ── 类型 ──────────────────────────────────────────────────────────────────

interface FileTreeNode {
  name: string;
  path: string;
  is_dir: boolean;
  size: number;
  children: FileTreeNode[];
}

interface FileTreePanelProps {
  cwd: string;
  onAddToContext?: (path: string) => void;
  onOpenFile?: (path: string) => void;
  onPreviewFile?: (path: string) => void;
  visible: boolean;
  onToggleVisibility: () => void;
}

// ─── 文件类型图标 ──────────────────────────────────────────────────────────

const FILE_ICONS: Record<string, string> = {
  ts: "🔷", tsx: "⚛️", js: "🟨", jsx: "⚛️",
  py: "🐍", rs: "🦀", go: "🔵", java: "☕",
  json: "📋", yaml: "📋", yml: "📋", toml: "⚙️",
  md: "📝", txt: "📄", log: "📄",
  css: "🎨", scss: "🎨", less: "🎨",
  html: "🌐", htm: "🌐", xml: "📰",
  svg: "🖼️", png: "🖼️", jpg: "🖼️", jpeg: "🖼️", gif: "🖼️", ico: "🖼️",
  sh: "💻", bash: "💻", zsh: "💻", fish: "💻",
  lock: "🔒", gitignore: "🙈", env: "🔐",
  dockerfile: "🐳", makefile: "🔧",
  sql: "🗄️", graphql: "◈", gql: "◈",
  vue: "💚", svelte: "🧡",
  c: "⚙️", cpp: "⚙️", h: "⚙️", hpp: "⚙️",
};

function fileIcon(name: string, isDir: boolean): string {
  if (isDir) return "📁";
  const ext = name.split(".").pop()?.toLowerCase() || "";
  return FILE_ICONS[ext] || "📄";
}

interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  node: FileTreeNode | null;
}

// ─── 组件 ───────────────────────────────────────────────────────────────────

export function FileTreePanel({ cwd, onAddToContext, onOpenFile, onPreviewFile, visible, onToggleVisibility }: FileTreePanelProps) {
  const [tree, setTree] = useState<FileTreeNode | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({ visible: false, x: 0, y: 0, node: null });
  const [loadingPaths, setLoadingPaths] = useState<Set<string>>(new Set());
  const searchRef = useRef<HTMLInputElement>(null);

  // ── 加载文件树 ──────────────────────────────────────────────────────────
  const loadTree = useCallback(async () => {
    if (!cwd) return;
    setLoading(true);
    setError("");
    try {
      const data = await invoke<FileTreeNode>("cc_build_file_tree", {
        root: cwd,
        maxDepth: 3, // 加载 3 层，子目录自动有 children
      });
      setTree(data);
      setExpanded(new Set([data.path]));
    } catch (e) {
      setError(`加载文件树失败: ${String(e)}`);
    } finally {
      setLoading(false);
    }
  }, [cwd]);

  useEffect(() => {
    if (visible && cwd) loadTree();
  }, [cwd, visible, loadTree]);

  // ── 按需加载子目录 ──────────────────────────────────────────────────────
  const updateChildNode = useCallback((node: FileTreeNode, targetPath: string, children: FileTreeNode[]): FileTreeNode => {
    if (node.path === targetPath) {
      return { ...node, children };
    }
    if (node.children) {
      return { ...node, children: node.children.map(c => updateChildNode(c, targetPath, children)) };
    }
    return node;
  }, []);

  const loadSubDir = useCallback(async (dirPath: string) => {
    setLoadingPaths(prev => new Set(prev).add(dirPath));
    try {
      const children = await invoke<FileTreeNode[]>("cc_list_dir_children", { dir: dirPath });
      setTree(prev => prev ? updateChildNode(prev, dirPath, children) : prev);
    } catch (e) {
      console.error("加载子目录失败:", e);
    } finally {
      setLoadingPaths(prev => {
        const next = new Set(prev);
        next.delete(dirPath);
        return next;
      });
    }
  }, [updateChildNode]);

  // ── 展开/折叠 ──────────────────────────────────────────────────────────
  const toggleExpand = useCallback((path: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
        // 如果是目录且 children 为空（未加载），则按需加载
      }
      return next;
    });
  }, []);

  // 目录展开时按需加载子节点
  const handleToggleDir = useCallback((node: FileTreeNode) => {
    const isCurrentlyExpanded = expanded.has(node.path);
    if (!isCurrentlyExpanded && node.is_dir && (!node.children || node.children.length === 0)) {
      loadSubDir(node.path);
    }
    toggleExpand(node.path);
  }, [expanded, toggleExpand, loadSubDir]);

  // ── 搜索过滤 ──────────────────────────────────────────────────────────
  const filterTree = useCallback((node: FileTreeNode, query: string): FileTreeNode | null => {
    const q = query.toLowerCase();
    const nameMatch = node.name.toLowerCase().includes(q);

    if (!node.is_dir || !node.children) {
      return nameMatch ? node : null;
    }

    const filteredChildren = node.children
      .map(c => filterTree(c, q))
      .filter((c): c is FileTreeNode => c !== null);

    if (filteredChildren.length > 0 || nameMatch) {
      return { ...node, children: filteredChildren };
    }
    return null;
  }, []);

  const displayTree = useMemo(() => {
    if (!tree) return null;
    if (!search.trim()) return tree;
    return filterTree(tree, search.trim());
  }, [tree, search, filterTree]);

  // ── 搜索时自动展开所有匹配项 ──────────────────────────────────────────
  const autoExpandForSearch = useCallback((node: FileTreeNode, query: string): string[] => {
    if (!query.trim()) return [];
    const paths: string[] = [];
    if (node.is_dir && node.children) {
      for (const child of node.children) {
        const childName = child.name.toLowerCase();
        if (childName.includes(query.toLowerCase())) {
          paths.push(node.path);
          break;
        }
        if (child.is_dir) {
          paths.push(...autoExpandForSearch(child, query));
          if (paths.length > 0) paths.push(node.path);
        }
      }
    }
    return paths;
  }, []);

  const expandedForSearch = useMemo(() => {
    if (!tree || !search.trim()) return expanded;
    const paths = autoExpandForSearch(tree, search.trim());
    const newExpanded = new Set(expanded);
    paths.forEach(p => newExpanded.add(p));
    return newExpanded;
  }, [tree, search, expanded, autoExpandForSearch]);

  // ── 右键菜单 ──────────────────────────────────────────────────────────
  const handleContextMenu = useCallback((e: React.MouseEvent, node: FileTreeNode) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ visible: true, x: e.clientX, y: e.clientY, node });
  }, []);

  const closeContextMenu = useCallback(() => {
    setContextMenu({ visible: false, x: 0, y: 0, node: null });
  }, []);

  useEffect(() => {
    const handler = () => closeContextMenu();
    window.addEventListener("click", handler);
    window.addEventListener("scroll", handler, true);
    return () => {
      window.removeEventListener("click", handler);
      window.removeEventListener("scroll", handler, true);
    };
  }, [closeContextMenu]);

  const handleAddToContext = useCallback(() => {
    if (contextMenu.node && onAddToContext) {
      onAddToContext(contextMenu.node.path);
    }
    closeContextMenu();
  }, [contextMenu.node, onAddToContext, closeContextMenu]);

  const handleOpenFile = useCallback(() => {
    if (contextMenu.node && onOpenFile) {
      onOpenFile(contextMenu.node.path);
    }
    closeContextMenu();
  }, [contextMenu.node, onOpenFile, closeContextMenu]);

  const handleCopyPath = useCallback(async () => {
    if (contextMenu.node) {
      try {
        await navigator.clipboard.writeText(contextMenu.node.path);
        toast("路径已复制", "info");
      } catch { /* ignore */ }
    }
    closeContextMenu();
  }, [contextMenu.node, closeContextMenu]);

  // ── 键盘导航 ──────────────────────────────────────────────────────────
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "f") {
      e.preventDefault();
      searchRef.current?.focus();
    }
    if (e.key === "Escape") {
      setSearch("");
      searchRef.current?.blur();
    }
  }, []);

  // ── 单个文件项点击 ────────────────────────────────────────────────────
  const handleFileClick = useCallback((node: FileTreeNode) => {
    if (node.is_dir) {
      handleToggleDir(node);
    } else if (onAddToContext) {
      onAddToContext(node.path);
    }
  }, [handleToggleDir, onAddToContext]);

  // ── 双击文件预览 ──────────────────────────────────────────────────────
  const handleFileDoubleClick = useCallback((node: FileTreeNode) => {
    if (!node.is_dir && onPreviewFile) {
      onPreviewFile(node.path);
    }
  }, [onPreviewFile]);

  // ── 递归渲染树节点 ────────────────────────────────────────────────────
  const renderNode = useCallback((node: FileTreeNode, depth: number): React.ReactNode => {
    const isExpanded = expandedForSearch.has(node.path);
    const isSearchResult = !!search.trim() && node.name.toLowerCase().includes(search.toLowerCase());
    const isLoadingChild = loadingPaths.has(node.path);

    return (
      <div key={node.path}>
        <div
          className={`cc-ft-node ${isSearchResult ? "cc-ft-search-match" : ""}`}
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
          onClick={() => handleFileClick(node)}
          onDoubleClick={() => handleFileDoubleClick(node)}
          onContextMenu={(e) => handleContextMenu(e, node)}
          title={node.path}
        >
          {node.is_dir ? (
            <span
              className={`cc-ft-chevron ${isExpanded ? "expanded" : ""}`}
              onClick={(e) => { e.stopPropagation(); handleToggleDir(node); }}
            >
              ▸
            </span>
          ) : (
            <span className="cc-ft-chevron-placeholder" />
          )}
          <span className="cc-ft-icon">{fileIcon(node.name, node.is_dir)}</span>
          <span className="cc-ft-name">{node.name}</span>
          {!node.is_dir && node.size > 0 && (
            <span className="cc-ft-size">
              {node.size < 1024 ? `${node.size}B` : node.size < 1024 * 1024 ? `${(node.size / 1024).toFixed(1)}KB` : `${(node.size / (1024 * 1024)).toFixed(1)}MB`}
            </span>
          )}
        </div>

        {node.is_dir && isExpanded && (
          <div className="cc-ft-children">
            {isLoadingChild && (!node.children || node.children.length === 0) ? (
              <div className="cc-ft-loading-child">⏳</div>
            ) : node.children && node.children.length > 0 ? (
              node.children.map(child => renderNode(child, depth + 1))
            ) : (
              <div className="cc-ft-empty-child">空</div>
            )}
          </div>
        )}
      </div>
    );
  }, [expandedForSearch, search, loadingPaths, handleFileClick, handleFileDoubleClick, handleContextMenu, handleToggleDir]);

  // ── 显示的文件数量统计 ─────────────────────────────────────────────────
  const fileCount = useMemo(() => {
    if (!tree) return 0;
    let count = 0;
    const walk = (n: FileTreeNode) => {
      if (!n.is_dir) count++;
      n.children?.forEach(walk);
    };
    walk(tree);
    return count;
  }, [tree]);

  if (!visible) {
    return (
      <button className="cc-ft-toggle-btn" onClick={onToggleVisibility} title="显示文件树">
        📁
      </button>
    );
  }

  return (
    <div className="cc-ft-panel" onKeyDown={handleKeyDown}>
      {/* 头部：搜索 + 折叠按钮 */}
      <div className="cc-ft-header">
        <div className="cc-ft-header-left">
          <span className="cc-ft-title">文件</span>
          {tree && <span className="cc-ft-badge">{fileCount}</span>}
        </div>
        <div className="cc-ft-header-right">
          <button className="cc-ft-refresh" onClick={loadTree} title="刷新">↻</button>
          <button className="cc-ft-collapse" onClick={onToggleVisibility} title="收起">◀</button>
        </div>
      </div>

      {/* 搜索框 */}
      <div className="cc-ft-search">
        <span className="cc-ft-search-icon">🔍</span>
        <input
          ref={searchRef}
          className="cc-ft-search-input"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="搜索文件..."
          spellCheck={false}
        />
        {search && (
          <button className="cc-ft-search-clear" onClick={() => { setSearch(""); searchRef.current?.focus(); }}>
            ×
          </button>
        )}
      </div>

      {/* 树内容 */}
      <div className="cc-ft-content">
        {loading && (
          <div className="cc-ft-loading">⏳ 加载中...</div>
        )}
        {error && (
          <div className="cc-ft-error">
            <span>{error}</span>
            <button onClick={loadTree}>重试</button>
          </div>
        )}
        {!loading && !error && displayTree && (
          displayTree.is_dir && displayTree.children ? (
            displayTree.children.map(child => renderNode(child, 0))
          ) : search ? (
            <div className="cc-ft-empty">未找到匹配文件</div>
          ) : null
        )}
        {!loading && !error && !displayTree && (
          <div className="cc-ft-empty">📁 空目录</div>
        )}
      </div>

      {/* 底部：cwd 显示 */}
      <div className="cc-ft-footer" title={cwd}>
        📂 {cwd.split("/").filter(Boolean).pop() || cwd}
      </div>

      {/* 右键菜单 */}
      {contextMenu.visible && contextMenu.node && (
        <div
          className="cc-ft-context-menu"
          style={{ left: contextMenu.x, top: contextMenu.y, position: "fixed" }}
        >
          <div className="cc-ft-menu-item" onClick={handleAddToContext}>
            ➕ 添加到上下文
          </div>
          {!contextMenu.node.is_dir && (
            <div className="cc-ft-menu-item" onClick={handleOpenFile}>
              📂 打开文件
            </div>
          )}
          <div className="cc-ft-menu-divider" />
          <div className="cc-ft-menu-item" onClick={handleCopyPath}>
            📋 复制路径
          </div>
        </div>
      )}
    </div>
  );
}

export default FileTreePanel;
