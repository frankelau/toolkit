// HistoryFilters — 历史会话过滤栏

import { useMemo } from "react";
import type { ClaudeSession } from "../../types";

export interface HistoryFiltersProps {
  search: string;
  onSearchChange: (s: string) => void;
  projectFilter: string;
  onProjectChange: (p: string) => void;
  onlyFavorites: boolean;
  onToggleFavorites: () => void;
  sessions: ClaudeSession[];
}

export function HistoryFilters(props: HistoryFiltersProps) {
  const { search, onSearchChange, projectFilter, onProjectChange, onlyFavorites, onToggleFavorites, sessions } = props;

  const projects = useMemo(() => {
    const set = new Set<string>();
    sessions.forEach(s => set.add(s.project));
    return [...set].sort();
  }, [sessions]);

  return (
    <div className="cc-history-filters">
      <input
        className="cc-history-search"
        placeholder="搜索摘要 / 会话 ID / 项目"
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
      />
      <select
        className="cc-history-project-filter"
        value={projectFilter}
        onChange={(e) => onProjectChange(e.target.value)}
      >
        <option value="">全部项目</option>
        {projects.map(p => (
          <option key={p} value={p}>{p.replace(/^-Users-/, "~/").replace(/-/g, "/")}</option>
        ))}
      </select>
      <button
        className={`cc-history-fav-toggle ${onlyFavorites ? "active" : ""}`}
        onClick={onToggleFavorites}
        title="只看收藏"
      >
        ⭐
      </button>
    </div>
  );
}
