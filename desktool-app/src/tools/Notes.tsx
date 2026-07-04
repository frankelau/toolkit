import { useMemo, useState } from "react";
import { marked } from "marked";
import DOMPurify from "dompurify";
import type { ToolProps } from "./types";
import { usePersistentState } from "../storage";
import "./Notes.css";

interface Note {
  id: string;
  title: string;
  body: string;
  category: string;
  tags: string[];
  updated: number;
  pinned?: boolean;
}

function renderMd(text: string): string {
  const raw = marked.parse(text);
  return DOMPurify.sanitize(typeof raw === "string" ? raw : "");
}

function wordCount(text: string) {
  const chars = text.length;
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  return { chars, words };
}

const uid = () => Math.random().toString(36).slice(2, 10);

/** F21 便签笔记：目录分类管理，本地存储，导入/导出 */
export default function Notes({ instanceId }: ToolProps) {
  const ns = `notes:${instanceId}`;
  const [notes, setNotes] = usePersistentState<Note[]>(`${ns}:list`, []);
  const [activeId, setActiveId] = usePersistentState<string>(`${ns}:active`, "");
  const [filter, setFilter] = usePersistentState<string>(`${ns}:filter`, "全部");
  const [search, setSearch] = usePersistentState<string>(`${ns}:search`, "");
  const [preview, setPreview] = useState(false);

  const categories = useMemo(() => {
    const set = new Set<string>(["全部"]);
    notes.forEach((n) => set.add(n.category || "未分类"));
    return [...set];
  }, [notes]);

  const visible = useMemo(() => {
    return notes
      .filter((n) => filter === "全部" || (n.category || "未分类") === filter)
      .filter((n) => !search || (n.title + n.body).toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => {
        if ((b.pinned ? 1 : 0) !== (a.pinned ? 1 : 0)) return (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0);
        return b.updated - a.updated;
      });
  }, [notes, filter, search]);

  const active = notes.find((n) => n.id === activeId) ?? null;

  function newNote() {
    const n: Note = {
      id: uid(),
      title: "新便签",
      body: "",
      category: filter === "全部" ? "未分类" : filter,
      tags: [],
      updated: Date.now(),
    };
    setNotes((arr) => [n, ...arr]);
    setActiveId(n.id);
  }

  function addTag(noteId: string, tag: string) {
    const t = tag.trim();
    if (!t) return;
    setNotes(arr => arr.map(n => n.id === noteId ? { ...n, tags: [...new Set([...n.tags, t])] } : n));
  }

  function removeTag(noteId: string, tag: string) {
    setNotes(arr => arr.map(n => n.id === noteId ? { ...n, tags: n.tags.filter(t => t !== tag) } : n));
  }

  function update(id: string, patch: Partial<Note>) {
    setNotes((arr) => arr.map((n) => (n.id === id ? { ...n, ...patch, updated: Date.now() } : n)));
  }

  function remove(id: string) {
    setNotes((arr) => arr.filter((n) => n.id !== id));
    if (activeId === id) setActiveId("");
  }

  function exportNotes() {
    const blob = new Blob([JSON.stringify(notes, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `notes-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function importNotes(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result as string) as Note[];
        if (!Array.isArray(data)) throw new Error("格式错误");
        const incoming = data.map((n) => ({ ...n, id: uid(), tags: n.tags ?? [] }));
        setNotes((arr) => [...incoming, ...arr]);
      } catch (e) {
        alert(`导入失败：${(e as Error).message}`);
      }
    };
    reader.readAsText(file);
  }

  return (
    <div className="nt-tool">
      {/* 分类侧栏 */}
      <div className="nt-cats">
        <div className="nt-cats-head">分类</div>
        {categories.map((c) => (
          <div
            key={c}
            className={`nt-cat ${filter === c ? "on" : ""}`}
            onClick={() => setFilter(c)}
          >
            {c}
            <span className="nt-cat-count">
              {c === "全部" ? notes.length : notes.filter((n) => (n.category || "未分类") === c).length}
            </span>
          </div>
        ))}
        <div className="nt-io">
          <button onClick={exportNotes} disabled={notes.length === 0}>导出</button>
          <label className="nt-import">
            导入
            <input type="file" accept="application/json,.json" hidden onChange={(e) => {
              const f = e.target.files?.[0]; if (f) importNotes(f); e.target.value = "";
            }} />
          </label>
        </div>
      </div>

      {/* 笔记列表 */}
      <div className="nt-list">
        <div className="nt-list-head">
          <input className="nt-search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="搜索…" />
          <button className="nt-new" onClick={newNote}>+ 新建</button>
        </div>
        <div className="nt-items">
          {visible.length === 0 ? (
            <div className="nt-empty">没有便签</div>
          ) : visible.map((n) => (
            <div key={n.id} className={`nt-item ${activeId === n.id ? "on" : ""} ${n.pinned ? "pinned" : ""}`} onClick={() => setActiveId(n.id)}>
              <div className="nt-item-title">
                {n.pinned && <span className="nt-pin-badge">📌 </span>}
                {n.title || "（无标题）"}
              </div>
              <div className="nt-item-preview">{n.body.slice(0, 50) || "空便签"}</div>
              <div className="nt-item-meta">
                <span>{n.category || "未分类"}</span>
                <span>{new Date(n.updated).toLocaleDateString("zh-CN")}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 编辑区 */}
      <div className="nt-editor">
        {active ? (
          <>
            <div className="nt-editor-bar">
              <input className="nt-title" value={active.title}
                onChange={(e) => update(active.id, { title: e.target.value })} placeholder="标题" />
              <input className="nt-cat-input" value={active.category}
                onChange={(e) => update(active.id, { category: e.target.value })} placeholder="分类"
                list={`nt-cats-${instanceId}`} />
              <datalist id={`nt-cats-${instanceId}`}>
                {categories.filter((c) => c !== "全部").map((c) => <option key={c} value={c} />)}
              </datalist>
              <button
                className={`nt-pin ${active.pinned ? "on" : ""}`}
                onClick={() => update(active.id, { pinned: !active.pinned })}
                title={active.pinned ? "取消置顶" : "置顶"}>
                {active.pinned ? "📌" : "📍"}
              </button>
              <button
                className={`nt-preview-btn ${preview ? "on" : ""}`}
                onClick={() => setPreview((v) => !v)}>
                {preview ? "编辑" : "预览"}
              </button>
              {active.tags.map(t => (
                <span key={t} className="nt-tag-chip" onClick={() => removeTag(active.id, t)} title="点击移除">{t} ×</span>
              ))}
              <input
                className="nt-tag-input"
                placeholder="+标签"
                onKeyDown={(e) => {
                  if (e.key === "Enter") { addTag(active.id, (e.target as HTMLInputElement).value); (e.target as HTMLInputElement).value = ""; }
                }}
              />
              <button className="nt-del" onClick={() => {
                if (window.confirm(`确认删除「${active.title || "此便签"}」？`)) remove(active.id);
              }}>删除</button>
            </div>
            {preview ? (
              <div
                className="nt-preview"
                dangerouslySetInnerHTML={{ __html: renderMd(active.body) }}
              />
            ) : (
              <textarea
                className="nt-body"
                value={active.body}
                onChange={(e) => update(active.id, { body: e.target.value })}
                placeholder="在此记录… (支持 Markdown)"
                spellCheck={false}
              />
            )}
            <div className="nt-footer">
              {(() => { const wc = wordCount(active.body); return `${wc.chars} 字符 · ${wc.words} 词`; })()}
            </div>
          </>
        ) : (
          <div className="nt-no-sel">选择左侧便签，或新建一条</div>
        )}
      </div>
    </div>
  );
}
