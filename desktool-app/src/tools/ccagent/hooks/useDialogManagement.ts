// useDialogManagement — 弹窗统一管理
// 对齐 cc-gui useDialogManagement
// D6增强: 权限超时 + 弹窗队列

import { useState, useCallback, useRef, useEffect } from "react";
import type {
  PermissionRequest, PlanApprovalRequest, AskUserQuestionRequest,
  RewindRequest, ContextUsageData,
} from "../types";

export interface DialogState {
  permRequest: PermissionRequest | null;
  planApproval: PlanApprovalRequest | null;
  askUserQuestion: AskUserQuestionRequest | null;
  rewindReq: RewindRequest | null;
  rewindLoading: boolean;
  ctxUsageOpen: boolean;
  ctxUsageData: ContextUsageData | null;
  usageStatsOpen: boolean;
  peOpen: boolean;
  changelogOpen: boolean;
}

export interface DialogActions {
  setPermRequest: (r: PermissionRequest | null) => void;
  setPlanApproval: (r: PlanApprovalRequest | null) => void;
  setAskUserQuestion: (r: AskUserQuestionRequest | null) => void;
  setRewindReq: (r: RewindRequest | null) => void;
  setRewindLoading: (b: boolean) => void;
  setCtxUsageOpen: (b: boolean) => void;
  setCtxUsageData: (d: ContextUsageData | null) => void;
  setUsageStatsOpen: (b: boolean) => void;
  setPeOpen: (b: boolean) => void;
  setChangelogOpen: (b: boolean) => void;
  closeAll: () => void;
  /** 权限弹窗超时 (秒) */
  permissionTimeout: number;
  setPermissionTimeout: (s: number) => void;
  /** 当前是否有弹窗打开 */
  hasOpenDialog: boolean;
}

export function useDialogManagement(): DialogState & DialogActions {
  const [permRequest, setPermRequest] = useState<PermissionRequest | null>(null);
  const [planApproval, setPlanApproval] = useState<PlanApprovalRequest | null>(null);
  const [askUserQuestion, setAskUserQuestion] = useState<AskUserQuestionRequest | null>(null);
  const [rewindReq, setRewindReq] = useState<RewindRequest | null>(null);
  const [rewindLoading, setRewindLoading] = useState(false);
  const [ctxUsageOpen, setCtxUsageOpen] = useState(false);
  const [ctxUsageData, setCtxUsageData] = useState<ContextUsageData | null>(null);
  const [usageStatsOpen, setUsageStatsOpen] = useState(false);
  const [peOpen, setPeOpen] = useState(false);
  const [changelogOpen, setChangelogOpen] = useState(false);
  const [permissionTimeout, setPermissionTimeout] = useState(60);

  // 弹窗打开检测
  const hasOpenDialog = !!(
    permRequest || planApproval || askUserQuestion || rewindReq ||
    ctxUsageOpen || usageStatsOpen || peOpen || changelogOpen
  );

  // 权限弹窗自动超时
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (permRequest && permissionTimeout > 0) {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        setPermRequest(null);
      }, permissionTimeout * 1000);
    }
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [permRequest, permissionTimeout]);

  const closeAll = useCallback(() => {
    setPermRequest(null);
    setPlanApproval(null);
    setAskUserQuestion(null);
    setRewindReq(null);
    setCtxUsageOpen(false);
    setUsageStatsOpen(false);
    setPeOpen(false);
    setChangelogOpen(false);
  }, []);

  return {
    permRequest, planApproval, askUserQuestion, rewindReq, rewindLoading,
    ctxUsageOpen, ctxUsageData, usageStatsOpen, peOpen, changelogOpen,
    setPermRequest, setPlanApproval, setAskUserQuestion, setRewindReq, setRewindLoading,
    setCtxUsageOpen, setCtxUsageData, setUsageStatsOpen, setPeOpen, setChangelogOpen,
    closeAll,
    permissionTimeout, setPermissionTimeout,
    hasOpenDialog,
  };
}
