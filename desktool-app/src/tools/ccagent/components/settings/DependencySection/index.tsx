// DependencySection — 依赖检查 + SDK 自动安装 (增强版 B4)
// 新增: SDK 状态检测 + 一键安装/卸载 + 安装进度

import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { copyToClipboard } from "../../../utils";

interface DependencyInfo {
  name: string;
  required: string;
  installed: string | null;
  path: string | null;
  ok: boolean;
  type: "runtime" | "cli" | "bridge" | "sdk";
  installCmd?: string;
  // SDK 特有
  sdkId?: string;
  latestVersion?: string;
  hasUpdate?: boolean;
}

interface SdkStatus {
  sdk_id: string;
  display_name: string;
  npm_package: string;
  installed: boolean;
  installed_version?: string;
  latest_version?: string;
  has_update: boolean;
  install_dir?: string;
  error_message?: string;
}

export function DependencySection() {
  const [deps, setDeps] = useState<DependencyInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null);
  const [installingSdk, setInstallingSdk] = useState<string | null>(null);
  const [installLog, setInstallLog] = useState<string[]>([]);
  const [nodeEnv, setNodeEnv] = useState<{node_installed?: boolean; node_version?: string; npm_installed?: boolean; npm_version?: string} | null>(null);

  async function checkDependencies() {
    setLoading(true);
    try {
      const info = await invoke<Record<string, unknown>>("cc_check_engines");
      const claude = info.claude as { path: string; version: string } | null;
      const codex = info.codex as { path: string; version: string } | null;
      const bridge = info.bridge as boolean;
      const claudeSdk = info.claudeSdk as boolean;
      const codexSdk = info.codexSdk as boolean;

      // Also check SDK status via new B4 commands
      let sdkStatuses: SdkStatus[] = [];
      try {
        sdkStatuses = await invoke<SdkStatus[]>("cc_get_all_sdk_status");
      } catch { /* new command, old backend may not have it */ }

      // Also check node environment
      let nodeStatus = null;
      try {
        nodeStatus = await invoke<any>("cc_check_node_environment");
        setNodeEnv(nodeStatus);
      } catch { /* optional */ }

      const sdkMap = new Map(sdkStatuses.map(s => [s.sdk_id, s]));

      const base: DependencyInfo[] = [
        { name: "Node.js", required: ">= 18", installed: "20.x+", path: null, ok: true, type: "runtime" },
        { name: "Claude Code CLI", required: ">= 1.0", installed: claude?.version || null, path: claude?.path || null, ok: !!claude, type: "cli", installCmd: "npm i -g @anthropic-ai/claude-code" },
        { name: "Codex CLI", required: ">= 0.1", installed: codex?.version || null, path: codex?.path || null, ok: !!codex, type: "cli", installCmd: "npm i -g @openai/codex" },
        { name: "cc-bridge", required: "正常", installed: bridge ? "已部署" : null, path: null, ok: bridge, type: "bridge" },
      ];

      // Claude Agent SDK
      const cas = sdkMap.get("claude-agent-sdk");
      base.push({
        name: "Claude Agent SDK",
        required: "已安装",
        installed: cas?.installed ? (cas.installed_version || "已安装") : (claudeSdk ? "已安装" : null),
        path: cas?.install_dir || null,
        ok: cas?.installed || claudeSdk || false,
        type: "sdk",
        installCmd: cas?.npm_package ? `npm install ${cas.npm_package}` : undefined,
        sdkId: "claude-agent-sdk",
        latestVersion: cas?.latest_version,
        hasUpdate: cas?.has_update,
      });

      // Codex SDK
      const cxs = sdkMap.get("codex-sdk");
      base.push({
        name: "Codex SDK",
        required: "已安装",
        installed: cxs?.installed ? (cxs.installed_version || "已安装") : (codexSdk ? "已安装" : null),
        path: cxs?.install_dir || null,
        ok: cxs?.installed || codexSdk || false,
        type: "sdk",
        installCmd: cxs?.npm_package ? `npm install ${cxs.npm_package}` : undefined,
        sdkId: "codex-sdk",
        latestVersion: cxs?.latest_version,
        hasUpdate: cxs?.has_update,
      });

      setDeps(base);
    } catch {
      setDeps([]);
    } finally {
      setLoading(false);
    }
  }

  const copyCmd = useCallback(async (cmd: string) => {
    await copyToClipboard(cmd);
    setCopiedCmd(cmd);
    setTimeout(() => setCopiedCmd(null), 2000);
  }, []);

  const installSdk = useCallback(async (sdkId: string) => {
    setInstallingSdk(sdkId);
    setInstallLog(["开始安装 " + sdkId + "... (~1-3分钟)"]);
    try {
      const result = await invoke<any>("cc_install_sdk", { sdkId, version: null });
      setInstallLog(result.logs || ["安装完成"]);
      if (result.success) {
        await checkDependencies(); // Refresh status
      }
    } catch (e) {
      setInstallLog(prev => [...prev, `错误: ${e}`]);
    } finally {
      setInstallingSdk(null);
    }
  }, []);

  const uninstallSdk = useCallback(async (sdkId: string) => {
    if (!confirm(`确认卸载 ${sdkId}？`)) return;
    try {
      await invoke("cc_uninstall_sdk", { sdkId });
      await checkDependencies();
    } catch (e) {
      setInstallLog([`卸载失败: ${e}`]);
    }
  }, []);

  useEffect(() => { checkDependencies(); }, []);

  const typeIcons: Record<string, string> = { runtime: "⚙️", cli: "🧠", bridge: "🌉", sdk: "📦" };
  const allOk = deps.length > 0 && deps.every(d => d.ok);
  const failCount = deps.filter(d => !d.ok).length;

  return (
    <div className="cc-settings-block">
      <div className="cc-settings-block-title">
        📦 依赖检查
        <button className="cc-dep-refresh" onClick={checkDependencies} disabled={loading}>
          {loading ? "检查中..." : "🔄 刷新"}
        </button>
      </div>

      {deps.length > 0 && (
        <div className={`cc-dep-summary ${allOk ? "ok" : "warn"}`}>
          {allOk ? "✅ 全部依赖就绪" : `⚠️ ${failCount} 项依赖缺失或异常`}
          {nodeEnv?.node_version && <span style={{marginLeft: 8, fontSize: 11}}>Node {nodeEnv.node_version}</span>}
        </div>
      )}

      <div className="cc-dep-list">
        {deps.map(dep => (
          <div key={dep.name} className={`cc-dep-item ${dep.ok ? "ok" : "fail"}`}>
            <span className="cc-dep-icon">{typeIcons[dep.type] || "📦"}</span>
            <div className="cc-dep-info">
              <div className="cc-dep-name">
                {dep.name}
                <span className={`cc-dep-status ${dep.ok ? "ok" : "fail"}`}>
                  {dep.ok ? "✅" : "❌"}
                </span>
                {dep.hasUpdate && <span className="cc-dep-update-badge">🆕 更新</span>}
              </div>
              <div className="cc-dep-meta">
                <span>需要: {dep.required}</span>
                {dep.installed && <span> · 已装: <code>{dep.installed}</code></span>}
                {dep.latestVersion && dep.installed !== dep.latestVersion && (
                  <span> · 最新: <code>{dep.latestVersion}</code></span>
                )}
                {dep.path && <span className="cc-dep-path"> · {dep.path}</span>}
              </div>

              {/* SDK 操作按钮 */}
              {dep.type === "sdk" && dep.sdkId && (
                <div className="cc-dep-actions">
                  {!dep.ok && (
                    <button
                      className="cc-dep-install-btn"
                      onClick={() => installSdk(dep.sdkId!)}
                      disabled={installingSdk === dep.sdkId}
                    >
                      {installingSdk === dep.sdkId ? "⏳ 安装中..." : "📥 一键安装"}
                    </button>
                  )}
                  {dep.ok && dep.hasUpdate && (
                    <button className="cc-dep-update-btn" onClick={() => installSdk(dep.sdkId!)}>
                      🔄 更新
                    </button>
                  )}
                  {dep.ok && (
                    <button className="cc-dep-uninstall-btn" onClick={() => uninstallSdk(dep.sdkId!)}>
                      🗑 卸载
                    </button>
                  )}
                </div>
              )}

              {/* CLI 安装命令复制 */}
              {!dep.ok && !dep.sdkId && dep.installCmd && (
                <button
                  className={`cc-dep-install-cmd ${copiedCmd === dep.installCmd ? "copied" : ""}`}
                  onClick={() => copyCmd(dep.installCmd!)}
                >
                  {copiedCmd === dep.installCmd ? "✓ 已复制" : `📋 ${dep.installCmd}`}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* 安装日志 */}
      {installLog.length > 0 && (
        <div className="cc-dep-install-log">
          <div className="cc-dep-log-title">📋 安装日志</div>
          <pre className="cc-dep-log-pre">{installLog.join("\n")}</pre>
        </div>
      )}
    </div>
  );
}
