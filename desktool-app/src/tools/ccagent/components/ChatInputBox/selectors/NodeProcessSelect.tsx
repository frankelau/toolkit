// NodeProcessSelect.tsx — Node.js 进程管理选择器
// 对齐 cc-gui ChatInputBox/selectors/NodeProcessSelect.tsx
// 适配：用 Tauri invoke 调用后端命令；简化版（分组 + 刷新 + 杀进程）
// TODO: 后端需补 cc_list_node_processes / cc_kill_node_process 命令（Sprint S）

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { invoke } from "@tauri-apps/api/core";
import { t } from "../../../i18n";

/** Node 进程信息 */
export interface NodeProcessInfo {
  pid: number;
  id: string;
  kind: "DAEMON" | "CHANNEL" | "ORPHAN";
  provider?: string;
  tabName?: string;
  command?: string;
  uptimeMs?: number;
  heapUsed?: number;
  activeRequestCount?: number;
}

export interface NodeProcessSnapshot {
  processes: NodeProcessInfo[];
  totals: { all: number; daemon: number; channel: number; orphan: number };
}

export interface NodeProcessSelectProps {
  embedded?: boolean;
  onClose?: () => void;
  onToast?: (message: string) => void;
}

const GROUP_HEADER_STYLE: CSSProperties = {
  display: "flex", alignItems: "center", gap: "6px",
  padding: "6px 12px 4px", fontSize: "11px", fontWeight: 600,
  color: "var(--text-secondary, #888)", textTransform: "uppercase", letterSpacing: "0.5px",
};

const GROUP_HEADER_ORPHAN_STYLE: CSSProperties = {
  ...GROUP_HEADER_STYLE, color: "#d9534f",
};

const PROCESS_ROW_STYLE: CSSProperties = {
  display: "flex", alignItems: "center", gap: "8px",
  padding: "6px 12px", cursor: "default",
};

const PROCESS_BODY_STYLE: CSSProperties = {
  display: "flex", flexDirection: "column", gap: "2px",
  minWidth: 0, flex: 1, overflow: "hidden",
};

const PROCESS_TITLE_STYLE: CSSProperties = {
  fontSize: "12px", color: "var(--text-primary, #333)",
  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
};

const PROCESS_META_STYLE: CSSProperties = {
  fontSize: "11px", color: "var(--text-secondary, #888)",
  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
};

const ICON_BUTTON_DANGER_STYLE: CSSProperties = {
  background: "transparent", border: "none", borderRadius: "4px",
  width: "24px", height: "24px", padding: 0,
  display: "flex", alignItems: "center", justifyContent: "center",
  color: "#d9534f", cursor: "pointer", flexShrink: 0,
};

const EMPTY_STATE_STYLE: CSSProperties = {
  padding: "20px 12px", textAlign: "center",
  color: "var(--text-secondary, #888)", fontSize: "12px",
};

