// Phase 8 高级功能对话框 barrel exports

export { PlanApprovalDialog } from "./PlanApprovalDialog";
export type { PlanApprovalRequest } from "./PlanApprovalDialog";

export { AskUserQuestionDialog } from "./AskUserQuestionDialog";
export type { AskUserQuestionRequest, Question, QuestionOption } from "./AskUserQuestionDialog";

export { RewindDialog } from "./RewindDialog";
export type { RewindRequest } from "./RewindDialog";

export { RewindSelectDialog } from "./RewindSelectDialog";
export type { RewindableItem, RewindSelectDialogProps } from "./RewindSelectDialog";

export { ContextUsageDialog } from "./ContextUsageDialog";
export type { ContextUsageData, ContextCategory } from "./ContextUsageDialog";

export { UsageStatisticsDialog } from "./UsageStatisticsDialog";
export type { SessionRecord } from "./UsageStatisticsDialog";

export { ConversationSearch } from "./ConversationSearch";

// Sprint E: 追加对话框
export { DiscardAllDialog } from "./DiscardAllDialog";
export { UndoConfirmDialog } from "./UndoConfirmDialog";
export type { DiscardAllDialogProps } from "./DiscardAllDialog";
export type { UndoConfirmDialogProps } from "./UndoConfirmDialog";
