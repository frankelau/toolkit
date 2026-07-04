import { useRef, useState } from "react";
import type { SubTab } from "./useSubTabs";
import "./SubTabBar.css";

interface Props {
  tabs: SubTab[];
  activeId: string;
  onSelect: (id: string) => void;
  onAdd: () => void;
  onDelete: (id: string) => void;
  onRename: (id: string, name: string) => void;
}

export default function SubTabBar({ tabs, activeId, onSelect, onAdd, onDelete, onRename }: Props) {
  const [editing, setEditing] = useState<string | null>(null);
  const [editVal, setEditVal] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  function startEdit(t: SubTab, e: React.MouseEvent) {
    e.stopPropagation();
    setEditing(t.id);
    setEditVal(t.name);
    setTimeout(() => inputRef.current?.select(), 0);
  }

  function commitEdit() {
    if (editing && editVal.trim()) onRename(editing, editVal.trim());
    setEditing(null);
  }

  return (
    <div className="stb-bar">
      {tabs.map((t) => (
        <div
          key={t.id}
          className={`stb-tab ${t.id === activeId ? "on" : ""}`}
          onClick={() => onSelect(t.id)}
        >
          {editing === t.id ? (
            <input
              ref={inputRef}
              className="stb-edit"
              value={editVal}
              onChange={(e) => setEditVal(e.target.value)}
              onBlur={commitEdit}
              onKeyDown={(e) => { if (e.key === "Enter") commitEdit(); if (e.key === "Escape") setEditing(null); }}
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span className="stb-name" onDoubleClick={(e) => startEdit(t, e)} title="双击重命名">
              {t.name}
            </span>
          )}
          {tabs.length > 1 && (
            <button
              className="stb-del"
              onClick={(e) => { e.stopPropagation(); onDelete(t.id); }}
              title="删除此配置"
            >
              ×
            </button>
          )}
        </div>
      ))}
      <button className="stb-add" onClick={onAdd} title="新增配置">+</button>
    </div>
  );
}
