/**
 * 滚动截图帧拼接：相邻帧之间通过「底部行像素 → 在下一帧中向下搜索匹配」找到重叠高度，
 * 只把非重叠部分追加到长图，从而消除滚动时的重复区域。
 * 输入为同宽的图片 data URL 数组，输出拼好的长图 data URL（PNG）。
 */

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("图片加载失败"));
    img.src = src;
  });
}

/** 计算从 prev 底部到 cur 顶部的重叠像素行数（cur 中与 prev 底部重合的高度）。 */
export function findOverlap(
  prevData: Uint8ClampedArray,
  curData: Uint8ClampedArray,
  width: number,
  prevH: number,
  curH: number,
): number {
  // 取 prev 最底部一条参考带（最多 40 行），在 cur 中自下而上找它再次出现的位置
  const band = Math.min(40, prevH, curH);
  if (band <= 0) return 0;

  const rowBytes = width * 4;
  // prev 的参考带起始行
  const refStart = prevH - band;

  let bestOffset = 0;
  let bestScore = Infinity;
  // 在 cur 中，参考带可能出现在 [0, curH - band] 任意行；偏移越小代表重叠越多
  const maxShift = curH - band;
  for (let shift = 0; shift <= maxShift; shift++) {
    let diff = 0;
    // 采样：每隔几行、每隔几列比，控制成本
    const rowStep = Math.max(1, Math.floor(band / 12));
    const colStep = Math.max(1, Math.floor(width / 64));
    let samples = 0;
    for (let r = 0; r < band; r += rowStep) {
      const pRow = (refStart + r) * rowBytes;
      const cRow = (shift + r) * rowBytes;
      for (let c = 0; c < width; c += colStep) {
        const pi = pRow + c * 4;
        const ci = cRow + c * 4;
        diff +=
          Math.abs(prevData[pi] - curData[ci]) +
          Math.abs(prevData[pi + 1] - curData[ci + 1]) +
          Math.abs(prevData[pi + 2] - curData[ci + 2]);
        samples++;
      }
      // 提前剪枝
      if (diff / Math.max(1, samples) > bestScore) break;
    }
    const score = diff / Math.max(1, samples);
    if (score < bestScore) {
      bestScore = score;
      bestOffset = shift;
    }
  }

  // bestOffset 是参考带在 cur 中的起始行；重叠高度 = bestOffset + band
  // 若匹配度太差（基本没滚动或内容突变），认为无重叠
  if (bestScore > 24) return 0;
  return bestOffset + band;
}

export async function stitchFrames(frames: string[]): Promise<string> {
  if (frames.length === 0) throw new Error("没有帧可拼接");
  const imgs = await Promise.all(frames.map(loadImage));
  const width = imgs[0].naturalWidth;

  // 把每帧画到临时 canvas 取像素
  const tmp = document.createElement("canvas");
  tmp.width = width;
  const tctx = tmp.getContext("2d", { willReadFrequently: true })!;

  function frameData(img: HTMLImageElement): { data: Uint8ClampedArray; h: number } {
    const h = img.naturalHeight;
    tmp.height = h;
    tctx.clearRect(0, 0, width, h);
    tctx.drawImage(img, 0, 0);
    return { data: tctx.getImageData(0, 0, width, h).data, h };
  }

  // 逐帧计算需要追加的高度
  const segments: { img: HTMLImageElement; srcY: number; h: number }[] = [];
  segments.push({ img: imgs[0], srcY: 0, h: imgs[0].naturalHeight });
  let prev = frameData(imgs[0]);

  for (let i = 1; i < imgs.length; i++) {
    const cur = frameData(imgs[i]);
    if (cur.data.length !== prev.data.length && imgs[i].naturalWidth !== width) {
      // 宽度不一致，跳过该帧
      continue;
    }
    const overlap = findOverlap(prev.data, cur.data, width, prev.h, cur.h);
    const newH = cur.h - overlap;
    if (newH > 2) {
      segments.push({ img: imgs[i], srcY: overlap, h: newH });
    }
    prev = cur;
  }

  const totalH = segments.reduce((s, seg) => s + seg.h, 0);
  const out = document.createElement("canvas");
  out.width = width;
  out.height = totalH;
  const octx = out.getContext("2d")!;
  let y = 0;
  for (const seg of segments) {
    octx.drawImage(seg.img, 0, seg.srcY, width, seg.h, 0, y, width, seg.h);
    y += seg.h;
  }
  return out.toDataURL("image/png");
}
