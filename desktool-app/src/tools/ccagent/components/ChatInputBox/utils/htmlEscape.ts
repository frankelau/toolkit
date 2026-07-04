// htmlEscape.ts — HTML 转义工具
// 对齐 cc-gui ChatInputBox/utils/htmlEscape.ts

/**
 * 转义 HTML 属性值中的特殊字符（引号、尖括号、&）。
 * 反斜杠在 HTML 属性中合法，无需转义。
 */
export function escapeHtmlAttr(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
