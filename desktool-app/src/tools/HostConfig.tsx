import { useState } from "react";
import type { ToolProps } from "./types";
import { usePersistentState } from "../storage";
import { copyText } from "../useCopyFeedback";
import { ENV_CHANGED_EVENT } from "./envState";
import "./HostConfig.css";

interface EnvVar {
  key: string;
  value: string;
}

interface Env {
  id: string;
  name: string;
  baseUrl: string;
  vars: EnvVar[];
}

type Draft = Omit<Env, "id">;

function emptyDraft(): Draft {
  return { name: "", baseUrl: "", vars: [] };
}

export default function HostConfig({ instanceId: _instanceId }: ToolProps) {
  // Global state — static keys, no instanceId, truly global across all instances
  const [envs, setEnvs] = usePersistentState<Env[]>("hostconfig:envs", []);
  const [activeId, setActiveId] = usePersistentState<string>("hostconfig:active", "");

  const [editingId, setEditingId] = useState<string | null>(null); // env.id | "new" | null
  const [draft, setDraft] = useState<Draft>(emptyDraft());
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  function startAdd() {
    setDraft(emptyDraft());
    setEditingId("new");
  }

  function startEdit(env: Env) {
    setDraft({ name: env.name, baseUrl: env.baseUrl, vars: env.vars.map((v) => ({ ...v })) });
    setEditingId(env.id);
  }

  function cancelEdit() { setEditingId(null); }

  function saveEdit() {
    if (!draft.name.trim()) return;
    if (editingId === "new") {
      setEnvs([...envs, { id: crypto.randomUUID(), ...draft }]);
    } else {
      setEnvs(envs.map((e) => (e.id === editingId ? { ...e, ...draft } : e)));
    }
    setEditingId(null);
    window.dispatchEvent(new CustomEvent(ENV_CHANGED_EVENT));
  }

  function deleteEnv(id: string) {
    setEnvs(envs.filter((e) => e.id !== id));
    if (activeId === id) setActiveId("");
    window.dispatchEvent(new CustomEvent(ENV_CHANGED_EVENT));
  }

  function toggleExpand(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function setActive(id: string) {
    setActiveId(activeId === id ? "" : id);
    window.dispatchEvent(new CustomEvent(ENV_CHANGED_EVENT));
  }

  function duplicateEnv(id: string) {
    const env = envs.find((e) => e.id === id);
    if (!env) return;
    setEnvs([...envs, { ...env, id: crypto.randomUUID(), name: `${env.name} (副本)` }]);
    window.dispatchEvent(new CustomEvent(ENV_CHANGED_EVENT));
  }

  function exportEnvs() {
    const blob = new Blob([JSON.stringify(envs, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `enviroments-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function importEnvs(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result as string);
        if (Array.isArray(data)) {
          const imported = data.map((e: Env) => ({ ...e, id: crypto.randomUUID() }));
          setEnvs((prev) => [...prev, ...imported]);
          window.dispatchEvent(new CustomEvent(ENV_CHANGED_EVENT));
        }
      } catch { /* ignore */ }
    };
    reader.readAsText(file);
  }

  // draft var helpers
  function addVar() { setDraft((d) => ({ ...d, vars: [...d.vars, { key: "", value: "" }] })); }
  function updateVar(i: number, field: "key" | "value", val: string) {
    setDraft((d) => ({ ...d, vars: d.vars.map((v, idx) => idx === i ? { ...v, [field]: val } : v) }));
  }
  function removeVar(i: number) { setDraft((d) => ({ ...d, vars: d.vars.filter((_, idx) => idx !== i) })); }

  function EditForm({ autoFocus }: { autoFocus?: boolean }) {
    return (
      <div className="hconf-edit-form">
        <div className="hconf-edit-row">
          <label className="hconf-edit-label">名称</label>
          <input className="hconf-edit-input" autoFocus={autoFocus}
            value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
            placeholder="如：开发环境" />
        </div>
        <div className="hconf-edit-row">
          <label className="hconf-edit-label">Base URL</label>
          <input className="hconf-edit-input hconf-url-input"
            value={draft.baseUrl} onChange={(e) => setDraft((d) => ({ ...d, baseUrl: e.target.value }))}
            placeholder="https://api.dev.example.com" />
        </div>
        <div className="hconf-vars-editor">
          <div className="hconf-vars-editor-header">
            <span className="hconf-vars-label">变量</span>
            <button className="hconf-var-add-btn" onClick={addVar}>+ 添加变量</button>
          </div>
          {draft.vars.length > 0 && (
            <div className="hconf-var-list-edit">
              {draft.vars.map((v, i) => (
                <div key={i} className="hconf-var-row-edit">
                  <input className="hconf-var-key-input" value={v.key}
                    onChange={(e) => updateVar(i, "key", e.target.value)} placeholder="KEY" />
                  <span className="hconf-var-eq">=</span>
                  <input className="hconf-var-val-input" value={v.value}
                    onChange={(e) => updateVar(i, "value", e.target.value)} placeholder="VALUE" />
                  <button className="hconf-var-del-btn" onClick={() => removeVar(i)}>×</button>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="hconf-edit-actions">
          <button className="hconf-btn-save" onClick={saveEdit}>保存</button>
          <button className="hconf-btn-cancel" onClick={cancelEdit}>取消</button>
        </div>
      </div>
    );
  }

  return (
    <div className="hconf-root">
      <div className="hconf-header">
        <span className="hconf-title">环境管理</span>
        {activeId && (
          <span className="hconf-active-badge">
            已激活：{envs.find((e) => e.id === activeId)?.name ?? ""}
          </span>
        )}
        <button className="hconf-add-btn" onClick={startAdd} disabled={editingId !== null}>
          + 新增环境
        </button>
        <button className="hconf-add-btn" onClick={exportEnvs} disabled={envs.length === 0}>导出</button>
        <label className="hconf-add-btn" style={{ cursor: "pointer" }}>
          导入
          <input type="file" accept="application/json,.json" hidden onChange={(e) => {
            const f = e.target.files?.[0]; if (f) importEnvs(f); e.target.value = "";
          }} />
        </label>
      </div>

      <div className="hconf-grid-header">
        <div className="hconf-col-name">名称</div>
        <div className="hconf-col-url">Base URL</div>
        <div className="hconf-col-vars">变量</div>
        <div className="hconf-col-actions">操作</div>
      </div>

      <div className="hconf-list">
        {envs.map((env) => {
          const isActive = activeId === env.id;
          const isEditing = editingId === env.id;
          const isExpanded = expandedIds.has(env.id);
          return (
            <div key={env.id} className={`hconf-env-block${isActive ? " hconf-env-active" : ""}`}>
              {isEditing ? <EditForm /> : (
                <>
                  <div className="hconf-env-row">
                    <div className="hconf-col-name">
                      {isActive && <span className="hconf-active-dot" />}
                      <span className="hconf-env-name">{env.name}</span>
                    </div>
                    <div className="hconf-col-url">
                      <span className="hconf-url-text" title={env.baseUrl}>{env.baseUrl}</span>
                      {env.baseUrl && (
                        <button className="hconf-copy-btn" onClick={() => copyText(env.baseUrl)}>复制</button>
                      )}
                    </div>
                    <div className="hconf-col-vars">
                      {env.vars.length > 0 ? (
                        <button className="hconf-expand-btn" onClick={() => toggleExpand(env.id)}>
                          {env.vars.length} 个变量 <span className="hconf-expand-arrow">{isExpanded ? "▲" : "▼"}</span>
                        </button>
                      ) : <span className="hconf-muted">—</span>}
                    </div>
                    <div className="hconf-col-actions">
                      <button className={`hconf-activate-btn${isActive ? " hconf-activate-btn-on" : ""}`}
                        onClick={() => setActive(env.id)} title={isActive ? "取消激活" : "设为当前环境"}>
                        {isActive ? "已激活" : "激活"}
                      </button>
                      <button className="hconf-action-btn" onClick={() => startEdit(env)}
                        disabled={editingId !== null}>编辑</button>
                      <button className="hconf-action-btn" onClick={() => duplicateEnv(env.id)}
                        disabled={editingId !== null} title="复制此环境">复制</button>
                      <button className="hconf-del-btn" onClick={() => deleteEnv(env.id)}>删除</button>
                    </div>
                  </div>
                  {isExpanded && env.vars.length > 0 && (
                    <div className="hconf-vars-panel">
                      {env.vars.map((v, i) => (
                        <div key={i} className="hconf-var-display-row">
                          <span className="hconf-var-key-text">{v.key}</span>
                          <span className="hconf-var-eq">=</span>
                          <span className="hconf-var-val-text">{v.value}</span>
                          <button className="hconf-copy-btn" onClick={() => copyText(v.value)}>复制</button>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })}

        {editingId === "new" && (
          <div className="hconf-env-block hconf-env-new"><EditForm autoFocus /></div>
        )}

        {envs.length === 0 && editingId !== "new" && (
          <div className="hconf-empty">暂无环境，点击「新增环境」开始添加</div>
        )}
      </div>
    </div>
  );
}
