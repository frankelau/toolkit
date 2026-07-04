/// <reference types="vitest" />
// @vitest-environment jsdom
// useDialogManagement.test.ts
// Tests for dialog state management hook

import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useDialogManagement } from "./useDialogManagement";

describe("useDialogManagement", () => {
  it("initializes all dialogs as closed/empty", () => {
    const { result } = renderHook(() => useDialogManagement());

    expect(result.current.permRequest).toBeNull();
    expect(result.current.planApproval).toBeNull();
    expect(result.current.askUserQuestion).toBeNull();
    expect(result.current.rewindReq).toBeNull();
    expect(result.current.rewindLoading).toBe(false);
    expect(result.current.ctxUsageOpen).toBe(false);
    expect(result.current.ctxUsageData).toBeNull();
    expect(result.current.usageStatsOpen).toBe(false);
    expect(result.current.peOpen).toBe(false);
    expect(result.current.changelogOpen).toBe(false);
  });

  it("sets permission request", () => {
    const { result } = renderHook(() => useDialogManagement());
    const req = { toolName: "Write", args: { file_path: "test.txt" }, toolUseId: "t1", sessionId: "s1" };

    act(() => result.current.setPermRequest(req as any));
    expect(result.current.permRequest).toBe(req);
  });

  it("clears permission request by setting null", () => {
    const { result } = renderHook(() => useDialogManagement());
    act(() => result.current.setPermRequest({ toolName: "Write", args: {}, toolUseId: "t1", sessionId: "s1" } as any));
    act(() => result.current.setPermRequest(null));
    expect(result.current.permRequest).toBeNull();
  });

  it("opens and closes context usage dialog", () => {
    const { result } = renderHook(() => useDialogManagement());

    act(() => result.current.setCtxUsageOpen(true));
    expect(result.current.ctxUsageOpen).toBe(true);

    act(() => result.current.setCtxUsageOpen(false));
    expect(result.current.ctxUsageOpen).toBe(false);
  });

  it("sets context usage data", () => {
    const { result } = renderHook(() => useDialogManagement());
    const data = { usedTokens: 1000, totalTokens: 100000, percentUsed: 1, messages: 5 };

    act(() => result.current.setCtxUsageData(data as any));
    expect(result.current.ctxUsageData).toBe(data);
  });

  it("toggles usage stats open", () => {
    const { result } = renderHook(() => useDialogManagement());
    act(() => result.current.setUsageStatsOpen(true));
    expect(result.current.usageStatsOpen).toBe(true);
  });

  it("toggles PE open", () => {
    const { result } = renderHook(() => useDialogManagement());
    act(() => result.current.setPeOpen(true));
    expect(result.current.peOpen).toBe(true);
  });

  it("toggles changelog open", () => {
    const { result } = renderHook(() => useDialogManagement());
    act(() => result.current.setChangelogOpen(true));
    expect(result.current.changelogOpen).toBe(true);
  });

  it("closeAll resets all dialogs", () => {
    const { result } = renderHook(() => useDialogManagement());

    act(() => {
      result.current.setPermRequest({ toolName: "x", args: {}, toolUseId: "t1", sessionId: "s1" } as any);
      result.current.setPlanApproval({ content: "plan" } as any);
      result.current.setCtxUsageOpen(true);
      result.current.setUsageStatsOpen(true);
      result.current.setPeOpen(true);
      result.current.setChangelogOpen(true);
    });

    act(() => result.current.closeAll());
    expect(result.current.permRequest).toBeNull();
    expect(result.current.planApproval).toBeNull();
    expect(result.current.ctxUsageOpen).toBe(false);
    expect(result.current.usageStatsOpen).toBe(false);
    expect(result.current.peOpen).toBe(false);
    expect(result.current.changelogOpen).toBe(false);
  });

  it("manages rewind state", () => {
    const { result } = renderHook(() => useDialogManagement());

    act(() => result.current.setRewindReq({ toolUseId: "t1", sessionId: "s1" } as any));
    expect(result.current.rewindReq).not.toBeNull();

    act(() => result.current.setRewindLoading(true));
    expect(result.current.rewindLoading).toBe(true);

    act(() => result.current.setRewindReq(null));
    expect(result.current.rewindReq).toBeNull();
  });

  it("manages plan approval", () => {
    const { result } = renderHook(() => useDialogManagement());
    const plan = { content: "Implementation plan", sessionId: "s1" };

    act(() => result.current.setPlanApproval(plan as any));
    expect(result.current.planApproval).toBe(plan);

    act(() => result.current.setPlanApproval(null));
    expect(result.current.planApproval).toBeNull();
  });
});
