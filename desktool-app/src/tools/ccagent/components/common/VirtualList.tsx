// VirtualList — 简易虚拟滚动（仅渲染可视区域 + 上下缓冲）

import { useState, useRef, type ReactNode } from "react";

export interface VirtualListProps<T> {
  items: T[];
  /** 每项高度（px），固定高度才能虚拟滚动 */
  itemHeight: number;
  /** 容器最大高度（px） */
  maxHeight: number;
  /** 上下缓冲项数 */
  overscan?: number;
  /** 渲染函数 */
  renderItem: (item: T, index: number) => ReactNode;
  /** 空状态 */
  emptyHint?: ReactNode;
  /** key 提取 */
  keyExtractor: (item: T, index: number) => string;
}

export function VirtualList<T>(props: VirtualListProps<T>) {
  const { items, itemHeight, maxHeight, overscan = 5, renderItem, emptyHint, keyExtractor } = props;
  const [scrollTop, setScrollTop] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const total = items.length;
  const visibleCount = Math.ceil(maxHeight / itemHeight);
  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
  const endIndex = Math.min(total, startIndex + visibleCount + overscan * 2);

  const visibleItems = items.slice(startIndex, endIndex);
  const totalHeight = total * itemHeight;
  const offsetY = startIndex * itemHeight;

  if (total === 0) {
    return (
      <div className="cc-virtual-list-empty" style={{ maxHeight, overflow: "auto" }}>
        {emptyHint ?? <div className="cc-empty-hint">无数据</div>}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="cc-virtual-list"
      style={{ maxHeight, overflowY: "auto", position: "relative" }}
      onScroll={(e) => setScrollTop((e.target as HTMLDivElement).scrollTop)}
    >
      <div style={{ height: totalHeight, position: "relative" }}>
        <div style={{ transform: `translateY(${offsetY}px)` }}>
          {visibleItems.map((item, i) => (
            <div key={keyExtractor(item, startIndex + i)} style={{ height: itemHeight }}>
              {renderItem(item, startIndex + i)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
