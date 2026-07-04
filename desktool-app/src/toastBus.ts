export type ToastType = "success" | "error" | "info";

export interface ToastPayload {
  id: number;
  message: string;
  type: ToastType;
}

const EVT = "desktool:toast";
let seq = 0;

/** 派发一条 toast */
export function emitToast(message: string, type: ToastType = "success"): void {
  seq += 1;
  const detail: ToastPayload = { id: seq, message, type };
  window.dispatchEvent(new CustomEvent<ToastPayload>(EVT, { detail }));
}

/** 订阅 toast，返回取消订阅函数 */
export function onToast(cb: (t: ToastPayload) => void): () => void {
  const handler = (e: Event) => cb((e as CustomEvent<ToastPayload>).detail);
  window.addEventListener(EVT, handler);
  return () => window.removeEventListener(EVT, handler);
}
