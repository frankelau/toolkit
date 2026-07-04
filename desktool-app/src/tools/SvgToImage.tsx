import { useRef, useState } from "react";
import type { ToolProps } from "./types";
import { usePersistentState } from "../storage";
import DropZone from "../components/DropZone";
import "./SvgToImage.css";

type Format = "png" | "jpeg" | "webp";

/**
 * F15 SVG 转图片
 * SVG 通过文件/URL/粘贴代码输入，输出 PNG/JPG/WEBP，可自定义尺寸。
 */
export default function SvgToImage({ instanceId }: ToolProps) {
  const ns = `svg2img:${instanceId}`;
  const [svgCode, setSvgCode] = usePersistentState(`${ns}:svg`, "");
  const [format, setFormat] = usePersistentState<Format>(`${ns}:fmt`, "png");
  const [width, setWidth] = usePersistentState(`${ns}:w`, 128);
  const [height, setHeight] = usePersistentState(`${ns}:h`, 128);
  const [scale, setScale] = usePersistentState(`${ns}:scale`, 1);
  const [transparent, setTransparent] = usePersistentState(`${ns}:transparent`, false);
  const [outUrl, setOutUrl] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function onFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => setSvgCode(reader.result as string);
    reader.readAsText(file);
  }

  async function loadFromUrl() {
    const url = prompt("输入 SVG 文件 URL：");
    if (!url) return;
    try {
      const res = await fetch(url);
      setSvgCode(await res.text());
    } catch (e) {
      setError(`加载失败：${(e as Error).message}`);
    }
  }

  async function convert() {
    setError("");
    setOutUrl("");
    if (!svgCode.trim()) {
      setError("请输入 SVG 代码");
      return;
    }
    setBusy(true);
    try {
      const blob = new Blob([svgCode], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("SVG 解析失败"));
        img.src = url;
      });
      const canvas = document.createElement("canvas");
      canvas.width = width * scale;
      canvas.height = height * scale;
      const ctx = canvas.getContext("2d")!;
      if (format === "jpeg" || !transparent) {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      ctx.scale(scale, scale);
      ctx.drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(url);
      setOutUrl(canvas.toDataURL(`image/${format}`));
    } catch (e) {
      setError(`转换失败：${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  async function download() {
    if (!outUrl) return;
    const { saveDataUrlWithDialog } = await import("../saveFile");
    const ext = format === "jpeg" ? "jpg" : format;
    await saveDataUrlWithDialog(outUrl, `image.${ext}`, [
      { name: "图片", extensions: [ext] },
    ]);
  }

  async function exportSvg() {
    if (!svgCode.trim()) return;
    const { saveTextWithDialog } = await import("../saveFile");
    await saveTextWithDialog(svgCode, "image.svg", [{ name: "SVG", extensions: ["svg"] }]);
  }

  function reset() {
    setSvgCode("");
    setOutUrl("");
    setError("");
  }

  return (
    <div className="s2i-tool">
      <div className="s2i-body">
        <div className="s2i-col">
          <div className="s2i-col-head">SVG 源</div>
          <DropZone onText={(_, text) => setSvgCode(text)} accept=".svg,image/svg+xml">
            <textarea
              className="s2i-code"
              value={svgCode}
              onChange={(e) => setSvgCode(e.target.value)}
              placeholder="粘贴 SVG 代码，或用下方按钮上传 / 从 URL 加载"
              spellCheck={false}
            />
          </DropZone>
          <div className="s2i-src-actions">
            <button onClick={() => fileRef.current?.click()}>上传文件</button>
            <button onClick={loadFromUrl}>从 URL 加载</button>
            <button onClick={exportSvg} disabled={!svgCode.trim()}>导出 SVG</button>
            <input
              ref={fileRef}
              type="file"
              accept=".svg,image/svg+xml"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onFile(f);
              }}
            />
          </div>
        </div>

        <div className="s2i-opts">
          <label>
            输出格式
            <select
              value={format}
              onChange={(e) => setFormat(e.target.value as Format)}
            >
              <option value="png">PNG</option>
              <option value="jpeg">JPG</option>
              <option value="webp">WEBP</option>
            </select>
          </label>
          <label>
            宽度(px)
            <input
              type="number"
              value={width}
              onChange={(e) => setWidth(Number(e.target.value))}
            />
          </label>
          <label>
            高度(px)
            <input
              type="number"
              value={height}
              onChange={(e) => setHeight(Number(e.target.value))}
            />
          </label>
          <label>
            倍数
            <select value={scale} onChange={e => setScale(Number(e.target.value))}>
              {[1, 1.5, 2, 3].map(s => <option key={s} value={s}>{s}x</option>)}
            </select>
          </label>
          <label>
            <input
              type="checkbox"
              checked={transparent}
              disabled={format !== "png"}
              onChange={e => setTransparent(e.target.checked)}
            />
            透明背景（仅 PNG）
          </label>
          <button className="s2i-convert" onClick={convert} disabled={busy}>
            {busy ? "转换中…" : "转换 →"}
          </button>
          <button onClick={reset}>重置</button>
        </div>

        <div className="s2i-col">
          <div className="s2i-col-head">转换后图片</div>
          <div className="s2i-preview">
            {outUrl ? (
              <img src={outUrl} alt="结果" className="s2i-out-img" />
            ) : (
              <span className="s2i-empty">转换后的图片将显示在这里</span>
            )}
          </div>
          <button
            className="s2i-download"
            onClick={download}
            disabled={!outUrl}
          >
            下载图片
          </button>
        </div>
      </div>

      {error && <div className="s2i-error">{error}</div>}
    </div>
  );
}
