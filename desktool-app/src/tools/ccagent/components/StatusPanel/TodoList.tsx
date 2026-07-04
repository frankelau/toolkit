// TodoList.tsx — Todo 列表子组件 (增强版 D3)
// 新增：状态筛选 (全部/进行中/待处理/已完成)

import { useMemo, useState } from "react";
import type { TodoListProps } from "./types";
import { computeTodoStats, sortTodos, TODO_STATUS_ICON, TODO_STATUS_CLASS } from "./utils";

type FilterKey = "all" | "in_progress" | "pending" | "completed";

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "全部" },
  { key: "in_progress", label: "进行中" },
  { key: "pending", label: "待处理" },
  { key: "completed", label: "已完成" },
];

export function TodoList({ todos }: TodoListProps) {
  const stats = useMemo(() => computeTodoStats(todos), [todos]);
  const [filter, setFilter] = useState<FilterKey>("all");

  if (todos.length === 0) return <div className="cc-panel-empty">暂无任务</div>;

  const sorted = sortTodos(todos);
  const filtered = filter === "all" ? sorted : sorted.filter(t => t.status === filter);

  return (
    <div className="cc-panel-list">
      <div className="cc-todo-progress-bar">
        <div className="cc-todo-progress-track">
          <div className="cc-todo-progress-fill" style={{ width: `${stats.pct}%` }} />
        </div>
        <span className="cc-todo-progress-text">{stats.completed}/{todos.length} ({stats.pct}%)</span>
      </div>

      <div className="cc-todo-stats">
        {stats.inProgress > 0 && <span className="cc-todo-stat cc-todo-stat-progress">进行中 {stats.inProgress}</span>}
        {stats.pending > 0 && <span className="cc-todo-stat cc-todo-stat-pending">待处理 {stats.pending}</span>}
        {stats.completed > 0 && <span className="cc-todo-stat cc-todo-stat-done">已完成 {stats.completed}</span>}
      </div>

      <div className="cc-todo-filters">
        {FILTERS.map(f => (
          <button
            key={f.key}
            className={`cc-todo-filter-btn ${filter === f.key ? "active" : ""}`}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
            {f.key !== "all" && ` (${todos.filter(t => t.status === f.key).length})`}
          </button>
        ))}
      </div>

      {filtered.map((t, i) => (
        <div key={t.id ?? i} className={`cc-todo-item ${TODO_STATUS_CLASS[t.status] ?? ""}`}>
          <span className="cc-todo-icon">{TODO_STATUS_ICON[t.status] ?? "○"}</span>
          <span className="cc-todo-text">{t.content}</span>
        </div>
      ))}

      {filtered.length === 0 && (
        <div className="cc-panel-empty">该分类下暂无任务</div>
      )}
    </div>
  );
}

export default TodoList;
