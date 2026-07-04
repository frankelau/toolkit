import { emitToast } from "./toastBus";

/** 复制文本到剪贴板，自动 toast 成功/失败 */
export async function copyText(text: string, okMsg = "已复制"): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    emitToast(okMsg, "success");
  } catch {
    emitToast("复制失败", "error");
  }
}

/** 非复制场景的通用提示（如导出成功） */
export { emitToast as toast } from "./toastBus";
