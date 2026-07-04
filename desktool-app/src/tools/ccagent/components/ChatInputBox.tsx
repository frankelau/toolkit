// 输入框组件 — 深度增强版 (Sprint D2)
// D2-1: @文件引用增强 (模糊匹配/文件图标/chip标签/路径粘贴)
// D2-2: /斜杠命令分组  D2-3: 输入历史搜索
// 对齐 cc-gui ChatInputBox 核心交互

import { useState, useRef, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { readFile } from "@tauri-apps/plugin-fs";
import { toast } from "../../../useCopyFeedback";
import type { Attachment, FileEntry } from "../types";
import { DEFAULT_SLASH_COMMANDS } from "../constants";
import { getFileIcon, getFileColor } from "../utils";

// ── Types ──────────────────────────────────────────────────────────────────

export interface ChatInputBoxProps {
  value: string; onChange: (v: string) => void;
  onSend: () => void; onAbort: () => void;
  streaming: boolean; disabled: boolean;
  engine: "claude" | "codex"; cwd: string;
  attachments: Attachment[]; onAttachmentsChange: (atts: Attachment[]) => void;
  inputHistory: string[]; onHistoryAdd: (msg: string) => void;
  favorites: { id: string; name: string; message: string }[];
  onSaveFavorite: (name: string) => void; onLoadFavorite: (msg: string) => void;
  onRewind: () => void; onExport: () => void;
  hasMessages: boolean; showRewind: boolean;
}

// ── 文件模糊匹配评分 ────────────────────────────────────────────────────────

/** 按搜索词对文件列表评分排序（子串匹配 > 前缀匹配，文件名优先于目录名） */
function scoreFiles(results: FileEntry[], query: string): FileEntry[] {
  if (!query) return results;
  const q = query.toLowerCase();
  return results
    .map(f => {
      const name = f.path.toLowerCase();
      let score = 0;
      if (name === q) score = 100;
      else if (name.startsWith(q)) score = 80;
      else if (name.includes(q)) score = 50;
      else if (f.path.toLowerCase().includes(q)) score = 30;
      // 文件名匹配加分
      const fileName = name.split("/").pop() || name;
      if (fileName.startsWith(q)) score += 15;
      else if (fileName.includes(q)) score += 10;
      // 目录降序
      if (f.is_dir) score -= 5;
      return { ...f, _score: score };
    })
    .filter(f => f._score > 0)
    .sort((a, b) => b._score - a._score)
    .slice(0, 20);
}

// ── 斜杠命令 (分组) ─────────────────────────────────────────────────────────

const SLASH_GROUPS: Record<string, { icon: string; label: string }> = {
  project: { icon: "📂", label: "项目管理" },
  review: { icon: "🔍", label: "代码审查" },
  conversation: { icon: "💬", label: "对话控制" },
  tools: { icon: "🔧", label: "工具" },
};

/** 给命令分组的映射 */
function getSlashGroup(cmd: string): string {
  const map: Record<string, string> = {
    "/init": "project", "/review": "review", "/code-review": "review",
    "/security-review": "review", "/clear": "conversation",
    "/compact": "conversation", "/debug": "tools", "/simplify": "tools",
  };
  return map[cmd] || "tools";
}

// ── SlashCommandPicker (增强：分组+描述) ────────────────────────────────────

function SlashCommandPicker({ filter, onSelect }: { filter: string; onSelect: (cmd: string) => void }) {
  const filtered = DEFAULT_SLASH_COMMANDS.filter(c => c.cmd.startsWith(filter));
  if (filtered.length === 0) return null;

  // 按分组整理
  const grouped = new Map<string, typeof filtered>();
  for (const c of filtered) {
    const g = getSlashGroup(c.cmd);
    if (!grouped.has(g)) grouped.set(g, []);
    grouped.get(g)!.push(c);
  }

  return (
    <div className="cc-slash-picker">
      {[...grouped.entries()].map(([group, cmds]) => (
        <div key={group} className="cc-slash-group">
          {SLASH_GROUPS[group] && (
            <div className="cc-slash-group-title">
              {SLASH_GROUPS[group].icon} {SLASH_GROUPS[group].label}
            </div>
          )}
          {cmds.map(c => (
            <button key={c.cmd} className="cc-slash-item" onClick={() => onSelect(c.cmd)}>
              <span className="cc-slash-cmd">{c.cmd}</span>
              <span className="cc-slash-desc">{c.desc}</span>
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}

// ── FileReferencePicker (增强：图标+评分) ────────────────────────────────────

function FileReferencePicker({ query, results, onSelect }: {
  query: string; results: FileEntry[]; onSelect: (file: FileEntry) => void;
}) {
  // 客户端重新评分
  const scored = scoreFiles(results, query);

  return (
    <div className="cc-file-picker">
      <div className="cc-file-picker-title">📁 引用文件 — "{query}"</div>
      {scored.length === 0 ? <div className="cc-file-empty">未找到匹配文件</div> : (
        scored.map(f => {
          const icon = f.is_dir ? "📁" : getFileIcon(f.path);
          const color = f.is_dir ? "" : getFileColor(f.path);
          return (
            <button key={f.full_path} className="cc-file-item" onClick={() => onSelect(f)}>
              <span className="cc-file-icon">{icon}</span>
              <span className="cc-file-path" style={color ? { color } : undefined}>{f.path}</span>
              {!f.is_dir && f.size > 0 && (
                <span className="cc-file-size">{f.size > 1024 ? `${(f.size / 1024).toFixed(1)}KB` : `${f.size}B`}</span>
              )}
            </button>
          );
        })
      )}
    </div>
  );
}

// ── FileChip 标签 (彩色chip + x 移除) ────────────────────────────────────────

interface FileChip {
  path: string;
  fullPath: string;
  content: string;
}

function FileChipList({ chips, onRemove }: { chips: FileChip[]; onRemove: (idx: number) => void }) {
  if (chips.length === 0) return null;
  return (
    <div className="cc-file-chips">
      {chips.map((chip, i) => {
        const icon = getFileIcon(chip.path);
        const color = getFileColor(chip.path);
        return (
          <span key={i} className="cc-file-chip" style={color ? { borderColor: color, color } : undefined}>
            {icon} {chip.path.split("/").pop()}
            <button className="cc-file-chip-remove" onClick={() => onRemove(i)}>×</button>
          </span>
        );
      })}
    </div>
  );
}

// ── AttachmentList ──────────────────────────────────────────────────────────

function AttachmentList({ attachments, onRemove }: {
  attachments: Attachment[]; onRemove: (idx: number) => void;
}) {
  if (attachments.length === 0) return null;
  return (
    <div className="cc-attachment-list">
      {attachments.map((a, i) => (
        <div key={i} className="cc-attachment-item">
          <img src={`data:${a.mimeType};base64,${a.data}`} alt={a.name} className="cc-attachment-thumb" />
          <div className="cc-attachment-name">{a.name}</div>
          <button className="cc-attachment-remove" onClick={() => onRemove(i)}>×</button>
        </div>
      ))}
    </div>
  );
}

// ── Token indicator ────────────────────────────────────────────────────────

function TokenIndicator({ text }: { text: string }) {
  const approxTokens = Math.ceil(text.length / 4);
  if (approxTokens < 10) return null;
  return (
    <span className="cc-token-indicator" title={`约 ${approxTokens} tokens`}>
      ~{approxTokens > 1000 ? `${(approxTokens / 1000).toFixed(1)}K` : approxTokens} tok
    </span>
  );
}

// ── Resize handle ──────────────────────────────────────────────────────────

function ResizeHandle({ onResize }: { onResize: (deltaY: number) => void }) {
  const draggingRef = useRef(false);
  const startYRef = useRef(0);
  useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      if (!draggingRef.current) return;
      onResize(e.clientY - startYRef.current);
      startYRef.current = e.clientY;
    }
    function onMouseUp() { draggingRef.current = false; document.body.style.cursor = ""; document.body.style.userSelect = ""; }
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => { window.removeEventListener("mousemove", onMouseMove); window.removeEventListener("mouseup", onMouseUp); };
  }, [onResize]);
  return <div className="cc-input-resize-handle" onMouseDown={e => { draggingRef.current = true; startYRef.current = e.clientY; document.body.style.cursor = "ns-resize"; document.body.style.userSelect = "none"; }} />;
}

// ── 输入历史搜索 ────────────────────────────────────────────────────────────

function HistorySearchPane({ history, query, onSelect, onClose }: {
  history: string[]; query: string; onSelect: (text: string) => void; onClose: () => void;
}) {
  const filtered = query
    ? history.filter(h => h.toLowerCase().includes(query.toLowerCase())).slice(-20).reverse()
    : history.slice(-20).reverse();

  if (filtered.length === 0) return null;
  return (
    <div className="cc-history-search">
      <div className="cc-history-search-header">
        <span>📜 输入历史 {query && `— "${query}"`}</span>
        <button onClick={onClose}>×</button>
      </div>
      {filtered.map((h, i) => (
        <button key={i} className="cc-history-search-item" onClick={() => onSelect(h)}>
          {h.length > 80 ? h.slice(0, 80) + "…" : h}
        </button>
      ))}
    </div>
  );
}

// ── Main ChatInputBox ──────────────────────────────────────────────────────

export interface ChatInputBoxHandle { focus: () => void; insertText: (text: string) => void; }

export const ChatInputBox = ({
  value, onChange, onSend, onAbort, streaming, disabled, engine, cwd,
  attachments, onAttachmentsChange, inputHistory, onHistoryAdd,
  favorites, onSaveFavorite, onLoadFavorite, onRewind, onExport,
  hasMessages, showRewind,
}: ChatInputBoxProps) => {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [showFilePicker, setShowFilePicker] = useState(false);
  const [fileQuery, setFileQuery] = useState("");
  const [fileResults, setFileResults] = useState<FileEntry[]>([]);
  const [filePickerPos, setFilePickerPos] = useState<{ start: number } | null>(null);
  const [fileChips, setFileChips] = useState<FileChip[]>([]);
  const [showSlashPicker, setShowSlashPicker] = useState(false);
  const [slashFilter, setSlashFilter] = useState("");
  const [historyIdx, setHistoryIdx] = useState(-1);
  const [composing, setComposing] = useState(false);
  const [rows, setRows] = useState(4);
  const [favName, setFavName] = useState("");
  const [showFavInput, setShowFavInput] = useState(false);
  const [showHistorySearch, setShowHistorySearch] = useState(false);

  // ── File search (后端 + 前端评分) ─────────────────────────────────────────

  const searchFiles = useCallback(async (query: string) => {
    try {
      const results = await invoke<FileEntry[]>("cc_list_files", { dir: cwd, query });
      setFileResults(results);
    } catch { setFileResults([]); }
  }, [cwd]);

  // ── Input change ──────────────────────────────────────────────────────────

  function handleInputChange(val: string) {
    onChange(val);
    setHistoryIdx(-1);

    // @file reference — 支持 @/path 和 @name 格式
    const lastAt = val.lastIndexOf("@");
    if (lastAt >= 0) {
      const afterAt = val.slice(lastAt);
      // 只在 @ 后跟可识别的文件名字符时激活
      if (/^@[\w.\-/]*$/.test(afterAt)) {
        const query = afterAt.slice(1);
        if (!showFilePicker) {
          setShowFilePicker(true);
          setFilePickerPos({ start: lastAt });
        }
        setFileQuery(query);
        searchFiles(query);
      } else if (showFilePicker) {
        setShowFilePicker(false);
      }
    } else if (showFilePicker) {
      setShowFilePicker(false);
    }

    // Slash command
    if (val.startsWith("/") && !val.includes(" ") && val.length > 1) {
      setShowSlashPicker(true);
      setSlashFilter(val);
    } else if (showSlashPicker) {
      setShowSlashPicker(false);
    }

    // Auto-resize
    const lineCount = val.split("\n").length;
    setRows(Math.min(20, Math.max(4, lineCount + 1)));
  }

  // ── Keyboard ──────────────────────────────────────────────────────────────

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (composing) return;

    // Ctrl+F: 搜索历史
    if ((e.ctrlKey || e.metaKey) && e.key === "f") {
      e.preventDefault();
      setShowHistorySearch(true);
      return;
    }

    // Up/Down for history navigation
    if (e.key === "ArrowUp" && !showFilePicker && !showSlashPicker && !showHistorySearch && inputHistory.length > 0) {
      e.preventDefault();
      const newIdx = historyIdx === -1 ? inputHistory.length - 1 : Math.max(0, historyIdx - 1);
      setHistoryIdx(newIdx);
      onChange(inputHistory[newIdx]);
      return;
    }
    if (e.key === "ArrowDown" && historyIdx >= 0) {
      e.preventDefault();
      const newIdx = historyIdx + 1;
      if (newIdx >= inputHistory.length) { setHistoryIdx(-1); onChange(""); }
      else { setHistoryIdx(newIdx); onChange(inputHistory[newIdx]); }
      return;
    }

    // Esc
    if (e.key === "Escape") {
      setShowFilePicker(false); setShowSlashPicker(false); setShowHistorySearch(false);
      return;
    }

    // Ctrl/Cmd+Enter: send
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      if (!streaming && value.trim()) {
        onHistoryAdd(value.trim());
        onSend();
      }
    }
  }

  // ── Insert file reference ────────────────────────────────────────────────

  async function insertFileRef(file: FileEntry) {
    if (!filePickerPos) return;
    try {
      const content = await invoke<string>("cc_read_file", { path: file.full_path });
      // 替换 @query 为文件名引用
      const before = value.slice(0, filePickerPos.start);
      const after = value.slice(filePickerPos.start + 1 + fileQuery.length);
      onChange(before + after);
      // 添加 chip 标签
      setFileChips(prev => [...prev, { path: file.path, fullPath: file.full_path, content }]);
    } catch { toast("读取文件失败", "error"); }
    setShowFilePicker(false);
    inputRef.current?.focus();
  }

  function removeFileChip(idx: number) {
    setFileChips(prev => prev.filter((_, i) => i !== idx));
  }

  function insertSlashCommand(cmd: string) {
    onChange(cmd + " ");
    setShowSlashPicker(false);
    inputRef.current?.focus();
  }

  // ── Image upload ─────────────────────────────────────────────────────────

  async function uploadImage() {
    try {
      const result = await open({
        filters: [{ name: "Images", extensions: ["png", "jpg", "jpeg", "gif", "webp"] }],
        multiple: true,
      });
      if (!result) return;
      const files = Array.isArray(result) ? result : [result];
      for (const f of files) {
        const bytes = await readFile(f as string);
        const base64 = btoa(String.fromCharCode(...new Uint8Array(bytes)));
        const ext = (f as string).split(".").pop()?.toLowerCase();
        const mimeType = ext === "png" ? "image/png" : ext === "gif" ? "image/gif" : ext === "webp" ? "image/webp" : "image/jpeg";
        onAttachmentsChange([...attachments, { type: "image", data: base64, mimeType, name: (f as string).split("/").pop() || "image" }]);
      }
    } catch { /* cancelled */ }
  }

  // ── Paste / Drop ─────────────────────────────────────────────────────────

  function handlePaste(e: React.ClipboardEvent) {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith("image/")) {
        e.preventDefault();
        const file = item.getAsFile();
        if (!file) continue;
        const reader = new FileReader();
        reader.onload = () => {
          const base64 = (reader.result as string).split(",")[1];
          onAttachmentsChange([...attachments, { type: "image", data: base64, mimeType: file.type, name: `pasted-${Date.now()}.png` }]);
        };
        reader.readAsDataURL(file);
      }
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const files = e.dataTransfer?.files;
    if (!files || files.length === 0) return;
    for (const file of Array.from(files)) {
      if (file.type.startsWith("image/")) {
        const reader = new FileReader();
        reader.onload = () => {
          const base64 = (reader.result as string).split(",")[1];
          onAttachmentsChange([...attachments, { type: "image", data: base64, mimeType: file.type, name: file.name }]);
        };
        reader.readAsDataURL(file);
      } else {
        // 非图片文件：自动添加为 @引用
        const before = value;
        onChange(before + (before ? "\n" : "") + `@${file.name}\n`);
      }
    }
  }

  // ── Attachment remove ────────────────────────────────────────────────────

  function removeAttachment(idx: number) {
    onAttachmentsChange(attachments.filter((_, i) => i !== idx));
  }

  // ── Favorite ─────────────────────────────────────────────────────────────

  function handleSaveFavorite() {
    if (!showFavInput) { setShowFavInput(true); return; }
    if (favName.trim() && value.trim()) {
      onSaveFavorite(favName.trim());
      setFavName(""); setShowFavInput(false);
    }
  }

  // ── Resize ───────────────────────────────────────────────────────────────

  const handleResize = useCallback((deltaY: number) => {
    setRows(prev => Math.min(40, Math.max(4, prev + Math.round(-deltaY / 20))));
  }, []);

  // ── Send ──────────────────────────────────────────────────────────────────

  function handleSend() {
    if (!value.trim() || disabled || streaming) return;
    // 将 file chips 的内容拼接到消息中
    let fullText = value.trim();
    if (fileChips.length > 0) {
      const fileContents = fileChips.map(c =>
        `\n<file path="${c.path}">\n${c.content}\n</file>`
      ).join("");
      fullText += fileContents;
    }
    onChange(fullText);
    onHistoryAdd(fullText);
    setFileChips([]);
    onSend();
  }

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="cc-input-area" onPaste={handlePaste} onDrop={handleDrop}>
      {/* Attachment preview */}
      <AttachmentList attachments={attachments} onRemove={removeAttachment} />

      {/* File reference chips */}
      <FileChipList chips={fileChips} onRemove={removeFileChip} />

      {/* Slash command picker */}
      {showSlashPicker && (
        <SlashCommandPicker filter={slashFilter} onSelect={insertSlashCommand} />
      )}

      {/* File reference picker */}
      {showFilePicker && (
        <FileReferencePicker query={fileQuery} results={fileResults} onSelect={insertFileRef} />
      )}

      {/* History search pane */}
      {showHistorySearch && (
        <HistorySearchPane
          history={inputHistory}
          query={""}
          onSelect={(text) => { onChange(text); setShowHistorySearch(false); }}
          onClose={() => setShowHistorySearch(false)}
        />
      )}

      {/* Favorite name input */}
      {showFavInput && (
        <div className="cc-fav-input-row">
          <input className="cc-fav-name-input" value={favName}
            onChange={e => setFavName(e.target.value)} placeholder="收藏名称" autoFocus
            onKeyDown={e => { if (e.key === "Enter") handleSaveFavorite(); if (e.key === "Escape") setShowFavInput(false); }}
          />
          <button className="cc-fav-confirm" onClick={handleSaveFavorite}>保存</button>
          <button className="cc-fav-cancel" onClick={() => setShowFavInput(false)}>取消</button>
        </div>
      )}

      {/* Textarea */}
      <textarea ref={inputRef} className="cc-input" rows={rows} value={value}
        onChange={e => handleInputChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onCompositionStart={() => setComposing(true)}
        onCompositionEnd={() => setComposing(false)}
        placeholder={`向 ${engine === "claude" ? "Claude" : "Codex"} 发送消息…（@ 引用文件 · / 命令 · ↑↓ 历史 · Ctrl+Enter 发送 · Ctrl+F 搜索历史）`}
        disabled={disabled} spellCheck={false}
      />

      {/* Resize handle */}
      <ResizeHandle onResize={handleResize} />

      {/* Action bar */}
      <div className="cc-input-actions">
        <button className="cc-input-btn" onClick={uploadImage} title="上传图片">🖼️</button>
        <button className="cc-input-btn" title={`工作目录: ${cwd}`}>📁 {cwd.split("/").pop()}</button>

        <TokenIndicator text={value} />

        {favorites.length > 0 && (
          <select className="cc-fav-select" onChange={e => e.target.value && onLoadFavorite(e.target.value)} value="">
            <option value="">⭐ 收藏 ({favorites.length})</option>
            {favorites.map(f => <option key={f.id} value={f.message}>{f.name}</option>)}
          </select>
        )}
        <button className="cc-input-btn" onClick={handleSaveFavorite} disabled={!value.trim()} title="收藏当前输入">⭐</button>

        <div style={{ flex: 1 }} />

        {showRewind && hasMessages && <button className="cc-input-btn" onClick={onRewind} disabled={streaming}>⏪ 回退</button>}
        <button className="cc-input-btn" onClick={onExport} disabled={!hasMessages}>📤 导出</button>
        {streaming ? (
          <button className="cc-stop-btn" onClick={onAbort}>⏹ 停止</button>
        ) : (
          <button className="cc-send-btn" onClick={handleSend} disabled={!value.trim() || disabled}>发送 →</button>
        )}
      </div>
    </div>
  );
};
