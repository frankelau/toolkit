// GitPanel.tsx — B9: IDEA级Git管理面板
// Changes / Log / Branches 三Tab + 提交面板

import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";

// ─── Types ─────────────────────────────────────────────────────────────────

interface GitFileChange {
  path: string;
  status: string;
  staged: boolean;
  additions: number;
  deletions: number;
}

interface GitBranch {
  name: string;
  is_current: boolean;
  is_remote: boolean;
  ahead: number;
  behind: number;
}

interface GitLogEntry {
  hash: string;
  short_hash: string;
  author: string;
  date: string;
  message: string;
  refs: string[];
}

type TabKey = "changes" | "log" | "branches";

// ─── Status label mapping ───────────────────────────────────────────────────

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  M: { label: "修改", color: "#3b82f6" },
  A: { label: "新增", color: "#22c55e" },
  D: { label: "删除", color: "#ef4444" },
  R: { label: "重命名", color: "#f59e0b" },
  "??": { label: "未跟踪", color: "#9ca3af" },
  AM: { label: "新增", color: "#22c55e" },
  MM: { label: "修改", color: "#3b82f6" },
};

// ─── Component ──────────────────────────────────────────────────────────────

export default function GitPanel() {
  const [activeTab, setActiveTab] = useState<TabKey>("changes");
  const [files, setFiles] = useState<GitFileChange[]>([]);
  const [branches, setBranches] = useState<GitBranch[]>([]);
  const [log, setLog] = useState<GitLogEntry[]>([]);
  const [selectedDiff, setSelectedDiff] = useState<string>("");
  const [selectedFile, setSelectedFile] = useState<string>("");
  const [commitMsg, setCommitMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [opResult, setOpResult] = useState("");
  const [newBranch, setNewBranch] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [f, b, l] = await Promise.all([
        invoke<GitFileChange[]>("cc_get_git_changes", { repoPath: null }).catch(() => []),
        invoke<GitBranch[]>("cc_get_git_branches", { repoPath: null }).catch(() => []),
        invoke<GitLogEntry[]>("cc_get_git_log", { repoPath: null, maxCount: 30 }).catch(() => []),
      ]);
      setFiles(f);
      setBranches(b);
      setLog(l);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  // ─── Actions ─────────────────────────────────────────────────────────────

  const stage = async (path: string) => {
    await invoke("cc_stage_file", { filePath: path, repoPath: null });
    refresh();
  };
  const unstage = async (path: string) => {
    await invoke("cc_unstage_file", { filePath: path, repoPath: null });
    refresh();
  };
  const stageAll = async () => { await invoke("cc_stage_all", { repoPath: null }); refresh(); };
  const revert = async (path: string) => {
    await invoke("cc_revert_file", { filePath: path, repoPath: null });
    refresh();
  };
  const showDiff = async (path: string, staged: boolean) => {
    const diff = await invoke<string>("cc_get_git_file_diff", {
      filePath: path, staged, repoPath: null,
    });
    setSelectedDiff(diff);
    setSelectedFile(path);
  };
  const doCommit = async () => {
    if (!commitMsg.trim()) return;
    try {
      const r = await invoke<{ success: boolean }>("cc_git_commit", {
        message: commitMsg, repoPath: null,
      });
      setOpResult(r.success ? "✅ 提交成功" : "❌ 提交失败");
      setCommitMsg("");
      refresh();
    } catch (e) { setOpResult(`❌ ${e}`); }
  };
  const checkout = async (name: string) => {
    await invoke("cc_checkout_branch", { branchName: name, repoPath: null });
    refresh();
  };
  const createBranch = async () => {
    if (!newBranch.trim()) return;
    await invoke("cc_create_branch", { branchName: newBranch, repoPath: null });
    setNewBranch("");
    refresh();
  };
  const doPull = async () => {
    const r = await invoke<{ success: boolean; output: string }>("cc_git_pull", { repoPath: null, rebase: true });
    setOpResult(r.success ? `✅ ${r.output}` : `❌ Pull 失败`);
    refresh();
  };
  const doPush = async () => {
    const r = await invoke<{ success: boolean; output: string }>("cc_git_push", { repoPath: null });
    setOpResult(r.success ? `✅ ${r.output}` : `❌ Push 失败`);
    refresh();
  };
  const doFetch = async () => {
    await invoke("cc_git_fetch", { repoPath: null });
    setOpResult("✅ Fetch 完成");
    refresh();
  };
  const genCommitMsg = async () => {
    try {
      const r = await invoke<{ message: string }>("cc_generate_commit_message", { repoPath: null, styleHint: null });
      setCommitMsg(r.message);
    } catch (e) { setOpResult(`❌ ${e}`); }
  };

  // ─── Render helpers ──────────────────────────────────────────────────────

  const stagedFiles = files.filter((f) => f.staged);
  const unstagedFiles = files.filter((f) => !f.staged);

  const FileRow = ({ f, isStaged }: { f: GitFileChange; isStaged: boolean }) => {
    const s = STATUS_LABELS[f.status] || { label: f.status, color: "#9ca3af" };
    const filename = f.path.split("/").pop() || f.path;
    return (
      <div className="git-file-row" onClick={() => showDiff(f.path, isStaged)}>
        <span className="git-file-status" style={{ color: s.color }}>
          {s.label}
        </span>
        <span className="git-file-name">{filename}</span>
        <span className="git-file-path">{f.path}</span>
        <span className="git-file-stats">
          {f.additions > 0 && <span className="git-stat-add">+{f.additions}</span>}
          {f.deletions > 0 && <span className="git-stat-del">-{f.deletions}</span>}
        </span>
        <div className="git-file-actions" onClick={(e) => e.stopPropagation()}>
          {isStaged ? (
            <button className="git-btn-sm" onClick={() => unstage(f.path)}>Unstage</button>
          ) : (
            <>
              <button className="git-btn-sm git-btn-primary" onClick={() => stage(f.path)}>Stage</button>
              <button className="git-btn-sm git-btn-danger" onClick={() => revert(f.path)}>Revert</button>
            </>
          )}
        </div>
      </div>
    );
  };

  // ─── Main render ─────────────────────────────────────────────────────────

  return (
    <div className="git-panel">
      {/* Toolbar */}
      <div className="git-toolbar">
        <div className="git-tabs">
          {(["changes", "log", "branches"] as TabKey[]).map((t) => (
            <button
              key={t}
              className={`git-tab ${activeTab === t ? "git-tab-active" : ""}`}
              onClick={() => setActiveTab(t)}
            >
              {t === "changes" ? "📝 变更" : t === "log" ? "📜 日志" : "🌿 分支"}
              {t === "changes" && files.length > 0 && (
                <span className="git-badge">{files.length}</span>
              )}
            </button>
          ))}
        </div>
        <div className="git-actions">
          <button className="git-btn" onClick={doFetch} title="Fetch">⬇ Fetch</button>
          <button className="git-btn" onClick={doPull} title="Pull">⬇ Pull</button>
          <button className="git-btn" onClick={doPush} title="Push">⬆ Push</button>
          <button className="git-btn" onClick={refresh} disabled={loading}>🔄</button>
        </div>
      </div>

      {/* Op result */}
      {opResult && (
        <div className="git-result" onClick={() => setOpResult("")}>
          {opResult}
        </div>
      )}

      {/* ── Changes Tab ── */}
      {activeTab === "changes" && (
        <div className="git-changes">
          {/* Staged */}
          {stagedFiles.length > 0 && (
            <div className="git-section">
              <div className="git-section-header">
                <span>📦 暂存 ({stagedFiles.length})</span>
                <button className="git-btn-sm git-btn-danger" onClick={() => stagedFiles.forEach((f) => unstage(f.path))}>
                  全部 Unstage
                </button>
              </div>
              {stagedFiles.map((f, i) => (
                <FileRow key={`s${i}`} f={f} isStaged={true} />
              ))}
            </div>
          )}

          {/* Unstaged */}
          {unstagedFiles.length > 0 && (
            <div className="git-section">
              <div className="git-section-header">
                <span>📝 未暂存 ({unstagedFiles.length})</span>
                <button className="git-btn-sm git-btn-primary" onClick={stageAll}>
                  全部 Stage
                </button>
              </div>
              {unstagedFiles.map((f, i) => (
                <FileRow key={`u${i}`} f={f} isStaged={false} />
              ))}
            </div>
          )}

          {/* Diff viewer */}
          {selectedDiff && (
            <div className="git-diff-viewer">
              <div className="git-diff-header">
                <span>Diff: {selectedFile}</span>
                <button onClick={() => { setSelectedDiff(""); setSelectedFile(""); }}>✕</button>
              </div>
              <pre className="git-diff-content">{selectedDiff}</pre>
            </div>
          )}

          {/* Commit panel */}
          <div className="git-commit-panel">
            <textarea
              className="git-commit-input"
              placeholder="提交消息..."
              value={commitMsg}
              onChange={(e) => setCommitMsg(e.target.value)}
              rows={3}
            />
            <div className="git-commit-actions">
              <button className="git-btn git-btn-primary" onClick={doCommit} disabled={!commitMsg.trim()}>
                ✅ 提交
              </button>
              <button className="git-btn" onClick={genCommitMsg} disabled={stagedFiles.length === 0}>
                🤖 AI 生成
              </button>
            </div>
          </div>

          {files.length === 0 && (
            <div className="git-empty">✨ 没有变更，工作区干净</div>
          )}
        </div>
      )}

      {/* ── Log Tab ── */}
      {activeTab === "log" && (
        <div className="git-log">
          {log.map((entry) => (
            <div key={entry.hash} className="git-log-entry">
              <span className="git-log-hash">{entry.short_hash}</span>
              <span className="git-log-msg">{entry.message}</span>
              <span className="git-log-meta">
                {entry.author} · {entry.date}
                {entry.refs.length > 0 && (
                  <span className="git-log-refs">
                    {entry.refs.map((r, i) => (
                      <span key={i} className="git-ref-tag">{r}</span>
                    ))}
                  </span>
                )}
              </span>
            </div>
          ))}
          {log.length === 0 && <div className="git-empty">暂无提交记录</div>}
        </div>
      )}

      {/* ── Branches Tab ── */}
      {activeTab === "branches" && (
        <div className="git-branches">
          {/* Create branch */}
          <div className="git-new-branch">
            <input
              placeholder="新分支名..."
              value={newBranch}
              onChange={(e) => setNewBranch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && createBranch()}
            />
            <button onClick={createBranch}>+ 创建</button>
          </div>

          {branches.map((b) => (
            <div
              key={b.name}
              className={`git-branch-row ${b.is_current ? "git-branch-current" : ""}`}
              onClick={() => !b.is_current && !b.is_remote && checkout(b.name)}
            >
              <span className="git-branch-icon">{b.is_current ? "●" : "○"}</span>
              <span className="git-branch-name">
                {b.name}
                {b.is_remote && <span className="git-branch-remote-tag">remote</span>}
              </span>
              {b.is_current && (
                <span className="git-branch-stats">
                  {b.ahead > 0 && <span className="git-stat-add">↑{b.ahead}</span>}
                  {b.behind > 0 && <span className="git-stat-del">↓{b.behind}</span>}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
