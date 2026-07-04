// Dropdown — 补全下拉容器（对齐 cc-gui Dropdown）
// Sprint B: 统一的补全下拉 UI 容器

import type { CompletionItem } from "./hooks/useCompletionDropdown";

interface DropdownProps {
  items: CompletionItem[];
  selectedIndex: number;
  onSelect: (item: CompletionItem) => void;
  onHover: (index: number) => void;
  emptyText?: string;
}

export function Dropdown({ items, selectedIndex, onSelect, onHover, emptyText = "无匹配项" }: DropdownProps) {
  if (items.length === 0) {
    return <div className="cc-dropdown cc-dropdown-empty">{emptyText}</div>;
  }
  return (
    <div className="cc-dropdown">
      {items.map((item, i) => (
        <button
          key={item.id}
          className={`cc-dropdown-item ${i === selectedIndex ? "active" : ""}`}
          onMouseDown={(e) => { e.preventDefault(); onSelect(item); }}
          onMouseEnter={() => onHover(i)}
        >
          <span className="cc-dropdown-icon">{item.icon}</span>
          <div className="cc-dropdown-content">
            <div className="cc-dropdown-label">{item.label}</div>
            {item.description && <div className="cc-dropdown-desc">{item.description}</div>}
          </div>
        </button>
      ))}
    </div>
  );
}
