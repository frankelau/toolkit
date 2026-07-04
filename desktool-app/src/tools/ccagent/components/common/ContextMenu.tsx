// ContextMenu — 右键菜单

import { useEffect, useRef, useState, type ReactNode } from "react";

export interface ContextMenuItem {
  id: string;
  label: string;
  icon?: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  divider?: boolean;
}

export interface ContextMenuProps {
  items: ContextMenuItem[];
  children: ReactNode;
}

export function ContextMenu({ items, children }: ContextMenuProps) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  return (
    <div
      ref={ref}
      onContextMenu={(e) => {
        e.preventDefault();
        setPos({ x: e.clientX, y: e.clientY });
        setOpen(true);
      }}
    >
      {children}
      {open && (
        <div
          className="cc-context-menu"
          style={{ left: pos.x, top: pos.y }}
        >
          {items.map((item) => (
            <div key={item.id}>
              {item.divider && <div className="cc-context-menu-divider" />}
              <button
                className={`cc-context-menu-item ${item.danger ? "danger" : ""}`}
                onClick={() => { item.onClick(); setOpen(false); }}
                disabled={item.disabled}
              >
                {item.icon && <span className="cc-context-menu-icon">{item.icon}</span>}
                <span className="cc-context-menu-label">{item.label}</span>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
