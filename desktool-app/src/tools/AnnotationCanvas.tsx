import { useEffect, useRef, useState } from "react";
import { copyText } from "../useCopyFeedback";

type Tool = "rect" | "arrow" | "pen" | "text" | "mosaic" | "number";

interface Props {
  src: string;
  onClose: () => void;
  onSave: (dataUrl: string) => void;
}

export default function AnnotationCanvas({ src, onClose, onSave }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [tool, setTool] = useState<Tool>("rect");
  const [color, setColor] = useState("#e55");
  const [size, setSize] = useState(3);
  const historyRef = useRef<ImageData[]>([]);
  const drawing = useRef(false);
  const startRef = useRef({ x: 0, y: 0 });
  const snapshotRef = useRef<ImageData | null>(null);
  const textInputRef = useRef<HTMLInputElement>(null);
  const [textPos, setTextPos] = useState<{ x: number; y: number } | null>(null);
  const [numCount, setNumCount] = useState(0);

  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      const c = canvasRef.current!;
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      const ctx = c.getContext("2d")!;
      ctx.drawImage(img, 0, 0);
      pushHistory(ctx);
    };
    img.src = src;
  }, [src]);

  function pushHistory(ctx: CanvasRenderingContext2D) {
    const c = canvasRef.current!;
    historyRef.current.push(ctx.getImageData(0, 0, c.width, c.height));
    if (historyRef.current.length > 50) historyRef.current.shift();
  }

  function undo() {
    if (historyRef.current.length <= 1) return;
    historyRef.current.pop();
    const ctx = canvasRef.current!.getContext("2d")!;
    ctx.putImageData(historyRef.current[historyRef.current.length - 1], 0, 0);
  }

  function getXY(e: React.MouseEvent): { x: number; y: number } {
    const c = canvasRef.current!;
    const r = c.getBoundingClientRect();
    const scaleX = c.width / r.width, scaleY = c.height / r.height;
    return { x: (e.clientX - r.left) * scaleX, y: (e.clientY - r.top) * scaleY };
  }

  function onMouseDown(e: React.MouseEvent) {
    if (tool === "text") {
      setTextPos(getXY(e));
      setTimeout(() => textInputRef.current?.focus(), 10);
      return;
    }
    if (tool === "number") {
      const p = getXY(e);
      const ctx = canvasRef.current!.getContext("2d")!;
      const n = numCount + 1;
      setNumCount(n);
      const r = Math.max(16, size * 4 + 12);
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.font = `bold ${r}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(n), p.x, p.y);
      ctx.textAlign = "start";
      ctx.textBaseline = "alphabetic";
      pushHistory(ctx);
      return;
    }
    const ctx = canvasRef.current!.getContext("2d")!;
    const p = getXY(e);
    drawing.current = true;
    startRef.current = p;
    snapshotRef.current = ctx.getImageData(0, 0, canvasRef.current!.width, canvasRef.current!.height);
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = size;
    ctx.lineCap = "round";
    if (tool === "pen") { ctx.beginPath(); ctx.moveTo(p.x, p.y); }
  }

  function onMouseMove(e: React.MouseEvent) {
    if (!drawing.current) return;
    const ctx = canvasRef.current!.getContext("2d")!;
    const { x, y } = getXY(e);
    const { x: sx, y: sy } = startRef.current;

    if (tool === "pen") {
      ctx.lineTo(x, y); ctx.stroke(); return;
    }
    if (tool === "mosaic") {
      applyMosaic(ctx, x, y, 20); return;
    }
    // restore snapshot before re-drawing shape
    ctx.putImageData(snapshotRef.current!, 0, 0);
    ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = size; ctx.lineCap = "round";

    if (tool === "rect") {
      ctx.strokeRect(sx, sy, x - sx, y - sy);
    } else if (tool === "arrow") {
      drawArrow(ctx, sx, sy, x, y, size);
    }
  }

  function onMouseUp() {
    if (!drawing.current) return;
    drawing.current = false;
    const ctx = canvasRef.current!.getContext("2d")!;
    pushHistory(ctx);
  }

  function applyMosaic(ctx: CanvasRenderingContext2D, x: number, y: number, blockSize: number) {
    const r = 20;
    const data = ctx.getImageData(x - r, y - r, r * 2, r * 2);
    for (let i = 0; i < r * 2; i += blockSize) {
      for (let j = 0; j < r * 2; j += blockSize) {
        const idx = (j * r * 2 + i) * 4;
        const [R, G, B] = [data.data[idx], data.data[idx + 1], data.data[idx + 2]];
        ctx.fillStyle = `rgb(${R},${G},${B})`;
        ctx.fillRect(x - r + i, y - r + j, blockSize, blockSize);
      }
    }
  }

  function drawArrow(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, w: number) {
    const angle = Math.atan2(y2 - y1, x2 - x1);
    const hw = Math.max(w * 3, 12);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - hw * Math.cos(angle - 0.4), y2 - hw * Math.sin(angle - 0.4));
    ctx.lineTo(x2 - hw * Math.cos(angle + 0.4), y2 - hw * Math.sin(angle + 0.4));
    ctx.closePath();
    ctx.fill();
  }

  function commitText(val: string) {
    if (!textPos || !val.trim()) { setTextPos(null); return; }
    const ctx = canvasRef.current!.getContext("2d")!;
    ctx.font = `bold ${size * 6 + 12}px sans-serif`;
    ctx.fillStyle = color;
    ctx.fillText(val, textPos.x, textPos.y);
    pushHistory(ctx);
    setTextPos(null);
  }

  function toDataUrl() { return canvasRef.current!.toDataURL("image/png"); }

  async function copyImg() {
    const blob = await new Promise<Blob>(res => canvasRef.current!.toBlob(b => res(b!)));
    await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
    copyText("");  // trigger toast via existing copy infra is not ideal; just use alert
    alert("已复制到剪贴板");
  }

  const TOOLS: { id: Tool; label: string }[] = [
    { id: "rect", label: "⬜" },
    { id: "arrow", label: "↗" },
    { id: "pen", label: "✏️" },
    { id: "text", label: "T" },
    { id: "mosaic", label: "▦" },
    { id: "number", label: "①" },
  ];

  return (
    <div className="ann-root">
      <div className="ann-toolbar">
        <div className="ann-tools">
          {TOOLS.map(t => (
            <button key={t.id} className={`ann-tool ${tool === t.id ? "on" : ""}`} title={t.id}
              onClick={() => { setTool(t.id); setTextPos(null); }}>
              {t.label}
            </button>
          ))}
        </div>
        <input type="color" className="ann-color" value={color} onChange={e => setColor(e.target.value)} title="颜色" />
        <input type="range" min="1" max="10" value={size} onChange={e => setSize(Number(e.target.value))} title="粗细" className="ann-size" />
        <button onClick={undo} title="撤销">↩</button>
        <span className="ann-sep" />
        <button onClick={() => { onSave(toDataUrl()); }} className="ann-action">保存</button>
        <button onClick={copyImg} className="ann-action">复制</button>
        <button onClick={onClose}>取消</button>
      </div>
      <div className="ann-canvas-wrap">
        <canvas ref={canvasRef} className="ann-canvas"
          onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp} onMouseLeave={onMouseUp}
          style={{ cursor: tool === "text" ? "text" : tool === "mosaic" ? "crosshair" : "crosshair" }}
        />
        {textPos && (
          <input ref={textInputRef} className="ann-text-input"
            style={{ left: textPos.x, top: textPos.y, fontSize: size * 6 + 12, color }}
            placeholder="输入文字 Enter 确认" defaultValue=""
            onKeyDown={e => { if (e.key === "Enter") commitText((e.target as HTMLInputElement).value); if (e.key === "Escape") setTextPos(null); }}
            onBlur={e => commitText(e.target.value)} />
        )}
      </div>
    </div>
  );
}
