import { useRef } from "react";
import { usePersistentState } from "../storage";

export interface SubTab { id: string; name: string; }

/**
 * 管理工具内部的子标签（配置记录）。
 * tabs/active 存在独立 key，不污染工具自身的状态命名空间。
 */
export function useSubTabs(baseNs: string, defaultName = "默认") {
  const ns = `__sub__:${baseNs}`;
  const [tabs, setTabs] = usePersistentState<SubTab[]>(`${ns}:list`, [{ id: "s0", name: defaultName }]);
  const [activeId, _setActiveId] = usePersistentState<string>(`${ns}:active`, "s0");
  const seqRef = useRef(1);

  const active = tabs.find((t) => t.id === activeId) ?? tabs[0];
  const subNs = active ? `${baseNs}:${active.id}` : baseNs;

  function setActiveId(id: string) { _setActiveId(id); }

  function add() {
    const id = `s${Date.now()}`;
    const name = `配置 ${tabs.length + 1}`;
    setTabs((ts) => [...ts, { id, name }]);
    _setActiveId(id);
    seqRef.current++;
  }

  function remove(id: string) {
    if (tabs.length <= 1) return;
    const idx = tabs.findIndex((t) => t.id === id);
    setTabs((ts) => {
      const next = ts.filter((t) => t.id !== id);
      if (activeId === id) _setActiveId(next[Math.max(0, idx - 1)]?.id ?? next[0]?.id);
      return next;
    });
  }

  function rename(id: string, name: string) {
    setTabs((ts) => ts.map((t) => (t.id === id ? { ...t, name } : t)));
  }

  return { tabs, activeId: active?.id ?? "s0", subNs, setActiveId, add, remove, rename };
}
