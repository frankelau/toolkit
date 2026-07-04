// CommitSection — Git 提交配置（对齐 cc-gui CommitSection）
// B8: 增强 — Git状态检测 + AI生成提交消息按钮

import { useState, useCallback, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";

interface CommitSectionProps {
  autoCommit: boolean;
  setAutoCommit: (v: boolean) => void;
  commitMessageTemplate: string;
  setCommitMessageTemplate: (v: string) => void;
  commitOnFileChange: boolean;
  setCommitOnFileChange: (v: boolean) => void;
}

interface GitStatus {
  is_repo: boolean;
  has_staged: boolean;
  has_changes: boolean;
  branch: string | null;
}

export function CommitSection(props: CommitSectionProps) {
  const [gitStatus, setGitStatus] = useState<GitStatus | null>(null);
  const [generating, setGenerating] = useState(false);
  const [generatedMsg, setGeneratedMsg] = useState("");
  const [error, setError] = useState("");

  // 轮询 git 状态
  const refreshGitStatus = useCallback(async () => {
    try {
      const status = await invoke<GitStatus>("cc_get_git_status", {
        repoPath: null,
      });
      setGitStatus(status);
      setError("");
    } catch {
      setGitStatus(null);
    }
  }, []);

  useEffect(() => {
    refreshGitStatus();
    const interval = setInterval(refreshGitStatus, 5000);
    return () => clearInterval(interval);
  }, [refreshGitStatus]);

  // AI 生成提交消息
  const generateMessage = useCallback(async () => {
    setGenerating(true);
    setError("");
    try {
      const result = await invoke<{
        success: boolean;
        message: string;
        branch: string;
        source: string;
      }>("cc_generate_commit_message", {
        repoPath: null,
        styleHint: null,
      });
      setGeneratedMsg(result.message);
    } catch (e) {
      setError(String(e));
    }
    setGenerating(false);
  }, []);

  const copyGenerated = () => {
    navigator.clipboard.writeText(generatedMsg);
  };

  return (
    <div className="cc-settings-block">
      <div className="cc-settings-block-title">💾 Git 提交配置</div>

      {/* Git 状态栏 */}
      {gitStatus && (
        <div className={`cc-git-status ${gitStatus.is_repo ? "cc-git-ok" : "cc-git-warn"}`}>
          {gitStatus.is_repo ? (
            <>
              <span className="cc-git-branch">🌿 {gitStatus.branch}</span>
              {gitStatus.has_staged && <span className="cc-git-staged">📦 有暂存变更</span>}
              {gitStatus.has_changes && <span className="cc-git-changes">📝 有未暂存变更</span>}
              {!gitStatus.has_staged && !gitStatus.has_changes && (
                <span className="cc-git-clean">✨ 工作区干净</span>
              )}
            </>
          ) : (
            <span>⚠️ 当前目录非 Git 仓库</span>
          )}
          <button className="cc-git-refresh-btn" onClick={refreshGitStatus}>
            🔄
          </button>
        </div>
      )}

      {/* AI 生成提交消息 */}
      {gitStatus?.is_repo && (
        <div className="cc-commit-ai-section">
          <button
            className="cc-ai-commit-btn"
            onClick={generateMessage}
            disabled={generating || !gitStatus.has_staged}
            title={!gitStatus.has_staged ? "请先 git add 暂存变更" : "AI 生成提交消息"}
          >
            {generating ? "⏳ 生成中..." : "🤖 AI 生成提交消息"}
          </button>

          {error && <div className="cc-commit-error">❌ {error}</div>}

          {generatedMsg && (
            <div className="cc-commit-result">
              <div className="cc-commit-msg-header">
                <span>生成结果:</span>
                <button className="cc-copy-btn" onClick={copyGenerated}>
                  📋 复制
                </button>
              </div>
              <pre className="cc-commit-msg">{generatedMsg}</pre>
            </div>
          )}
        </div>
      )}

      {/* 原有配置 */}
      <div className="cc-setting-row">
        <label>自动提交</label>
        <label className="cc-toggle-switch">
          <input
            type="checkbox"
            checked={props.autoCommit}
            onChange={(e) => props.setAutoCommit(e.target.checked)}
          />
          <span className="cc-toggle-slider"></span>
          <span className="cc-toggle-label">
            {props.autoCommit ? "开启" : "关闭"}
          </span>
        </label>
      </div>

      {props.autoCommit && (
        <>
          <div className="cc-setting-row">
            <label>文件变更后自动提交</label>
            <label className="cc-toggle-switch">
              <input
                type="checkbox"
                checked={props.commitOnFileChange}
                onChange={(e) => props.setCommitOnFileChange(e.target.checked)}
              />
              <span className="cc-toggle-slider"></span>
              <span className="cc-toggle-label">
                {props.commitOnFileChange ? "开启" : "关闭"}
              </span>
            </label>
          </div>

          <div className="cc-setting-row cc-setting-row-stack">
            <label>提交消息模板</label>
            <textarea
              rows={3}
              value={props.commitMessageTemplate}
              onChange={(e) => props.setCommitMessageTemplate(e.target.value)}
              placeholder={"feat: {description}\n\nGenerated by Claude Code Agent"}
            />
            <div className="cc-setting-hint">
              可用变量: {"{description}"} {"{files}"} {"{timestamp}"} {"{engine}"}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
