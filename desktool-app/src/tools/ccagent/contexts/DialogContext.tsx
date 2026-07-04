// DialogContext — 弹窗状态（对齐 cc-gui DialogContext）
// Sprint A: 从 CcAgent.tsx 拆出所有弹窗开关状态

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import type {
  PermissionRequest, PlanApprovalRequest, AskUserQuestionRequest,
  RewindRequest, ContextUsageData,
} from "../types";

export interface DialogContextValue {
  // 权限请求
  permRequest: PermissionRequest | null;
  setPermRequest: React.Dispatch<React.SetStateAction<PermissionRequest | null>>;
  // Plan 审批
  planApproval: PlanApprovalRequest | null;
  setPlanApproval: React.Dispatch<React.SetStateAction<PlanApprovalRequest | null>>;
  // 问答
  askUserQuestion: AskUserQuestionRequest | null;
  setAskUserQuestion: React.Dispatch<React.SetStateAction<AskUserQuestionRequest | null>>;
  // 回退
  rewindReq: RewindRequest | null;
  setRewindReq: React.Dispatch<React.SetStateAction<RewindRequest | null>>;
  rewindLoading: boolean;
  setRewindLoading: React.Dispatch<React.SetStateAction<boolean>>;
  // 上下文用量
  ctxUsageOpen: boolean;
  setCtxUsageOpen: React.Dispatch<React.SetStateAction<boolean>>;
  ctxUsageData: ContextUsageData | null;
  setCtxUsageData: React.Dispatch<React.SetStateAction<ContextUsageData | null>>;
  // 使用统计
  usageStatsOpen: boolean;
  setUsageStatsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  // PromptEnhancer
  peOpen: boolean;
  setPeOpen: React.Dispatch<React.SetStateAction<boolean>>;
  peLoading: boolean;
  setPeLoading: React.Dispatch<React.SetStateAction<boolean>>;
  peOriginal: string;
  setPeOriginal: React.Dispatch<React.SetStateAction<string>>;
  peEnhanced: string;
  setPeEnhanced: React.Dispatch<React.SetStateAction<string>>;
}

const DialogContext = createContext<DialogContextValue | null>(null);

export function DialogProvider({ children }: { children: ReactNode }) {
  const [permRequest, setPermRequest] = useState<PermissionRequest | null>(null);
  const [planApproval, setPlanApproval] = useState<PlanApprovalRequest | null>(null);
  const [askUserQuestion, setAskUserQuestion] = useState<AskUserQuestionRequest | null>(null);
  const [rewindReq, setRewindReq] = useState<RewindRequest | null>(null);
  const [rewindLoading, setRewindLoading] = useState(false);
  const [ctxUsageOpen, setCtxUsageOpen] = useState(false);
  const [ctxUsageData, setCtxUsageData] = useState<ContextUsageData | null>(null);
  const [usageStatsOpen, setUsageStatsOpen] = useState(false);
  const [peOpen, setPeOpen] = useState(false);
  const [peLoading, setPeLoading] = useState(false);
  const [peOriginal, setPeOriginal] = useState("");
  const [peEnhanced, setPeEnhanced] = useState("");

  const value = useMemo<DialogContextValue>(
    () => ({
      permRequest, setPermRequest,
      planApproval, setPlanApproval,
      askUserQuestion, setAskUserQuestion,
      rewindReq, setRewindReq, rewindLoading, setRewindLoading,
      ctxUsageOpen, setCtxUsageOpen, ctxUsageData, setCtxUsageData,
      usageStatsOpen, setUsageStatsOpen,
      peOpen, setPeOpen, peLoading, setPeLoading, peOriginal, setPeOriginal, peEnhanced, setPeEnhanced,
    }),
    [permRequest, planApproval, askUserQuestion, rewindReq, rewindLoading, ctxUsageOpen, ctxUsageData, usageStatsOpen, peOpen, peLoading, peOriginal, peEnhanced],
  );

  return <DialogContext.Provider value={value}>{children}</DialogContext.Provider>;
}

export function useDialog(): DialogContextValue {
  const ctx = useContext(DialogContext);
  if (ctx === null) throw new Error("useDialog must be used within a DialogProvider");
  return ctx;
}

export { DialogContext };
