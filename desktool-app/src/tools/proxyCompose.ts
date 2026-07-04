/** Compose（编辑重发）：从 HTTP 代理把流量数据传到简易 Postman */

export const COMPOSE_EVENT = "compose-to-postman";

export interface ComposeData {
  method: string;
  url: string;
  headers: [string, string][];
  body: string;
}

export function dispatchCompose(data: ComposeData) {
  window.dispatchEvent(new CustomEvent(COMPOSE_EVENT, { detail: data }));
}

export function listenCompose(handler: (data: ComposeData) => void): () => void {
  function listener(e: Event) {
    const ce = e as CustomEvent<ComposeData>;
    handler(ce.detail);
  }
  window.addEventListener(COMPOSE_EVENT, listener);
  return () => window.removeEventListener(COMPOSE_EVENT, listener);
}
