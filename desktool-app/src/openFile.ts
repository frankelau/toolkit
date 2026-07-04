import { open } from "@tauri-apps/plugin-dialog";
import { readTextFile, readFile } from "@tauri-apps/plugin-fs";

export interface FileResult {
  name: string;
  text?: string;
  bytes?: Uint8Array;
}

type Filters = { name: string; extensions: string[] }[];

/** 弹系统对话框打开文本文件（Tauri 优先，失败回退浏览器）；取消返回 null */
export async function openTextFile(filters?: Filters): Promise<FileResult | null> {
  try {
    const path = await open({ filters, multiple: false });
    if (!path || typeof path !== "string") return null;
    const text = await readTextFile(path);
    const name = path.split("/").pop() ?? "file.txt";
    return { name, text };
  } catch {
    // Tauri 失败，回退浏览器 input
    return browserOpenText(filters);
  }
}

/** 弹系统对话框打开二进制文件；取消返回 null */
export async function openBinaryFile(filters?: Filters): Promise<FileResult | null> {
  try {
    const path = await open({ filters, multiple: false });
    if (!path || typeof path !== "string") return null;
    const bytes = await readFile(path);
    const name = path.split("/").pop() ?? "file.bin";
    return { name, bytes };
  } catch {
    return browserOpenBinary(filters);
  }
}

/** 浏览器回退实现（input file picker + FileReader） */
function browserOpenText(filters?: Filters): Promise<FileResult | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    if (filters?.length) {
      input.accept = filters.flatMap((f) => f.extensions.map((e) => `.${e}`)).join(",");
    }
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return resolve(null);
      const reader = new FileReader();
      reader.onload = () => resolve({ name: file.name, text: reader.result as string });
      reader.onerror = () => resolve(null);
      reader.readAsText(file);
    };
    input.click();
  });
}

function browserOpenBinary(filters?: Filters): Promise<FileResult | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    if (filters?.length) {
      input.accept = filters.flatMap((f) => f.extensions.map((e) => `.${e}`)).join(",");
    }
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return resolve(null);
      const reader = new FileReader();
      reader.onload = () => resolve({ name: file.name, bytes: new Uint8Array(reader.result as ArrayBuffer) });
      reader.onerror = () => resolve(null);
      reader.readAsArrayBuffer(file);
    };
    input.click();
  });
}
