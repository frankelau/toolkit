import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { ToolProps } from "./types";
import { usePersistentState } from "../storage";
import { copyText } from "../useCopyFeedback";
import "./SwitchHosts.css";

interface HostGroup {
  id: string;
  name: string;
  enabled: boolean;
  /** 自由文本：支持 IP 映射行、# 注释、空行 */
  content: string;
  /** 系统分组：不可删除，内容写入 /etc/hosts 系统区域 */
  isSystem?: boolean;
}

interface HostsInfo {
  system_lines: string[];
}

function newGroup(): HostGroup {
  return {
    id: crypto.randomUUID(),
    name: "新分组",
    enabled: false,
    content: "# 示例：\n# 127.0.0.1 example.local\n",
    isSystem: false,
  };
}

const SYSTEM_GROUP_ID = "__system_hosts__";

function makeSystemGroup(content: string): HostGroup {
  return {
    id: SYSTEM_GROUP_ID,
    name: "系统 hosts",
    enabled: true,
    content,
    isSystem: true,
  };
}

/** 统计一段 content 里有效（非注释非空）的行数 */
function countActive(content: string): number {
  return content.split("\n").filter((l) => {
    const t = l.trim();
    return t.length > 0 && !t.startsWith("#");
  }).length;
}

// ── 文本编辑器子组件 ────────────────────────────────────────────────────────────

interface HostEditorProps {
  value: string;
  onChange: (v: string) => void;
  groupEnabled: boolean;
}

function HostEditor({ value, onChange, groupEnabled }: HostEditorProps) {
  const taRef = useRef<HTMLTextAreaElement>(null);

  // Cmd/Ctrl+/ 切换当前行注释
  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.metaKey || e.ctrlKey) && e.key === "/") {
      e.preventDefault();
      const ta = e.currentTarget;
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      const lines = value.split("\n");

      // 找出光标涉及的行范围
      let charCount = 0;
      let startLine = 0;
      let endLine = 0;
      for (let i = 0; i < lines.length; i++) {
        const lineEnd = charCount + lines[i].length;
        if (charCount <= start && start <= lineEnd) startLine = i;
        if (charCount <= end && end <= lineEnd) endLine = i;
        charCount = lineEnd + 1; // +1 for \n
      }

      // 判断选中区域是否全部已注释
      const selectedLines = lines.slice(startLine, endLine + 1);
      const allCommented = selectedLines
        .filter((l) => l.trim().length > 0)
        .every((l) => l.trim().startsWith("#"));

      // 批量切换
      for (let i = startLine; i <= endLine; i++) {
        if (allCommented) {
          // 去掉 # 前缀
          lines[i] = lines[i].replace(/^(\s*)#\s?/, "$1");
        } else {
          if (lines[i].trim().length > 0) {
            lines[i] = "# " + lines[i];
          }
        }
      }

      const newValue = lines.join("\n");
      onChange(newValue);

      // 恢复光标位置（近似）
      requestAnimationFrame(() => {
        if (taRef.current) {
          taRef.current.selectionStart = start;
          taRef.current.selectionEnd = end;
        }
      });
      return;
    }
  }

  const displayLines = value.split("\n");

  return (
    <div className="she-wrap">
      {/* 语法高亮背景层 */}
      <div className="she-highlight" aria-hidden>
        {displayLines.map((line, i) => {
          const trimmed = line.trim();
          const isComment = trimmed.startsWith("#");
          const isEmpty = trimmed.length === 0;
          const isActive = !isComment && !isEmpty;
          return (
            <div
              key={i}
              className={`she-line${isComment ? " she-comment" : ""}${isActive ? " she-active" : ""}`}
            >
              {/* 用空格占位保持高度 */}
              {line.length === 0 ? " " : line}
            </div>
          );
        })}
      </div>
      {/* 实际输入层（透明背景叠在高亮层上） */}
      <textarea
        ref={taRef}
        className="she-textarea"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        spellCheck={false}
        placeholder={"127.0.0.1 api.local.com\n# 注释行（Ctrl+/ 切换注释）"}
      />
      {/* 顶部提示 */}
      <div className="she-hint">
        <span className="she-hint-item she-hint-active">■ 生效行</span>
        <span className="she-hint-item she-hint-comment">■ 注释行</span>
        <span className="she-hint-sep">|</span>
        <kbd>{navigator.platform.includes("Mac") ? "⌘" : "Ctrl"}+/</kbd>
        <span> 切换注释</span>
        {!groupEnabled && <span className="she-hint-warn"> · 分组未启用，所有行写入时自动注释</span>}
      </div>
    </div>
  );
}