function formatUptime(ms: number): string {
  if (ms <= 0) return "—";
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

function formatBytes(bytes: number): string {
  if (bytes <= 0) return "";
  const mb = bytes / (1024 * 1024);
  if (mb < 1) return `${(bytes / 1024).toFixed(0)} KB`;
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  return `${(mb / 1024).toFixed(2)} GB`;
}

function kindColor(kind: string): string {
  if (kind === "DAEMON") return "#3fb950";
  if (kind === "CHANNEL") return "#d29922";
  if (kind === "ORPHAN") return "#d9534f";
  return "var(--text-secondary, #888)";
}

function providerIcon(provider?: string, kind?: string): string {
  if (kind === "ORPHAN") return "codicon-warning";
  if (provider === "claude") return "codicon-server-process";
  if (provider === "codex") return "codicon-comment-discussion";
  return "codicon-debug-disconnect";
}

/**
 * NodeProcessSelect — Node.js 子进程管理面板
 * 按类型分组（daemon/channel/orphan），支持刷新、终止、批量清理孤儿进程。
 *
 * NOTE: 依赖后端命令 cc_list_node_processes / cc_kill_node_process / cc_kill_all_orphans。
 *       这些命令尚未实现，当前组件在命令缺失时显示空状态，不影响编译和运行。
 */
export function NodeProcessSelect({ embedded = false, onClose, onToast }: NodeProcessSelectProps) {
  const [snapshot, setSnapshot] = useState<NodeProcessSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [pendingPids, setPendingPids] = useState<Set<number>>(() => new Set());
  const dropdownRef = useRef<HTMLDivElement>(null);

  const requestRefresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await invoke<NodeProcessSnapshot>("cc_list_node_processes").catch(() => null);
      setSnapshot(data);
    } catch {
      setSnapshot(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!embedded) return;
    requestRefresh();
    const timer = window.setTimeout(() => requestRefresh(), 1500);
    return () => window.clearTimeout(timer);
  }, [embedded, requestRefresh]);

  const grouped = useMemo(() => {
    const daemon: NodeProcessInfo[] = [];
    const channel: NodeProcessInfo[] = [];
    const orphan: NodeProcessInfo[] = [];
    if (!snapshot) return { daemon, channel, orphan };
    for (const proc of snapshot.processes) {
      if (proc.kind === "DAEMON") daemon.push(proc);
      else if (proc.kind === "CHANNEL") channel.push(proc);
      else if (proc.kind === "ORPHAN") orphan.push(proc);
    }
    return { daemon, channel, orphan };
  }, [snapshot]);

  const orphanCount = grouped.orphan.length;
  const totalCount = snapshot?.totals.all ?? 0;

  const handleKill = useCallback(async (proc: NodeProcessInfo) => {
    if (pendingPids.has(proc.pid)) return;
    setPendingPids(prev => new Set(prev).add(proc.pid));
    try {
      await invoke("cc_kill_node_process", { pid: proc.pid, id: proc.id });
      onToast?.(t("config.nodeProcesses.killSuccess") || "已终止进程");
    } catch {
      onToast?.(t("config.nodeProcesses.killFailed") || "终止失败");
    } finally {
      setPendingPids(prev => {
        const next = new Set(prev);
        next.delete(proc.pid);
        return next;
      });
      requestRefresh();
    }
  }, [pendingPids, onToast, requestRefresh]);

  const handleKillAllOrphans = useCallback(async () => {
    if (orphanCount === 0) return;
    grouped.orphan.forEach(p => setPendingPids(prev => new Set(prev).add(p.pid)));
    try {
      const result = await invoke<{ killed: number }>("cc_kill_all_orphans").catch(() => ({ killed: 0 }));
      onToast?.(t("config.nodeProcesses.killAllSuccess", { count: result.killed }) || `已清理 ${result.killed} 个进程`);
    } catch {
      onToast?.(t("config.nodeProcesses.killFailed") || "清理失败");
    } finally {
      setPendingPids(new Set());
      requestRefresh();
    }
  }, [grouped.orphan, orphanCount, onToast, requestRefresh]);

  const renderRow = (proc: NodeProcessInfo) => {
    const isPending = pendingPids.has(proc.pid);
    const titleParts: string[] = [];
    if (proc.kind === "DAEMON") titleParts.push("Daemon");
    else if (proc.kind === "CHANNEL") titleParts.push("Channel");
    else titleParts.push("Orphan");
    if (proc.tabName) titleParts.push(proc.tabName);
    const titleText = titleParts.join(" · ");

    const metaParts: string[] = [`PID ${proc.pid}`];
    if (proc.uptimeMs) metaParts.push(formatUptime(proc.uptimeMs));
    if (proc.heapUsed && proc.heapUsed > 0) metaParts.push(formatBytes(proc.heapUsed));
    if (proc.activeRequestCount && proc.activeRequestCount > 0) {
      metaParts.push(`${proc.activeRequestCount} active`);
    }
    const metaText = metaParts.join(" · ");

    return (
      <div key={proc.id} style={PROCESS_ROW_STYLE}>
        <span
          className={`codicon ${providerIcon(proc.provider, proc.kind)}`}
          style={{ fontSize: "14px", flexShrink: 0, color: kindColor(proc.kind) }}
        />
        <div style={PROCESS_BODY_STYLE}>
          <span style={PROCESS_TITLE_STYLE}>{titleText}</span>
          <span style={PROCESS_META_STYLE}>{metaText}</span>
        </div>
        <button
          type="button"
          style={ICON_BUTTON_DANGER_STYLE}
          disabled={isPending}
          onClick={(e) => { e.stopPropagation(); handleKill(proc); }}
          title={t("config.nodeProcesses.kill") || "终止"}
        >
          <span className={`codicon ${isPending ? "codicon-loading codicon-modifier-spin" : "codicon-close"}`} />
        </button>
      </div>
    );
  };

  const renderGroup = (
    label: string, items: NodeProcessInfo[],
    headerStyle: CSSProperties = GROUP_HEADER_STYLE, icon?: string,
  ) => {
    if (items.length === 0) return null;
    return (
      <div>
        <div style={headerStyle}>
          {icon ? <span className={`codicon ${icon}`} /> : null}
          <span>{label} ({items.length})</span>
        </div>
        {items.map(renderRow)}
      </div>
    );
  };

  useEffect(() => {
    if (embedded) return;
    const handleClickOutside = () => onClose?.();
    const id = window.setTimeout(() => document.addEventListener("mousedown", handleClickOutside), 0);
    return () => { window.clearTimeout(id); document.removeEventListener("mousedown", handleClickOutside); };
  }, [embedded, onClose]);

  return (
    <div
      ref={dropdownRef}
      className="selector-dropdown node-process-dropdown"
      style={{
        position: "absolute", bottom: embedded ? 0 : "100%",
        left: embedded ? "100%" : 0, marginLeft: embedded ? "-30px" : undefined,
        marginBottom: embedded ? undefined : "4px", zIndex: 10001,
        minWidth: "260px", maxWidth: "360px", maxHeight: "380px",
        overflowY: "auto", overflowX: "hidden", padding: "6px 0",
      }}
      onMouseEnter={(e) => e.stopPropagation()}
    >
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "4px 12px 6px", fontSize: "11px",
        color: "var(--text-secondary, #888)", borderBottom: "1px solid var(--dropdown-border, #eee)",
      }}>
        <span>{t("config.nodeProcesses.summary", { total: totalCount, orphan: orphanCount }) || `总计: ${totalCount} · 孤儿: ${orphanCount}`}</span>
        <button
          type="button"
          style={{ background: "transparent", border: "none", color: "var(--text-primary, #333)", cursor: "pointer", padding: "2px 6px" }}
          onClick={(e) => { e.stopPropagation(); requestRefresh(); }}
          title={t("config.nodeProcesses.refresh") || "刷新"}
        >
          <span className={`codicon codicon-refresh ${loading ? "codicon-modifier-spin" : ""}`} />
        </button>
      </div>

      {loading && !snapshot ? (
        <div style={EMPTY_STATE_STYLE}>
          <span className="codicon codicon-loading codicon-modifier-spin" />
          <span style={{ marginLeft: 6 }}>{t("config.nodeProcesses.loading") || "加载中..."}</span>
        </div>
      ) : totalCount === 0 ? (
        <div style={EMPTY_STATE_STYLE}>
          <span className="codicon codicon-info" />
          <span style={{ marginLeft: 6 }}>{t("config.nodeProcesses.empty") || "暂无进程"}</span>
        </div>
      ) : (
        <>
          {renderGroup(t("config.nodeProcesses.groups.daemon") || "守护进程", grouped.daemon, GROUP_HEADER_STYLE, "codicon-server-process")}
          {renderGroup(t("config.nodeProcesses.groups.channel") || "会话通道", grouped.channel, GROUP_HEADER_STYLE, "codicon-comment-discussion")}
          {renderGroup(t("config.nodeProcesses.groups.orphan") || "孤儿进程", grouped.orphan, GROUP_HEADER_ORPHAN_STYLE, "codicon-warning")}
        </>
      )}

      {orphanCount > 0 && (
        <div style={{ display: "flex", justifyContent: "center", padding: "6px 12px 2px", borderTop: "1px solid var(--dropdown-border, #eee)", marginTop: "4px" }}>
          <button
            type="button"
            style={{ background: "transparent", border: "none", color: "#d9534f", fontSize: "11px", cursor: "pointer", padding: "4px 8px", borderRadius: "4px" }}
            onClick={(e) => { e.stopPropagation(); handleKillAllOrphans(); }}
          >
            <span className="codicon codicon-trash" style={{ marginRight: 4 }} />
            {t("config.nodeProcesses.killAll", { count: orphanCount }) || `清理 ${orphanCount} 个孤儿`}
          </button>
        </div>
      )}
    </div>
  );
}

export default NodeProcessSelect;
