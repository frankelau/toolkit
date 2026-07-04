import { describe, it, expect } from "vitest";
import { findOverlap } from "./stitchFrames";

// 构造一个宽 width、高 h 的灰度图像素数组，每行像素值 = (起始行号 + 行内偏移) 取模
function makeFrame(width: number, h: number, startRow: number): Uint8ClampedArray {
  const data = new Uint8ClampedArray(width * h * 4);
  for (let r = 0; r < h; r++) {
    const v = (startRow + r) % 256;
    for (let c = 0; c < width; c++) {
      const i = (r * width + c) * 4;
      data[i] = v;
      data[i + 1] = v;
      data[i + 2] = v;
      data[i + 3] = 255;
    }
  }
  return data;
}

describe("findOverlap", () => {
  it("检测出向下滚动 N 行后的重叠高度", () => {
    const width = 80;
    const h = 100;
    // prev 从第 0 行开始；cur 是向下滚动 30 行后的内容（从第 30 行开始）
    const prev = makeFrame(width, h, 0);
    const cur = makeFrame(width, h, 30);
    const overlap = findOverlap(prev, cur, width, h, h);
    // prev 底部 band 行（最后 40 行 = 第 60..99 行）应在 cur 中第 30..69 行出现
    // 重叠高度 = h - 滚动行数 = 100 - 30 = 70
    expect(overlap).toBeGreaterThanOrEqual(68);
    expect(overlap).toBeLessThanOrEqual(72);
  });

  it("完全相同的帧重叠为满高（未滚动）", () => {
    const width = 80;
    const h = 100;
    const prev = makeFrame(width, h, 0);
    const cur = makeFrame(width, h, 0);
    const overlap = findOverlap(prev, cur, width, h, h);
    expect(overlap).toBe(h);
  });
});
