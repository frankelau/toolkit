// HistoryActions — 历史会话批量操作栏

export interface HistoryActionsProps {
  total: number;
  selected: number;
  onRefresh: () => void;
  onClearAll: () => void;
  onExportAll: () => void;
  loading: boolean;
}

export function HistoryActions(props: HistoryActionsProps) {
  const { total, onRefresh, onExportAll, loading } = props;
  return (
    <div className="cc-history-actions">
      <span className="cc-history-count">{total} 个会话</span>
      <div className="cc-history-actions-right">
        <button className="cc-history-action-btn" onClick={onRefresh} disabled={loading} title="刷新">
          {loading ? "⏳" : "🔄"}
        </button>
        <button className="cc-history-action-btn" onClick={onExportAll} disabled={total === 0} title="导出全部">
          ⬇ 导出全部
        </button>
      </div>
    </div>
  );
}
