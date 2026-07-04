// useContextMenu — 右键菜单逻辑
// 对齐 cc-gui useContextMenu

import { useState, useEffect, useCallback, type RefObject } from "react";

export interface ContextMenuItem {
  id: string;
  label: string;
  icon?: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  divider?: boolean;
}

export interface useContextMenuReturn {
  isOpen: boolean;
  position: { x: number; y: number };
  items: ContextMenuItem[];
  open: (x: number, y: number, items: ContextMenuItem[]) => void;
  close: () => void;
}

export function useContextMenu(containerRef?: RefObject<HTMLElement | null>): useContextMenuReturn {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [items, setItems] = useState<ContextMenuItem[]>([]);

  const open = useCallback((x: number, y: number, menuItems: ContextMenuItem[]) => {
    setPosition({ x, y });
    setItems(menuItems);
    setIsOpen(true);
  }, []);

  const close = useCallback(() => setIsOpen(false), []);

  useEffect(() => {
    if (!isOpen) return;
    const onClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (containerRef?.current && !containerRef.current.contains(target)) {
        close();
      } else if (!containerRef) {
        close();
      }
    };
    const onEsc = (e: KeyboardEvent) => e.key === "Escape" && close();
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onEsc);
    };
  }, [isOpen, close, containerRef]);

  return { isOpen, position, items, open, close };
}
