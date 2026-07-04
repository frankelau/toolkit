// lruCache.test.ts
// Aligns with cc-gui LRUCache tests

import { describe, it, expect } from "vitest";
import { LRUCache } from "./lruCache";

describe("LRUCache", () => {
  it("stores and retrieves values", () => {
    const cache = new LRUCache<string, number>(10);
    cache.set("a", 1);
    cache.set("b", 2);
    expect(cache.get("a")).toBe(1);
    expect(cache.get("b")).toBe(2);
  });

  it("returns undefined for missing keys", () => {
    const cache = new LRUCache<string, number>(10);
    expect(cache.get("missing")).toBeUndefined();
  });

  it("evicts least recently used item when capacity exceeded", () => {
    const cache = new LRUCache<string, string>(3);
    cache.set("a", "1");
    cache.set("b", "2");
    cache.set("c", "3");
    // a is oldest
    cache.set("d", "4");
    // a should be evicted
    expect(cache.get("a")).toBeUndefined();
    expect(cache.get("b")).toBe("2");
    expect(cache.get("c")).toBe("3");
    expect(cache.get("d")).toBe("4");
  });

  it("get promotes to most recently used", () => {
    const cache = new LRUCache<string, string>(3);
    cache.set("a", "1");
    cache.set("b", "2");
    cache.set("c", "3");
    // Access a → a becomes most recent
    cache.get("a");
    cache.set("d", "4");
    // b should be evicted (oldest after a was promoted)
    expect(cache.get("a")).toBe("1");
    expect(cache.get("b")).toBeUndefined();
    expect(cache.get("c")).toBe("3");
    expect(cache.get("d")).toBe("4");
  });

  it("updating existing key does not evict", () => {
    const cache = new LRUCache<string, string>(3);
    cache.set("a", "1");
    cache.set("b", "2");
    cache.set("a", "updated"); // update, not new
    cache.set("c", "3");
    expect(cache.size).toBe(3);
    expect(cache.get("a")).toBe("updated");
  });

  it("has returns true for existing keys", () => {
    const cache = new LRUCache<string, string>(10);
    cache.set("key", "value");
    expect(cache.has("key")).toBe(true);
    expect(cache.has("missing")).toBe(false);
  });

  it("delete removes key and returns true", () => {
    const cache = new LRUCache<string, string>(10);
    cache.set("key", "value");
    expect(cache.delete("key")).toBe(true);
    expect(cache.has("key")).toBe(false);
    expect(cache.delete("key")).toBe(false);
  });

  it("clear empties the cache", () => {
    const cache = new LRUCache<string, string>(10);
    cache.set("a", "1");
    cache.set("b", "2");
    cache.clear();
    expect(cache.size).toBe(0);
    expect(cache.get("a")).toBeUndefined();
  });

  it("default capacity is 100", () => {
    const cache = new LRUCache<string, number>();
    for (let i = 0; i < 100; i++) {
      cache.set(`key${i}`, i);
    }
    expect(cache.size).toBe(100);
    // 101st evicts oldest (key0)
    cache.set("overflow", 999);
    expect(cache.size).toBe(100);
    expect(cache.get("key0")).toBeUndefined();
    expect(cache.get("overflow")).toBe(999);
  });

  it("handles single capacity", () => {
    const cache = new LRUCache<string, string>(1);
    cache.set("a", "1");
    expect(cache.get("a")).toBe("1");
    cache.set("b", "2");
    expect(cache.get("a")).toBeUndefined();
    expect(cache.get("b")).toBe("2");
  });

  it("size returns correct value", () => {
    const cache = new LRUCache<string, number>(10);
    expect(cache.size).toBe(0);
    cache.set("a", 1);
    expect(cache.size).toBe(1);
    cache.set("b", 2);
    expect(cache.size).toBe(2);
    cache.delete("a");
    expect(cache.size).toBe(1);
  });
});
