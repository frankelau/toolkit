// Dropdown — 通用键盘导航下拉菜单组件
// 对齐 cc-gui components/ChatInputBox/Dropdown/DropdownItem.tsx

import { useCallback, useEffect, useRef, useState } from "react";

export interface DropdownItem {
  id: string;
  label: string;
  description?: string;
  icon?: string;        // emoji or SVG
  disabled?: boolean;
  type?: string;        // category tag
  metadata?: Record<string, unknown>; // extra data for callbacks
}

export interface DropdownProps {
  items: DropdownItem[];
  /** 当前选中索引 (-1 = 无选中) */
  selectedIndex?: number;
  /** 选择回调 */
  onSelect: (item: DropdownItem, index: number) => void;
  /** 关闭 */
  onClose: () => void;
  /** 最大可见项数（超出滚动） */
  maxVisible?: number;
  /** 宽度 (px) */
  width?: number;
}

export function Dropdown({
  items, selectedIndex = -1, onSelect, onClose,
  maxVisible = 8, width = 360,
}: DropdownProps) {
  const [activeIndex, setActiveIndex] = useState(selectedIndex);
  const listRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);

  // 键盘导航
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex(prev => Math.min(prev + 1, items.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === "Enter" && !e.metaKey && !e.ctrlKey) {
      e.preventDefault();
      const idx = activeIndex >= 0 ? activeIndex : 0;
      if (idx < items.length && !items[idx].disabled) {
        onSelect(items[idx], idx);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  }, [activeIndex, items, onSelect, onClose]);

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  // 自动滚动到激活项
  useEffect(() => {
    const el = itemRefs.current[activeIndex];
    if (el) el.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  if (items.length === 0) {
    return (
      <div className="cc-dropdown" style={{ width }}>
        <div className="cc-dropdown-empty">无匹配项</div>
      </div>
    );
  }

  return (
    <div className="cc-dropdown" style={{ width, maxHeight: maxVisible * 36 + 8 }}>
      <div className="cc-dropdown-list" ref={listRef}>
        {items.map((item, idx) => (
          <div
            key={item.id}
            ref={el => { itemRefs.current[idx] = el; }}
            className={`cc-dropdown-item ${idx === activeIndex ? "cc-dropdown-active" : ""} ${item.disabled ? "cc-dropdown-disabled" : ""}`}
            onClick={() => !item.disabled && onSelect(item, idx)}
            onMouseEnter={() => setActiveIndex(idx)}
          >
            {item.icon && <span className="cc-dropdown-icon">{item.icon}</span>}
            <div className="cc-dropdown-content">
              <span className="cc-dropdown-label">{item.label}</span>
              {item.description && (
                <span className="cc-dropdown-desc">{item.description}</span>
              )}
            </div>
            {item.type && <span className="cc-dropdown-type">{item.type}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

export default Dropdown;
