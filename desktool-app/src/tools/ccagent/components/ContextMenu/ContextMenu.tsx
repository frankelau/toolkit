// ContextMenu.tsx — 右键上下文菜单（对齐 cc-gui ContextMenu）
// Sprint U3: 补齐缺失组件

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export type ContextMenuItem =
  | { separator: true }
  | { separator?: false; label: string; action: () => void; disabled?: boolean };

interface ContextMenuProps {
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose: () => void;
}

export function ContextMenu({ x, y, items, onClose }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // 视口位置调整
  const [pos, setPos] = useState({ left: x, top: y });

  useEffect(() => {
    const menu = menuRef.current;
    if (!menu) return;
    const rect = menu.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    setPos({
      left: x + rect.width > vw ? vw - rect.width - 4 : x,
      top: y + rect.height > vh ? vh - rect.height - 4 : y,
    });
  }, [x, y]);

  // 点击外部 / Escape / 滚动 关闭
  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onCloseRef.current();
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCloseRef.current();
    };
    const handleScroll = () => onCloseRef.current();
    document.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("scroll", handleScroll, true);
    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, []);

  const menuStyle: React.CSSProperties = {
    left: pos.left,
    top: pos.top,
    position: "fixed",
    zIndex: 30000,
    minWidth: "160px",
    background: "var(--cc-bg-dropdown, #2b2b2b)",
    border: "1px solid var(--cc-border, #555)",
    borderRadius: "6px",
    boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
    padding: "4px 0",
    fontSize: "13px",
  };

  const itemStyle: React.CSSProperties = {
    padding: "6px 16px",
    cursor: "pointer",
    userSelect: "none",
  };

  const separatorStyle: React.CSSProperties = {
    height: 1,
    background: "var(--cc-border, #555)",
    margin: "4px 0",
    opacity: 0.5,
  };

  return createPortal(
    <div ref={menuRef} className="context-menu" role="menu" aria-label="Context menu" style={menuStyle}>
      {items.map((item, i) =>
        item.separator ? (
          <div key={`sep-${i}`} className="context-menu-separator" role="separator" style={separatorStyle} />
        ) : (
          <div
            key={`item-${i}`}
            className={`context-menu-item${item.disabled ? " disabled" : ""}`}
            role="menuitem"
            aria-disabled={item.disabled || false}
            tabIndex={item.disabled ? -1 : 0}
            style={{
              ...itemStyle,
              opacity: item.disabled ? 0.5 : 1,
              cursor: item.disabled ? "not-allowed" : "pointer",
            }}
            onClick={() => {
              if (!item.disabled) {
                item.action();
                onCloseRef.current();
              }
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !item.disabled) {
                item.action();
                onCloseRef.current();
              }
            }}
          >
            {item.label}
          </div>
        ),
      )}
    </div>,
    document.body,
  );
}
