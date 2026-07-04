import { useRef, useState } from "react";
import { usePersistentState } from "../storage";
import { copyText, toast } from "../useCopyFeedback";
import type { ToolProps } from "./types";
import "./ImageBase64.css";

type Mode = "toBase64" | "toImage";

function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function dataUrlSize(dataUrl: string): number {
  const b64 = dataUrl.split(",")[1] ?? "";
  return Math.floor((b64.length * 3) / 4);
}

export default function ImageBase64({ instanceId }: ToolProps) {
  const ns = `img2b64:${instanceId}`;
  const [mode, setMode] = usePersistentState<Mode>(`${ns}:mode`, "toBase64");
  const [dataUrl, setDataUrl] = usePersistentState(`${ns}:dataUrl`, "");
  const [origSize, setOrigSize] = useState(0);
  const [urlInput, setUrlInput] = useState("");
  const [quality, setQuality] = usePersistentState(`${ns}:quality`, 0.8);
  const [imgInfo, setImgInfo] = useState<{ w: number; h: number; mime: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [b64Input, setB64Input] = useState("");

  function loadFile(file: File) {
    setOrigSize(file.size);
    const objUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      setImgInfo({ w: img.naturalWidth, h: img.naturalHeight, mime: file.type });
      URL.revokeObjectURL(objUrl);
    };
    img.src = objUrl;
    const reader = new FileReader();
    reader.onload = () => setDataUrl(reader.result as string);
    reader.readAsDataURL(file);
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("image/")) loadFile(file);
  }

  function onPaste(e: React.ClipboardEvent) {
    const item = Array.from(e.clipboardData.items).find((i) => i.type.startsWith("image/"));
    if (item) {
      const file = item.getAsFile();
      if (file) {
        setOrigSize(file.size);
        const mime = item.type;
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          setDataUrl(result);
          const img = new Image();
          img.onload = () => setImgInfo({ w: img.naturalWidth, h: img.naturalHeight, mime });
          img.src = result;
        };
        reader.readAsDataURL(file);
      }
    }
  }

  async function fetchFromUrl() {
    if (!urlInput.trim()) return;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
      canvas.getContext("2d")!.drawImage(img, 0, 0);
      try {
        const url = canvas.toDataURL("image/png");
        setDataUrl(url);
        setImgInfo({ w: img.naturalWidth, h: img.naturalHeight, mime: "image/png" });
      } catch {
        toast("图片跨域限制，无法转换", "error");
      }
    };
    img.onerror = () => toast("URL 加载失败", "error");
    img.src = urlInput.trim();
  }

  function copyCompressed() {
    if (!dataUrl) return;
    const img = new Image();
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = img.naturalWidth; c.height = img.naturalHeight;
      const ctx = c.getContext("2d")!;
      ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height);
      ctx.drawImage(img, 0, 0);
      copyText(c.toDataURL("image/jpeg", quality));
    };
    img.src = dataUrl;
  }

  const imgSrc = b64Input.trim().startsWith("data:")
    ? b64Input.trim()
    : b64Input.trim()
      ? `data:image/png;base64,${b64Input.trim().replace(/\s/g, "")}`
      : "";

  async function downloadImage() {
    if (!imgSrc) return;
    const { saveDataUrlWithDialog } = await import("../saveFile");
    await saveDataUrlWithDialog(imgSrc, "image.png", [{ name: "图片", extensions: ["png", "jpg", "jpeg", "webp"] }]);
  }

  return (
    <div className="ib-tool">
      <div className="ib-modes">
        <button className={mode === "toBase64" ? "on" : ""} onClick={() => setMode("toBase64")}>图片转 Base64</button>
        <button className={mode === "toImage" ? "on" : ""} onClick={() => setMode("toImage")}>Base64 转图片</button>
      </div>

      {mode === "toBase64" ? (
        <div className="ib-body">
          <div className="ib-col">
            <div className="ib-url-row">
              <input value={urlInput} onChange={e => setUrlInput(e.target.value)}
                placeholder="粘贴图片 URL（http/https）" onKeyDown={e => e.key === "Enter" && fetchFromUrl()} />
              <button onClick={fetchFromUrl} disabled={!urlInput.trim()}>加载</button>
            </div>
            <div className="ib-drop" onDrop={onDrop} onDragOver={(e) => e.preventDefault()} onPaste={onPaste} tabIndex={0}>
              {dataUrl ? (
                <img src={dataUrl} alt="预览" className="ib-preview-img" />
              ) : (
                <div className="ib-drop-hint">
                  <button onClick={() => fileRef.current?.click()}>选择图片</button>
                  <p>或拖拽 / 截图后在此粘贴</p>
                </div>
              )}
              <input ref={fileRef} type="file" accept="image/*" hidden
                onChange={(e) => { const f = e.target.files?.[0]; if (f) loadFile(f); }} />
            </div>
            {dataUrl && (
              <>
                <div className="ib-meta">
                  <span>原始图片大小：{origSize ? humanSize(origSize) : "—"}</span>
                  <span>DataUri 大小：{humanSize(dataUrl.length)}</span>
                  {imgInfo && <span>{imgInfo.w} × {imgInfo.h}px · {imgInfo.mime}</span>}
                  <button onClick={() => { setDataUrl(""); setImgInfo(null); }}>清空</button>
                </div>
                <div className="ib-quality-row">
                  <label>压缩质量</label>
                  <input type="range" min={0.1} max={1} step={0.1} value={quality}
                    onChange={e => setQuality(Number(e.target.value))} />
                  <span>{Math.round(quality * 100)}%</span>
                  <button onClick={copyCompressed} disabled={!dataUrl}>复制 JPEG</button>
                </div>
              </>
            )}
          </div>
          <div className="ib-col">
            <div className="ib-result-head">
              <span>转换结果</span>
              <button onClick={() => copyText(dataUrl)} disabled={!dataUrl}>复制</button>
              <button onClick={() => copyText(`<img src="${dataUrl}" alt="" />`)} disabled={!dataUrl}>复制 &lt;img&gt;</button>
              <button onClick={() => copyText(`url("${dataUrl}")`)} disabled={!dataUrl}>复制 CSS</button>
              <button onClick={() => copyText(`![](${dataUrl})`)} disabled={!dataUrl}>复制 MD</button>
            </div>
            <textarea className="ib-result" value={dataUrl} readOnly placeholder="内容会自动生成..." spellCheck={false} />
          </div>
        </div>
      ) : (
        <div className="ib-body">
          <div className="ib-col">
            <textarea className="ib-result" value={b64Input} onChange={(e) => setB64Input(e.target.value)}
              placeholder="粘贴 Base64 或 DataURI" spellCheck={false} />
            <div className="ib-meta">
              <span>数据大小：{imgSrc ? humanSize(dataUrlSize(imgSrc)) : "—"}</span>
              <button onClick={downloadImage} disabled={!imgSrc}>下载图片</button>
              <button onClick={() => setB64Input("")}>清空</button>
            </div>
          </div>
          <div className="ib-col">
            <div className="ib-drop ib-preview">
              {imgSrc ? (
                <img src={imgSrc} alt="预览" className="ib-preview-img" />
              ) : (
                <div className="ib-drop-hint"><p>图片预览</p></div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
