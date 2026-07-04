// useDialogCountdownTimeout — 弹窗倒计时通用 hook（对齐 cc-gui）
// Sprint A: 供 PermissionDialog/PlanApprovalDialog/AskUserQuestionDialog 复用

import { useCallback, useEffect, useRef, useState } from "react";

const WARNING_THRESHOLD_SECONDS = 30;

interface UseDialogCountdownTimeoutOptions {
  isOpen: boolean;
  requestKey?: string | null;
  timeoutSeconds: number;
  onTimeout: () => void;
}

interface UseDialogCountdownTimeoutReturn {
  remainingSeconds: number;
  isTimeWarning: boolean;
  isTimedOut: boolean;
  markSubmitted: () => boolean;
}

export function useDialogCountdownTimeout({
  isOpen, requestKey, timeoutSeconds, onTimeout,
}: UseDialogCountdownTimeoutOptions): UseDialogCountdownTimeoutReturn {
  const [remainingSeconds, setRemainingSeconds] = useState(timeoutSeconds);
  const deadlineMsRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const submittedRef = useRef(false);
  const expiredRef = useRef(false);
  const timeoutFiredRef = useRef(false);
  const capturedTimeoutRef = useRef(timeoutSeconds);
  capturedTimeoutRef.current = timeoutSeconds;

  const triggerTimeout = useCallback(() => {
    expiredRef.current = true;
    if (submittedRef.current || timeoutFiredRef.current) return;
    timeoutFiredRef.current = true;
    submittedRef.current = true;
    onTimeout();
  }, [onTimeout]);

  const markSubmitted = useCallback(() => {
    if (submittedRef.current || expiredRef.current) return false;
    if (Date.now() >= deadlineMsRef.current) {
      triggerTimeout();
      return false;
    }
    submittedRef.current = true;
    return true;
  }, [triggerTimeout]);

  useEffect(() => {
    if (isOpen && requestKey) {
      submittedRef.current = false;
      expiredRef.current = false;
      timeoutFiredRef.current = false;
      const t = capturedTimeoutRef.current;
      setRemainingSeconds(t);
      deadlineMsRef.current = Date.now() + t * 1000;
    }
  }, [isOpen, requestKey]);

  useEffect(() => {
    const clearTimer = () => {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    };
    if (!isOpen || !requestKey) { clearTimer(); return; }
    clearTimer();
    timerRef.current = setInterval(() => {
      const next = Math.max(0, Math.ceil((deadlineMsRef.current - Date.now()) / 1000));
      setRemainingSeconds(next);
      if (next === 0) { clearTimer(); triggerTimeout(); }
    }, 1000);
    return clearTimer;
  }, [isOpen, requestKey, triggerTimeout]);

  return {
    remainingSeconds,
    isTimeWarning: remainingSeconds <= WARNING_THRESHOLD_SECONDS && remainingSeconds > 0,
    isTimedOut: remainingSeconds <= 0,
    markSubmitted,
  };
}
