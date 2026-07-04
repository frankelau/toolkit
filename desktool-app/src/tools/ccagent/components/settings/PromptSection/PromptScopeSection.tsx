// PromptSection/PromptScopeSection.tsx — Prompt 作用域分区
// 对齐 cc-gui 的 PromptSection/PromptScopeSection.tsx
// 展示全局/项目级 Prompt 模板列表，支持增删改

import type { CSSProperties } from "react";
import type { PromptTemplate } from "../../../types";
import {
  CARD_STYLE, SECTION_TITLE_STYLE, BUTTON_STYLE, DESCRIPTION_STYLE,
} from "../shared";
import { AddIcon, TrashIcon } from "../../Icons";

export type PromptScope = "global" | "project";

interface PromptScopeSectionProps {
  scope: PromptScope;
  title: string;
  prompts: PromptTemplate[];
  loading?: boolean;
  projectInfo?: { name: string; path: string } | null;
  onAdd: () => void;
  onEdit: (prompt: PromptTemplate) => void;
  onDelete: (prompt: PromptTemplate) => void;
  onUse?: (prompt: PromptTemplate) => void;
}

const LIST_STYLE: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "6px",
};

const ITEM_STYLE: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "8px 12px",
  background: "var(--bg, #1e1e1e)",
  border: "1px solid var(--border, #444)",
  borderRadius: "4px",
  cursor: "pointer",
};

const ITEM_NAME_STYLE: CSSProperties = {
  fontSize: "13px",
  fontWeight: 500,
  color: "var(--text, #eee)",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  flex: 1,
};

const ITEM_PREVIEW_STYLE: CSSProperties = {
  fontSize: "11px",
  color: "var(--text-muted, #888)",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  marginTop: "2px",
};

const ACTIONS_STYLE: CSSProperties = {
  display: "flex",
  gap: "4px",
  flex: "none",
};

export default function PromptScopeSection({
  scope,
  title,
  prompts,
  loading,
  projectInfo,
  onAdd,
  onEdit,
  onDelete,
  onUse,
}: PromptScopeSectionProps) {
  return (
    <div style={CARD_STYLE}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
        <h4 style={{ ...SECTION_TITLE_STYLE, margin: 0, borderBottom: "none", paddingBottom: 0 }}>
          {title}
          <span style={{ marginLeft: "8px", fontSize: "11px", color: "var(--text-muted, #888)" }}>
            ({prompts.length})
          </span>
        </h4>
        <button style={{ ...BUTTON_STYLE, display: "inline-flex", alignItems: "center", gap: "4px" }} onClick={onAdd}>
          <AddIcon size={14} />
          新建
        </button>
      </div>

      {scope === "project" && projectInfo && (
        <div style={DESCRIPTION_STYLE}>
          项目：{projectInfo.name} ({projectInfo.path})
        </div>
      )}

      {loading ? (
        <div style={{ ...DESCRIPTION_STYLE, textAlign: "center", padding: "20px" }}>加载中...</div>
      ) : prompts.length === 0 ? (
        <div style={{ ...DESCRIPTION_STYLE, textAlign: "center", padding: "20px" }}>
          {scope === "global" ? "暂无全局 Prompt 模板" : "暂无项目级 Prompt 模板"}
        </div>
      ) : (
        <div style={LIST_STYLE}>
          {prompts.map(prompt => (
            <div
              key={prompt.id}
              style={ITEM_STYLE}
              onClick={() => onEdit(prompt)}
            >
              <div style={{ flex: 1, overflow: "hidden" }}>
                <div style={ITEM_NAME_STYLE}>{prompt.name}</div>
                <div style={ITEM_PREVIEW_STYLE}>{prompt.content.slice(0, 80) || "(空内容)"}</div>
              </div>
              <div style={ACTIONS_STYLE} onClick={e => e.stopPropagation()}>
                {onUse && (
                  <button
                    style={{ ...BUTTON_STYLE, padding: "2px 8px", fontSize: "11px" }}
                    onClick={() => onUse(prompt)}
                    title="使用此模板"
                  >
                    使用
                  </button>
                )}
                <button
                  style={{ ...BUTTON_STYLE, padding: "2px 6px", display: "flex", alignItems: "center" }}
                  onClick={() => onDelete(prompt)}
                  title="删除"
                >
                  <TrashIcon size={12} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
