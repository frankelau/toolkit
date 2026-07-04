import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import jsQR from "jsqr";
import type { ToolProps } from "./types";
import { usePersistentState } from "../storage";
import { saveDataUrlWithDialog, saveTextWithDialog } from "../saveFile";
import { toast } from "../useCopyFeedback";
import "./QrTool.css";

const LEVELS = ["L", "M", "Q", "H"] as const;

export default function QrTool({ instanceId }: ToolProps) {
  const ns = `qr:${instanceId}`;
  const [mode, setMode] = usePersistentState<"gen" | "dec">(`${ns}:mode`, "gen");
  const [text, setText] = usePersistentState(`${ns}:text`, "https://tauri.app");
  const [size, setSize] = usePersistentState(`${ns}:size`, 256);
  const [fg, setFg] = usePersistentState(`${ns}:fg`, "#000000");
  const [bg, setBg] = usePersistentState(`${ns}:bg`, "#ffffff");
  const [level, setLevel] = usePersistentState<(typeof LEVELS)[number]>(`${ns}:level`, "M");
  const [logo, setLogo] = usePersistentState(`${ns}:logo`, "");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const logoFileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");

  const [decodeImg, setDecodeImg] = useState("");
  const [decodeResult, setDecodeResult] = useState<string | null>(null);
  const [decodeErr, setDecodeErr] = useState("");
  const decodeCanvasRef = useRef<HTMLCanvasElement>(null);
  const decodeFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (!text) {
      canvas.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
      setError("");
      return;
    }
    QRCode.toCanvas(canvas, text, {
      width: size, margin: 2,
      errorCorrectionLevel: logo ? "H" : level,
      color: { dark: fg, light: bg },
    }, (err) => {
      setError(err ? err.message : "");
      if (!err && logo) {
        const logoImg = new Image();
        logoImg.onload = () => {
          const ctx = canvas.getContext("2d")!;
          const s = size * 0.2;
          ctx.drawImage(logoImg, (size - s) / 2, (size - s) / 2, s, s);
        };
        logoImg.src = logo;
      }
    });
  }, [text, size, fg, bg, level, logo]);

  async function download() {
    const canvas = canvasRef.current;
    if (!canvas || !text) return;
    const res = await saveDataUrlWithDialog(canvas.toDataURL("image/png"), "qrcode.png", [{ name: "PNG 图片", extensions: ["png"] }]);
    if (res.saved) toast("已保存到 " + res.path, "success");
  }

  async function exportSvg() {
    if (!text) return;
    const svgStr = await QRCode.toString(text, {
      type: "svg", width: size, margin: 2,
      errorCorrectionLevel: logo ? "H" : level,
      color: { dark: fg, light: bg },
    });
    await saveTextWithDialog(svgStr, "qrcode.svg", [{ name: "SVG", extensions: ["svg"] }]);
  }

  function decodeImage(src: string) {
    setDecodeResult(null); setDecodeErr("");
    const img = new Image();
    img.onload = () => {
      const canvas = decodeCanvasRef.current!;
      canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const result = jsQR(imageData.data, imageData.width, imageData.height);
      if (result) setDecodeResult(result.data);
      else setDecodeErr("未检测到二维码");
    };
    img.src = src;
  }

  function loadDecodeFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => { const src = reader.result as string; setDecodeImg(src); decodeImage(src); };
    reader.readAsDataURL(file);
  }

  function onDecodeFilePick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (f) loadDecodeFile(f);
  }

  function onDecodeDrop(e: React.DragEvent) {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f?.type.startsWith("image/")) loadDecodeFile(f);
  }

  function onDecodePaste(e: React.ClipboardEvent) {
    const item = Array.from(e.clipboardData.items).find(i => i.type.startsWith("image/"));
    if (item) { const f = item.getAsFile(); if (f) loadDecodeFile(f); }
  }

  function copyText(t: string) {
    navigator.clipboard.writeText(t).then(() => toast("已复制", "success"));
  }

  return (
    <div className="qr-tool">
      <div className="qr-left">
        <div className="qr-tabs">
          <button className={mode === "gen" ? "on" : ""} onClick={() => setMode("gen")}>生成</button>
          <button className={mode === "dec" ? "on" : ""} onClick={() => setMode("dec")}>解码</button>
        </div>

        {mode === "gen" ? (
          <>
            <textarea className="qr-text" value={text} onChange={(e) => setText(e.target.value)}
              placeholder="输入文本或链接生成二维码" spellCheck={false} />
            <div className="qr-opts">
              <div className="qr-opt">
                <label>尺寸</label>
                <select value={size} onChange={(e) => setSize(Number(e.target.value))}>
                  {[128, 256, 384, 512].map((s) => (<option key={s} value={s}>{s}px</option>))}
                </select>
              </div>
              <div className="qr-opt">
                <label>容错</label>
                <select value={level} onChange={(e) => setLevel(e.target.value as (typeof LEVELS)[number])} disabled={!!logo}>
                  {LEVELS.map((l) => (<option key={l} value={l}>{l}</option>))}
                </select>
                {logo && <span style={{ fontSize: 11, color: "var(--text-muted)" }}>（容错已强制为 H）</span>}
              </div>
              <div className="qr-opt">
                <label>前景</label>
                <input type="color" value={fg} onChange={(e) => setFg(e.target.value)} />
              </div>
              <div className="qr-opt">
                <label>背景</label>
                <input type="color" value={bg} onChange={(e) => setBg(e.target.value)} />
              </div>
              <div className="qr-opt qr-logo-row">
                <label>Logo</label>
                {logo
                  ? <><img src={logo} className="qr-logo-thumb" alt="logo" /><button onClick={() => setLogo("")}>清除</button></>
                  : <button onClick={() => logoFileRef.current?.click()}>选择图片</button>}
                <input ref={logoFileRef} type="file" accept="image/*" hidden onChange={e => {
                  const f = e.target.files?.[0]; if (!f) return;
                  const r = new FileReader(); r.onload = () => setLogo(r.result as string); r.readAsDataURL(f);
                }} />
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="qr-download" onClick={download} disabled={!text}>下载 PNG</button>
              <button className="qr-download" onClick={exportSvg} disabled={!text}>导出 SVG</button>
            </div>
            {error && <div className="qr-err">{error}</div>}
          </>
        ) : (
          <>
            <div className="qr-decode-drop" tabIndex={0}
              onClick={() => decodeFileRef.current?.click()}
              onDrop={onDecodeDrop} onDragOver={e => e.preventDefault()}
              onPaste={onDecodePaste}>
              {decodeImg
                ? <img src={decodeImg} alt="decode" style={{ maxWidth: 200, maxHeight: 200, objectFit: "contain" }} />
                : <><p>点击选择图片</p><p>或拖放 / 粘贴截图</p></>}
            </div>
            <input ref={decodeFileRef} type="file" accept="image/*" hidden onChange={onDecodeFilePick} />
            <canvas ref={decodeCanvasRef} style={{ display: "none" }} />
            {decodeResult !== null && (
              <div className="qr-decode-result">
                <pre style={{ wordBreak: "break-all", whiteSpace: "pre-wrap" }}>{decodeResult}</pre>
                <button onClick={() => copyText(decodeResult!)}>复制</button>
              </div>
            )}
            {decodeErr && <div className="qr-err">{decodeErr}</div>}
          </>
        )}
      </div>
      <div className="qr-preview">
        <canvas ref={canvasRef} className="qr-canvas" />
      </div>
    </div>
  );
}
