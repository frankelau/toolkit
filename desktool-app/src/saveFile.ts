import { save } from "@tauri-apps/plugin-dialog";
import { writeFile } from "@tauri-apps/plugin-fs";
import { emitToast } from "./toastBus";

/** 把 dataURL 解析为字节数组 */
function dataUrlToBytes(dataUrl: string): { bytes: Uint8Array; mime: string } {
  const [head, b64] = dataUrl.split(",");
  const mime = /data:(.*?);base64/.exec(head)?.[1] ?? "application/octet-stream";
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return { bytes, mime };
}

export interface SaveResult {
  saved: boolean;
  path?: string;
}

/**
 * 弹出系统保存对话框，把二进制内容写入用户选择的位置。
 * 返回最终保存路径（用于告知用户）。
 */
export async function saveBinaryWithDialog(
  bytes: Uint8Array,
  defaultName: string,
  filters?: { name: string; extensions: string[] }[],
): Promise<SaveResult> {
  const path = await save({ defaultPath: defaultName, filters });
  if (!path) return { saved: false };
  try {
    await writeFile(path, bytes);
  } catch (e) {
    emitToast("导出失败：" + (e instanceof Error ? e.message : String(e)), "error");
    return { saved: false };
  }
  return { saved: true, path };
}

/** 保存 dataURL（如 canvas.toDataURL 的图片）到用户选择位置 */
export async function saveDataUrlWithDialog(
  dataUrl: string,
  defaultName: string,
  filters?: { name: string; extensions: string[] }[],
): Promise<SaveResult> {
  const { bytes } = dataUrlToBytes(dataUrl);
  return saveBinaryWithDialog(bytes, defaultName, filters);
}

/** 保存文本到用户选择位置 */
export async function saveTextWithDialog(
  text: string,
  defaultName: string,
  filters?: { name: string; extensions: string[] }[],
): Promise<SaveResult> {
  const bytes = new TextEncoder().encode(text);
  return saveBinaryWithDialog(bytes, defaultName, filters);
}
