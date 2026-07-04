import { expect, test, vi } from "vitest";

test("emitToast notifies subscribers with incrementing id", async () => {
  vi.stubGlobal("window", new EventTarget());
  const { emitToast, onToast } = await import("./toastBus");
  const got: { message: string; type: string }[] = [];
  const off = onToast((t) => got.push({ message: t.message, type: t.type }));
  emitToast("已复制");
  emitToast("出错了", "error");
  off();
  emitToast("不该收到");
  expect(got).toEqual([
    { message: "已复制", type: "success" },
    { message: "出错了", type: "error" },
  ]);
});
