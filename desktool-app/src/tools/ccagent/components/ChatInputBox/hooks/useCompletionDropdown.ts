// useCompletionDropdown — 补全下拉框（对齐 cc-gui useCompletionDropdown）
// Sprint B: 统一管理 @file / 斜杠命令 / $ / @agent 的补全下拉状态

import { useCallback, useMemo, useState } from "react";

export type CompletionType = "file" | "slash" | "dollar" | "agent" | null;

export interface CompletionItem {
  id: string;
  label: string;
  description?: string;
  icon?: string;
  /** 插入的文本 */
  insertText: string;
  /** 额外数据 */
  data?: unknown;
}

export interface UseCompletionDropdownOptions {
  /** 触发字符映射：@ → file, / → slash, $ → dollar */
  triggers?: Record<string, CompletionType>;
}

export interface UseCompletionDropdownReturn {
  activeType: CompletionType;
  query: string;
  items: CompletionItem[];
  selectedIndex: number;
  isOpen: boolean;
  triggerStart: number;
  /** 打开补全 */
  open: (type: CompletionType, query: string, items: CompletionItem[], triggerStart: number) => void;
  /** 更新查询和候选项 */
  update: (query: string, items: CompletionItem[]) => void;
  /** 关闭 */
  close: () => void;
  /** 选择上一个 */
  selectPrev: () => void;
  /** 选择下一个 */
  selectNext: () => void;
  /** 获取当前选中项 */
  getSelectedItem: () => CompletionItem | null;
}

export function useCompletionDropdown({
  triggers = { "@": "file", "/": "slash", "$": "dollar" },
}: UseCompletionDropdownOptions = {}): UseCompletionDropdownReturn {
  const [activeType, setActiveType] = useState<CompletionType>(null);
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<CompletionItem[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [triggerStart, setTriggerStart] = useState(0);

  const isOpen = activeType !== null;

  const open = useCallback((type: CompletionType, q: string, list: CompletionItem[], start: number) => {
    setActiveType(type);
    setQuery(q);
    setItems(list);
    setSelectedIndex(0);
    setTriggerStart(start);
  }, []);

  const update = useCallback((q: string, list: CompletionItem[]) => {
    setQuery(q);
    setItems(list);
    setSelectedIndex(0);
  }, []);

  const close = useCallback(() => {
    setActiveType(null);
    setQuery("");
    setItems([]);
    setSelectedIndex(0);
  }, []);

  const selectPrev = useCallback(() => {
    setSelectedIndex(prev => (prev - 1 + items.length) % Math.max(items.length, 1));
  }, [items.length]);

  const selectNext = useCallback(() => {
    setSelectedIndex(prev => items.length > 0 ? (prev + 1) % items.length : 0);
  }, [items.length]);

  const getSelectedItem = useCallback(() => {
    return items[selectedIndex] ?? null;
  }, [items, selectedIndex]);

  /** 检测触发字符（供键盘事件调用） */
  useMemo(() => triggers, [triggers]);

  return {
    activeType, query, items, selectedIndex, isOpen, triggerStart,
    open, update, close, selectPrev, selectNext, getSelectedItem,
  };
}
