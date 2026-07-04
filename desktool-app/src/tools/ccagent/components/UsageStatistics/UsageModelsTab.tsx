// UsageModelsTab.tsx — 模型统计 tab
// 对齐 cc-gui UsageStatistics/UsageModelsTab.tsx

import { formatCost, formatTokens } from "../../utils";
import type { ModelUsage } from "./useUsageStatistics";

export interface UsageModelsTabProps {
  byModel: ModelUsage[];
}

export function UsageModelsTab({ byModel }: UsageModelsTabProps) {
  if (byModel.length === 0) return <div className="cc-usage-empty">暂无数据</div>;

  return (
    <div className="cc-usage-models">
      <table className="cc-usage-table">
        <thead>
          <tr>
            <th>模型</th>
            <th>花费</th>
            <th>输入</th>
            <th>输出</th>
            <th>会话数</th>
          </tr>
        </thead>
        <tbody>
          {byModel.map(m => (
            <tr key={m.model}>
              <td>{m.model}</td>
              <td>${formatCost(m.cost)}</td>
              <td>{formatTokens(m.input)}</td>
              <td>{formatTokens(m.output)}</td>
              <td>{m.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default UsageModelsTab;