// ── 主组件 ──────────────────────────────────────────────────────────────────────

export default function SwitchHosts({ instanceId: _instanceId }: ToolProps) {
  // 分组持久化在 localStorage（全局，不含 instanceId，所有实例共享）
  const [groups, setGroups] = usePersistentState<HostGroup[]>("switchhosts:groups", []);
  const [systemLines, setSystemLines] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewContent, setPreviewContent] = useState("");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [editingNameId, setEditingNameId] = useState<string | null>(null);
  const [nameInput, setNameInput] = useState("");
  const [activeTab, setActiveTab] = useState<"groups" | "system">("groups");
  const [groupSearch, setGroupSearch] = useState("");

  // 初始化：加载系统 hosts 内容，确保系统分组存在
  useEffect(() => {
    (async () => {
      try {
        const sysContent = await invoke<string>("read_system_hosts");
        setGroups((prev) => {
          const hasSystem = prev.some((g) => g.isSystem || g.id === SYSTEM_GROUP_ID);
          if (hasSystem) {
            // 更新已有系统分组的内容
            return prev.map((g) =>
              (g.isSystem || g.id === SYSTEM_GROUP_ID)
                ? { ...g, content: sysContent, isSystem: true, id: SYSTEM_GROUP_ID, name: "系统 hosts", enabled: true }
                : g
            );
          }
          // 首次：在列表最前面插入系统分组
          return [makeSystemGroup(sysContent), ...prev];
        });
      } catch (e) {
        setError(`读取系统 hosts 失败：${(e as Error).message ?? e}`);
      }
    })();
    loadSystemLines();
  }, []);

  async function loadSystemLines() {
    setLoading(true);
    setError("");
    try {
      const info = await invoke<HostsInfo>("read_hosts");
      setSystemLines(info.system_lines);
    } catch (e) {
      setError(`读取 /etc/hosts 失败：${(e as Error).message ?? e}`);
    } finally {
      setLoading(false);
    }
  }

  async function openPreview() {
    try {
      const text = await invoke<string>("preview_hosts", { groups });
      setPreviewContent(text);
      setPreviewOpen(true);
    } catch (e) {
      setError(`预览失败：${(e as Error).message ?? e}`);
    }
  }

  async function applyHosts() {
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      await invoke("apply_hosts", { groups });
      setSuccess("✓ 已成功写入 /etc/hosts（如浏览器未生效，可执行 dscacheutil -flushcache 刷新 DNS 缓存）");
      setPreviewOpen(false);
      // 应用后自动刷新系统条目
      await loadSystemLines();
      // 同时刷新系统分组内容
      try {
        const sysContent = await invoke<string>("read_system_hosts");
        setGroups((prev) => prev.map((g) =>
          (g.isSystem || g.id === SYSTEM_GROUP_ID)
            ? { ...g, content: sysContent }
            : g
        ));
      } catch { /* ignore */ }
      setTimeout(() => setSuccess(""), 6000);
    } catch (e) {
      setError(`写入失败：${(e as Error).message ?? e}`);
    } finally {
      setSaving(false);
    }
  }

  function addGroup() {
    const g = newGroup();
    setGroups((p) => [...p, g]);
    setExpandedIds((s) => new Set([...s, g.id]));
  }

  function moveGroup(fromIdx: number, toIdx: number) {
    setGroups((prev) => {
      const sysGroup = prev.find(g => g.isSystem);
      const userGroups = prev.filter(g => !g.isSystem);
      if (fromIdx < 0 || fromIdx >= userGroups.length || toIdx < 0 || toIdx >= userGroups.length || fromIdx === toIdx) return prev;
      const [moved] = userGroups.splice(fromIdx, 1);
      userGroups.splice(toIdx, 0, moved);
      return sysGroup ? [sysGroup, ...userGroups] : userGroups;
    });
  }

  function removeGroup(id: string) {
    // 系统分组不可删除
    if (id === SYSTEM_GROUP_ID) return;
    setGroups((p) => p.filter((g) => g.id !== id));
    setExpandedIds((s) => { const n = new Set(s); n.delete(id); return n; });
  }

  function toggleGroup(id: string) {
    // 系统分组始终启用，不可切换
    if (id === SYSTEM_GROUP_ID) return;
    setGroups((p) => p.map((g) => g.id === id ? { ...g, enabled: !g.enabled } : g));
  }

  function toggleExpand(id: string) {
    setExpandedIds((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }

  function startRename(g: HostGroup) {
    setEditingNameId(g.id);
    setNameInput(g.name);
  }

  function commitRename(id: string) {
    if (nameInput.trim()) {
      setGroups((p) => p.map((g) => g.id === id ? { ...g, name: nameInput.trim() } : g));
    }
    setEditingNameId(null);
  }

  function updateContent(id: string, content: string) {
    setGroups((p) => p.map((g) => g.id === id ? { ...g, content } : g));
  }

  function enableAllGroups() {
    setGroups((p) => p.map((g) => g.isSystem ? g : { ...g, enabled: true }));
  }

  function disableAllGroups() {
    setGroups((p) => p.map((g) => g.isSystem ? g : { ...g, enabled: false }));
  }

  async function restoreSystemGroup() {
    try {
      const sysContent = await invoke<string>("read_system_hosts");
      setGroups((prev) => prev.map((g) =>
        (g.isSystem || g.id === SYSTEM_GROUP_ID)
          ? { ...g, content: sysContent }
          : g
      ));
    } catch (e) {
      setError(`还原系统 hosts 失败：${(e as Error).message ?? e}`);
    }
  }

  const activeCount = groups.filter((g) => g.enabled).length;

  return (
    <div className="sh-root">
      {/* header */}
      <div className="sh-header">
        <span className="sh-title">SwitchHosts</span>
        {activeCount > 0 && (
          <span className="sh-active-badge">{activeCount} 组已启用</span>
        )}
        <div style={{ flex: 1 }} />
        <button className="sh-btn" onClick={loadSystemLines} disabled={loading} title="重新读取系统条目">
          🔄 刷新
        </button>
        <button className="sh-btn" onClick={openPreview} disabled={loading}>
          预览
        </button>
        <button className="sh-btn-primary" onClick={applyHosts} disabled={saving || loading}>
          {saving ? "写入中…" : "应用到系统"}
        </button>
      </div>

      {error   && <div className="sh-error">{error}</div>}
      {success && <div className="sh-success">{success}</div>}
      {loading && <div className="sh-loading">正在读取…</div>}

      <div className="sh-tabs">
        <button className={activeTab === "groups" ? "active" : ""} onClick={() => setActiveTab("groups")}>
          分组管理
        </button>
        <button className={activeTab === "system" ? "active" : ""} onClick={() => setActiveTab("system")}>
          系统原有条目
        </button>
      </div>

      {activeTab === "groups" && (
        <div className="sh-body">
          <div className="sh-groups-toolbar">
            <input
              className="sh-search"
              type="text"
              value={groupSearch}
              onChange={(e) => setGroupSearch(e.target.value)}
              placeholder="搜索分组名称…"
              spellCheck={false}
            />
            <button className="sh-btn sh-btn-sm" onClick={enableAllGroups} title="启用所有非系统分组">
              全部启用
            </button>
            <button className="sh-btn sh-btn-sm" onClick={disableAllGroups} title="禁用所有非系统分组">
              全部禁用
            </button>
          </div>
          <div className="sh-groups">
            {groups.length === 0 && (
              <div className="sh-empty">暂无分组，点击「+ 新增分组」开始</div>
            )}
            {groups
              .filter((g) => !groupSearch.trim() || g.name.toLowerCase().includes(groupSearch.toLowerCase()))
              .map((g, _mapIdx) => {
              const expanded = expandedIds.has(g.id);
              const isRenaming = editingNameId === g.id;
              const isSystem = g.isSystem || g.id === SYSTEM_GROUP_ID;
              const userGroupsIdx = isSystem ? -1 : groups.filter(x => !x.isSystem && x.id !== SYSTEM_GROUP_ID).findIndex(x => x.id === g.id);
              const activeLines = countActive(g.content);
              const totalLines = g.content.split("\n").filter((l) => l.trim()).length;
              return (
                <div key={g.id} className={`sh-group${g.enabled ? " sh-group-on" : ""}${isSystem ? " sh-group-system" : ""}`}
                  draggable={!isSystem}
                  onDragStart={(e) => { if (!isSystem) { e.dataTransfer.setData("text/plain", String(userGroupsIdx)); } }}
                  onDragOver={(e) => { if (!isSystem) e.preventDefault(); }}
                  onDrop={(e) => { if (!isSystem) { e.preventDefault(); const from = Number(e.dataTransfer.getData("text/plain")); if (!isNaN(from)) moveGroup(from, userGroupsIdx); } }}
                >
                  <div className="sh-group-head">
                    {isSystem ? (
                      <span className="sh-system-icon" title="系统 hosts 分组">⚙</span>
                    ) : (
                      <button className={`sh-toggle ${g.enabled ? "on" : ""}`}
                        onClick={() => toggleGroup(g.id)}
                        title={g.enabled ? "点击禁用" : "点击启用"}>
                        <span className="sh-toggle-thumb" />
                      </button>
                    )}

                    {isRenaming && !isSystem ? (
                      <input className="sh-name-input" autoFocus
                        value={nameInput}
                        onChange={(e) => setNameInput(e.target.value)}
                        onBlur={() => commitRename(g.id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") commitRename(g.id);
                          if (e.key === "Escape") setEditingNameId(null);
                        }} />
                    ) : (
                      <span className="sh-group-name"
                        onDoubleClick={() => !isSystem && startRename(g)}
                        title={isSystem ? "系统 hosts 分组（不可重命名）" : "双击重命名"}>
                        {g.name}
                      </span>
                    )}

                    <span className="sh-entry-count">
                      {activeLines > 0 ? (
                        <><span className="sh-count-active">{activeLines}</span>/{totalLines}</>
                      ) : (
                        <span className="sh-count-zero">{totalLines} 条（全注释）</span>
                      )}
                    </span>

                    <button className="sh-icon-btn" onClick={() => toggleExpand(g.id)}>
                      {expanded ? "▲" : "▼"}
                    </button>
                    {isSystem && (
                      <button className="sh-icon-btn sh-restore-btn"
                        onClick={() => restoreSystemGroup()}
                        title="还原为系统 /etc/hosts 实际内容">
                        ↺
                      </button>
                    )}
                    {!isSystem && <button className="sh-del-btn" onClick={() => removeGroup(g.id)}>×</button>}
                  </div>

                  {expanded && (
                    <div className="sh-entries">
                      <HostEditor
                        value={g.content}
                        onChange={(v) => updateContent(g.id, v)}
                        groupEnabled={g.enabled}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <button className="sh-add-group" onClick={addGroup}>+ 新增分组</button>
          <div className="sh-io-btns">
            <button className="sh-btn" onClick={() => {
              const blob = new Blob([JSON.stringify(groups, null, 2)], { type: "application/json" });
              const a = document.createElement("a");
              a.href = URL.createObjectURL(blob);
              a.download = `hosts-groups-${new Date().toISOString().slice(0, 10)}.json`;
              a.click();
              URL.revokeObjectURL(a.href);
            }} disabled={groups.length === 0}>导出分组</button>
            <label className="sh-btn sh-import-label">
              导入分组
              <input type="file" accept="application/json,.json" hidden onChange={(e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                const reader = new FileReader();
                reader.onload = () => {
                  try {
                    const data = JSON.parse(reader.result as string);
                    if (Array.isArray(data)) {
                      const imported = data.filter((g: HostGroup) => !g.isSystem).map((g: HostGroup) => ({ ...g, id: crypto.randomUUID(), isSystem: false }));
                      setGroups((prev) => [...prev, ...imported]);
                    }
                  } catch { /* ignore */ }
                };
                reader.readAsText(f);
                e.target.value = "";
              }} />
            </label>
          </div>
        </div>
      )}

      {activeTab === "system" && (
        <div className="sh-body sh-system">
          <div className="sh-system-tip">以下是 /etc/hosts 中 DevKit 区段之外的原有内容（只读）</div>
          <button className="sh-btn" style={{ alignSelf: "flex-start" }}
            onClick={() => copyText(systemLines.join("\n"))}>复制全部</button>
          <pre className="sh-system-pre">{systemLines.join("\n")}</pre>
        </div>
      )}

      {previewOpen && (
        <div className="sh-overlay" onClick={() => setPreviewOpen(false)}>
          <div className="sh-modal" onClick={(e) => e.stopPropagation()}>
            <div className="sh-modal-title">预览：即将写入的 /etc/hosts</div>
            <pre className="sh-preview-pre">{previewContent}</pre>
            <div className="sh-modal-actions">
              <button className="sh-btn-primary" onClick={applyHosts} disabled={saving}>
                {saving ? "写入中…" : "确认应用"}
              </button>
              <button className="sh-btn" onClick={() => setPreviewOpen(false)}>取消</button>
              <button className="sh-btn" onClick={() => copyText(previewContent)}>复制内容</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
