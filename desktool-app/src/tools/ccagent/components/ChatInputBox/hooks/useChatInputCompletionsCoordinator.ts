// useChatInputCompletionsCoordinator — 补全协调
// 对齐 cc-gui useChatInputCompletionsCoordinator

import { useState, useCallback } from "react";

export type CompletionType = "file" | "slash" | "dollar" | "agent";

export interface CompletionState {
  type: CompletionType | null;
  query: string;
  items: Array<{ label: string; desc?: string; value: string }>;
  selectedIndex: number;
  triggerStart: number;
}

export interface CompletionsCoordinator {
  state: CompletionState;
  openCompletion: (type: CompletionType, query: string, start: number, items: Array<{ label: string; desc?: string; value: string }>) => void;
  updateQuery: (query: string) => void;
  updateItems: (items: Array<{ label: string; desc?: string; value: string }>) => void;
  selectNext: () => void;
  selectPrev: () => void;
  selectItem: (index: number) => void;
  close: () => void;
}

const EMPTY: CompletionState = { type: null, query: "", items: [], selectedIndex: 0, triggerStart: -1 };

export function useChatInputCompletionsCoordinator(): CompletionsCoordinator {
  const [state, setState] = useState<CompletionState>(EMPTY);

  const openCompletion = useCallback((type: CompletionType, query: string, start: number, items: Array<{ label: string; desc?: string; value: string }>) => {
    setState({ type, query, items, selectedIndex: 0, triggerStart: start });
  }, []);

  const updateQuery = useCallback((query: string) => {
    setState(prev => ({ ...prev, query, selectedIndex: 0 }));
  }, []);

  const updateItems = useCallback((items: Array<{ label: string; desc?: string; value: string }>) => {
    setState(prev => ({ ...prev, items, selectedIndex: 0 }));
  }, []);

  const selectNext = useCallback(() => {
    setState(prev => ({ ...prev, selectedIndex: (prev.selectedIndex + 1) % Math.max(1, prev.items.length) }));
  }, []);

  const selectPrev = useCallback(() => {
    setState(prev => ({ ...prev, selectedIndex: prev.selectedIndex === 0 ? Math.max(0, prev.items.length - 1) : prev.selectedIndex - 1 }));
  }, []);

  const selectItem = useCallback((index: number) => {
    setState(prev => ({ ...prev, selectedIndex: index }));
  }, []);

  const close = useCallback(() => setState(EMPTY), []);

  return { state, openCompletion, updateQuery, updateItems, selectNext, selectPrev, selectItem, close };
}
