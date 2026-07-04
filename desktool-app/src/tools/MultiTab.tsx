import { createContext, useContext, useMemo, useRef, useState, type ComponentType } from "react";
import type { ToolProps } from "./types";
import { usePersistentState, removeByPrefix } from "../storage";
import "./MultiTab.css";

/** Body components can call this to auto-update their tab title (e.g. to cwd basename). */
export const TabTitleContext = createContext<((title: string) => void) | null>(null);

/** Hook for body components to programmatically set their tab title. */
export function useTabTitle(title?: string) {
  const setTitle = useContext(TabTitleContext);
  const prevTitle = useRef<string | undefined>(undefined);
  if (setTitle && title && title !== prevTitle.current) {
    prevTitle.current = title;
    // Use queueMicrotask to avoid calling setState during render
    queueMicrotask(() => setTitle(title));
  }
}

interface SubTab {
  /** 子标签实例 key，拼进 instanceId 后作为各工具的持久化命名空间 */
  key: string;
  /** 标签标题，可双击重命名 */
  title: string;
}

interface TabState {
  tabs: SubTab[];
  activeKey: string;
  seq: number;
}

/**
 * 把一个工具包成「内部多标签」的容器：外层只允许开一个该工具窗口（singleton），
 * 里面用多个子标签承载多份独立工作区。
 *
 * 关键点：传给子组件的 instanceId 是 `${外层instanceId}:${子key}`，
 * 因此各子标签的持久化命名空间（如 `json:t1:s0:input`）天然唯一；
 * 又因都以 `${ns}:${外层instanceId}` 为前缀，外层 App 关闭窗口时按前缀清理会一并清掉。
 *
 * @param Body 被包裹的工具组件
 * @param ns   工具的 storageNs（与 registry 中一致），用于隔离本容器自己的标签列表数据
 */
export function withMultiTab(
  Body: ComponentType<ToolProps>,
  ns: string,
): ComponentType<ToolProps> {
  function MultiTab({ instanceId }: ToolProps) {
    // 标签列表本身也持久化，且前缀与子标签数据一致，保证一起被清理
    const stateKey = `${ns}:${instanceId}:__tabs`;
    const [state, setState] = usePersistentState<TabState>(stateKey, {
      tabs: [{ key: "s0", title: "标签 1" }],
      activeKey: "s0",
      seq: 1,
    });
    const [editingKey, setEditingKey] = useState<string | null>(null);
    const seqRef = useRef(state.seq);

    const { tabs, activeKey } = state;
    const safeActive = useMemo(
      () => (tabs.some((t) => t.key === activeKey) ? activeKey : tabs[0]?.key ?? ""),
      [tabs, activeKey],
    );

    function setActive(key: string) {
      setState((s) => ({ ...s, activeKey: key }));
    }

    function addTab() {
      const key = `s${seqRef.current++}`;
      setState((s) => ({
        tabs: [...s.tabs, { key, title: `标签 ${s.tabs.length + 1}` }],
        activeKey: key,
        seq: seqRef.current,
      }));
    }

    function closeTab(key: string) {
      setState((s) => {
        if (s.tabs.length <= 1) return s; // 至少保留一个
        const idx = s.tabs.findIndex((t) => t.key === key);
        const tabs = s.tabs.filter((t) => t.key !== key);
        // 清理该子标签的持久化数据
        removeByPrefix(`${ns}:${instanceId}:${key}`);
        let activeKey = s.activeKey;
        if (key === s.activeKey) {
          activeKey = tabs[Math.max(0, idx - 1)].key;
        }
        return { ...s, tabs, activeKey };
      });
    }

    function rename(key: string, title: string) {
      setState((s) => ({
        ...s,
        tabs: s.tabs.map((t) => (t.key === key ? { ...t, title: title || t.title } : t)),
      }));
    }

    return (
      <div className="mt-wrap">
        <div className="mt-bar">
          {tabs.map((t) => (
            <div
              key={t.key}
              className={`mt-tab ${t.key === safeActive ? "active" : ""}`}
              onClick={() => setActive(t.key)}
              onDoubleClick={() => setEditingKey(t.key)}
              title="双击重命名"
            >
              {editingKey === t.key ? (
                <input
                  className="mt-rename"
                  autoFocus
                  defaultValue={t.title}
                  onClick={(e) => e.stopPropagation()}
                  onBlur={(e) => { rename(t.key, e.target.value.trim()); setEditingKey(null); }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                    if (e.key === "Escape") setEditingKey(null);
                  }}
                />
              ) : (
                <span className="mt-title">{t.title}</span>
              )}
              {tabs.length > 1 && (
                <button
                  className="mt-close"
                  title="关闭此标签"
                  onClick={(e) => { e.stopPropagation(); closeTab(t.key); }}
                >
                  ×
                </button>
              )}
            </div>
          ))}
          <button className="mt-add" title="新建标签" onClick={addTab}>+</button>
        </div>
        <div className="mt-body">
          {/* 全部挂载，非激活的隐藏，以保留各子标签状态 */}
          {tabs.map((t) => (
            <div
              key={t.key}
              className="mt-panel"
              style={{ display: t.key === safeActive ? "flex" : "none" }}
            >
              <TabTitleContext.Provider value={(title) => rename(t.key, title)}>
                <Body instanceId={`${instanceId}:${t.key}`} />
              </TabTitleContext.Provider>
            </div>
          ))}
        </div>
      </div>
    );
  }

  MultiTab.displayName = `MultiTab(${Body.displayName || Body.name || "Tool"})`;
  return MultiTab;
}
