// UsageStatisticsSection.types.ts — 类型定义
// 从 UsageStatisticsSection.tsx 拆分

import type { SessionUsageRecord } from "../../types";

export interface UsageStatisticsSectionProps {
  /** 累计花费 */
  totalCost: number;
  /** 累计输入 tokens */
  totalInput: number;
  /** 累计输出 tokens */
  totalOutput: number;
  /** 会话记录列表 */
  sessions: SessionUsageRecord[];
  /** 当前 Provider（用于过滤） */
  currentProvider?: string;
  /** 是否加载中 */
  loading?: boolean;
  /** 刷新回调 */
  onRefresh?: () => void;
  /** 重置回调 */
  onReset?: () => void;
}
