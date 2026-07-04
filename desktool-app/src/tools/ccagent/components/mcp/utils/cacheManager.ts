// mcp/utils/cacheManager.ts — B6-3: MCP工具缓存管理
// 对齐 cc-gui cacheManager.ts (240行): LRU缓存 + 过期管理

type CacheProvider = "claude" | "codex";

interface CacheKeys {
  toolsKey: string;
  serversKey: string;
  logsKey: string;
}

/** 缓存过期时间 (毫秒) */
export const CACHE_EXPIRY: Record<string, number> = {
  tools: 5 * 60 * 1000, // 5分钟
  servers: 30 * 60 * 1000, // 30分钟
  logs: 10 * 60 * 1000, // 10分钟
};

/** 获取 Provider 对应的缓存键 */
export function getCacheKeys(provider: CacheProvider): CacheKeys {
  const prefix = `mcp_cache_${provider}`;
  return {
    toolsKey: `${prefix}_tools`,
    serversKey: `${prefix}_servers`,
    logsKey: `${prefix}_logs`,
  };
}

/** 获取缓存过期时间 */
export function getCacheExpiry(key: string, cacheKeys: CacheKeys): number {
  if (key === cacheKeys.toolsKey) return CACHE_EXPIRY.tools;
  if (key === cacheKeys.serversKey) return CACHE_EXPIRY.servers;
  if (key === cacheKeys.logsKey) return CACHE_EXPIRY.logs;
  return CACHE_EXPIRY.tools;
}

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

/** 从缓存读取 */
export function readCache<T>(key: string, cacheKeys: CacheKeys): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;

    const entry: CacheEntry<T> = JSON.parse(raw);
    const expiry = getCacheExpiry(key, cacheKeys);
    const age = Date.now() - entry.timestamp;

    if (age > expiry) {
      localStorage.removeItem(key);
      return null;
    }

    return entry.data;
  } catch {
    return null;
  }
}

/** 写入缓存 */
export function writeCache<T>(key: string, data: T): void {
  try {
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
    };
    localStorage.setItem(key, JSON.stringify(entry));
  } catch {
    // 缓存写入失败不影响功能
  }
}

/** 清除指定 Provider 的所有缓存 */
export function clearProviderCache(provider: CacheProvider): void {
  const keys = getCacheKeys(provider);
  localStorage.removeItem(keys.toolsKey);
  localStorage.removeItem(keys.serversKey);
  localStorage.removeItem(keys.logsKey);
}

/** 清除所有 MCP 缓存 */
export function clearAllMcpCache(): void {
  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith("mcp_cache_")) {
      keysToRemove.push(key);
    }
  }
  keysToRemove.forEach((k) => localStorage.removeItem(k));
}

/** LRU 缓存实现 (内存级) */
export class LRUCache<K, V> {
  private capacity: number;
  private map = new Map<K, V>();

  constructor(capacity: number = 100) {
    this.capacity = capacity;
  }

  get(key: K): V | undefined {
    if (!this.map.has(key)) return undefined;
    const value = this.map.get(key)!;
    // 移到末尾 (最近使用)
    this.map.delete(key);
    this.map.set(key, value);
    return value;
  }

  set(key: K, value: V): void {
    if (this.map.has(key)) {
      this.map.delete(key);
    } else if (this.map.size >= this.capacity) {
      // 删除最旧的项
      const firstKey = this.map.keys().next().value;
      if (firstKey !== undefined) {
        this.map.delete(firstKey);
      }
    }
    this.map.set(key, value);
  }

  has(key: K): boolean {
    return this.map.has(key);
  }

  clear(): void {
    this.map.clear();
  }

  get size(): number {
    return this.map.size;
  }
}
