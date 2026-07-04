// settings/shared/index.ts — 设置共享工具与样式常量
// 对齐 cc-gui 的 settings/shared/ 模块

import type { CSSProperties } from "react";

/** 通用区块标题样式 */
export const SECTION_TITLE_STYLE: CSSProperties = {
  fontSize: "14px",
  fontWeight: 600,
  margin: "0 0 12px",
  paddingBottom: "8px",
  borderBottom: "1px solid var(--border, #444)",
};

/** 表单行样式 */
export const FORM_ROW_STYLE: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "12px",
  marginBottom: "12px",
};

/** 表单标签样式 */
export const LABEL_STYLE: CSSProperties = {
  minWidth: "120px",
  fontSize: "12px",
  color: "var(--text-muted, #888)",
};

/** 表单值容器样式 */
export const VALUE_CONTAINER_STYLE: CSSProperties = {
  flex: 1,
};

/** 开关行样式（label + toggle） */
export const TOGGLE_ROW_STYLE: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "8px 0",
  borderBottom: "1px solid var(--border, #333)",
};

/** 卡片容器样式 */
export const CARD_STYLE: CSSProperties = {
  background: "var(--bg, #1e1e1e)",
  border: "1px solid var(--border, #444)",
  borderRadius: "6px",
  padding: "14px",
  marginBottom: "12px",
};

/** 描述文本样式 */
export const DESCRIPTION_STYLE: CSSProperties = {
  fontSize: "11px",
  color: "var(--text-muted, #666)",
  marginTop: "4px",
  lineHeight: 1.5,
};

/** 子 tab 导航样式 */
export const SUB_TAB_NAV_STYLE: CSSProperties = {
  display: "flex",
  gap: "2px",
  borderBottom: "1px solid var(--border, #444)",
  marginBottom: "16px",
};

/** 子 tab 按钮样式 */
export function getSubTabButtonStyle(isActive: boolean): CSSProperties {
  return {
    padding: "6px 14px",
    background: "none",
    border: "none",
    borderBottom: isActive ? "2px solid var(--accent, #6cb6ff)" : "2px solid transparent",
    color: isActive ? "var(--accent, #6cb6ff)" : "var(--text-muted, #888)",
    cursor: "pointer",
    fontSize: "12px",
    fontWeight: isActive ? 600 : 400,
  };
}

/** Provider 卡片样式 */
export function getProviderCardStyle(isActive: boolean): CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "10px 14px",
    background: isActive ? "var(--accent-soft, rgba(100,150,255,0.08))" : "var(--bg, #1e1e1e)",
    border: `1px solid ${isActive ? "var(--accent, #6cb6ff)" : "var(--border, #444)"}`,
    borderRadius: "6px",
    marginBottom: "8px",
    cursor: "pointer",
    transition: "border-color 0.15s ease",
  };
}

/** 通用输入框样式 */
export const INPUT_STYLE: CSSProperties = {
  flex: 1,
  padding: "5px 10px",
  background: "var(--bg, #1e1e1e)",
  border: "1px solid var(--border, #555)",
  borderRadius: "4px",
  color: "var(--text, #eee)",
  fontSize: "12px",
  outline: "none",
};

/** 通用选择框样式 */
export const SELECT_STYLE: CSSProperties = {
  ...INPUT_STYLE,
  cursor: "pointer",
};

/** 通用按钮样式 */
export const BUTTON_STYLE: CSSProperties = {
  padding: "5px 14px",
  background: "var(--bg, #333)",
  border: "1px solid var(--border, #555)",
  borderRadius: "4px",
  color: "var(--text, #eee)",
  cursor: "pointer",
  fontSize: "12px",
};

/** 主按钮样式 */
export const PRIMARY_BUTTON_STYLE: CSSProperties = {
  ...BUTTON_STYLE,
  background: "var(--accent, #6cb6ff)",
  color: "#fff",
  borderColor: "var(--accent, #6cb6ff)",
};

/** 格式化字节大小 */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** 格式化时间戳为可读日期 */
export function formatTimestamp(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
