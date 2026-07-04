import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { ToolProps } from "./types";
import { usePersistentState } from "../storage";
import "./ChartTool.css";

type ChartType = "bar" | "line" | "pie" | "area" | "scatter" | "radar";

const PALETTE = ["#5b8def","#43c6ac","#ffc14d","#e5484d","#b07cff","#f97316","#06b6d4","#84cc16"];

interface MultiPoint { label: string; values: number[]; }

function parseMulti(raw: string): { series: string[]; points: MultiPoint[] } {
  const lines = raw.split("\n").filter(l => l.trim() && !l.trim().startsWith("#"));
  if (!lines.length) return { series: [], points: [] };
  const firstParts = lines[0].trim().split(/[\s:,]+/);
  const hasHeader = firstParts.length > 1 && isNaN(Number(firstParts[firstParts.length - 1]));
  const seriesNames = hasHeader
    ? firstParts.slice(1)
    : firstParts.slice(1).map((_, i) => `系列${i + 1}`);
  const dataLines = hasHeader ? lines.slice(1) : lines;
  const points: MultiPoint[] = dataLines.flatMap(line => {
    const parts = line.trim().split(/[\s:,]+/);
    const label = parts[0];
    const nums = parts.slice(1).map(Number).filter(v => !isNaN(v));
    return label && nums.length ? [{ label, values: nums }] : [];
  });
  return { series: seriesNames, points };
}

function hexToRgb(hex: string): string {
  const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
  return `${r},${g},${b}`;
}

function drawBar(ctx: CanvasRenderingContext2D, w: number, h: number, points: MultiPoint[], series: string[], title: string) {
  const pad = { top: 40, right: 20, bottom: 60, left: 55 };
  const cw = w - pad.left - pad.right;
  const ch = h - pad.top - pad.bottom;
  const allVals = points.flatMap(p => p.values);
  const max = Math.max(...allVals, 0);
  const min = Math.min(0, ...allVals);
  const range = max - min || 1;
  const n = series.length;
  const slotW = cw / (points.length || 1);
  const barW = slotW * 0.8 / n;
  const y0 = pad.top + ch * (1 - (0 - min) / range);

  ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue("--text").trim() || "#222";
  ctx.font = "bold 14px sans-serif"; ctx.textAlign = "center";
  ctx.fillText(title, w / 2, 22);

  ctx.strokeStyle = "#e5e5e5"; ctx.lineWidth = 1;
  ctx.font = "11px sans-serif"; ctx.fillStyle = "#8e8e93"; ctx.textAlign = "right";
  for (let i = 0; i <= 5; i++) {
    const v = min + (range / 5) * i;
    const y = pad.top + ch - (ch * (v - min) / range);
    ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(pad.left + cw, y); ctx.stroke();
    ctx.fillText(v.toFixed(v % 1 !== 0 ? 1 : 0), pad.left - 6, y + 4);
  }

  points.forEach((d, i) => {
    const slotX = pad.left + slotW * i;
    d.values.forEach((val, si) => {
      const x = slotX + (slotW * 0.1) + si * barW;
      const barH = Math.abs(ch * val / range);
      const y = val >= 0 ? y0 - barH : y0;
      ctx.fillStyle = PALETTE[si % PALETTE.length];
      ctx.fillRect(x, y, barW * 0.9, barH);
      if (n === 1) {
        ctx.fillStyle = PALETTE[si % PALETTE.length];
        ctx.font = "11px sans-serif"; ctx.textAlign = "center";
        ctx.fillText(String(val), x + barW * 0.45, y - 4);
      }
    });
    ctx.fillStyle = "#8e8e93"; ctx.font = "11px sans-serif"; ctx.textAlign = "center";
    const label = d.label.length > 8 ? d.label.slice(0, 7) + "…" : d.label;
    ctx.fillText(label, slotX + slotW / 2, pad.top + ch + 18);
  });
}

function drawLine(ctx: CanvasRenderingContext2D, w: number, h: number, points: MultiPoint[], series: string[], title: string) {
  const pad = { top: 40, right: 20, bottom: 60, left: 55 };
  const cw = w - pad.left - pad.right;
  const ch = h - pad.top - pad.bottom;
  const allVals = points.flatMap(p => p.values);
  const max = Math.max(...allVals);
  const min = Math.min(...allVals);
  const range = max - min || 1;

  ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue("--text").trim() || "#222";
  ctx.font = "bold 14px sans-serif"; ctx.textAlign = "center";
  ctx.fillText(title, w / 2, 22);

  ctx.strokeStyle = "#e5e5e5"; ctx.lineWidth = 1;
  ctx.font = "11px sans-serif"; ctx.fillStyle = "#8e8e93"; ctx.textAlign = "right";
  for (let i = 0; i <= 5; i++) {
    const v = min + (range / 5) * i;
    const y = pad.top + ch - ch * (v - min) / range;
    ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(pad.left + cw, y); ctx.stroke();
    ctx.fillText(v.toFixed(v % 1 !== 0 ? 1 : 0), pad.left - 6, y + 4);
  }

  const xStep = cw / (points.length - 1 || 1);
  series.forEach((_, si) => {
    const pts = points.map((d, i) => ({
      x: pad.left + xStep * i,
      y: pad.top + ch - ch * ((d.values[si] ?? 0) - min) / range,
    }));
    ctx.beginPath();
    pts.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
    if (si === 0) {
      const last = pts[pts.length - 1]; const first = pts[0];
      ctx.lineTo(last.x, pad.top + ch); ctx.lineTo(first.x, pad.top + ch); ctx.closePath();
      ctx.fillStyle = `rgba(${hexToRgb(PALETTE[si])},0.15)`;
      ctx.fill();
      ctx.beginPath();
      pts.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
    }
    ctx.strokeStyle = PALETTE[si % PALETTE.length]; ctx.lineWidth = 2;
    ctx.stroke();
    pts.forEach(p => {
      ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
      ctx.fillStyle = PALETTE[si % PALETTE.length]; ctx.fill();
    });
  });

  points.forEach((d, i) => {
    ctx.fillStyle = "#8e8e93"; ctx.font = "11px sans-serif"; ctx.textAlign = "center";
    ctx.fillText(d.label.length > 6 ? d.label.slice(0, 5) + "…" : d.label,
      pad.left + xStep * i, pad.top + ch + 18);
  });
}

function drawPie(ctx: CanvasRenderingContext2D, w: number, h: number, points: MultiPoint[], title: string) {
  const data = points.map(p => ({ label: p.label, value: p.values[0] ?? 0 }));
  ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue("--text").trim() || "#222";
  ctx.font = "bold 14px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(title, w / 2, 22);

  const total = data.reduce((s, d) => s + Math.abs(d.value), 0);
  if (!total) return;
  const cx = w / 2, cy = h / 2 + 10, r = Math.min(w, h) * 0.3;
  let angle = -Math.PI / 2;

  data.forEach((d, i) => {
    const slice = (Math.abs(d.value) / total) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, angle, angle + slice);
    ctx.closePath();
    ctx.fillStyle = PALETTE[i % PALETTE.length];
    ctx.fill();

    const mid = angle + slice / 2;
    const lx = cx + (r + 20) * Math.cos(mid);
    const ly = cy + (r + 20) * Math.sin(mid);
    const pct = ((Math.abs(d.value) / total) * 100).toFixed(1);
    ctx.fillStyle = "#666";
    ctx.font = "11px sans-serif";
    ctx.textAlign = lx > cx ? "left" : "right";
    ctx.fillText(`${d.label} ${pct}%`, lx, ly);
    angle += slice;
  });
}

function drawArea(ctx: CanvasRenderingContext2D, w: number, h: number, points: MultiPoint[], series: string[], title: string) {
  // Area chart = line chart with filled area
  drawLine(ctx, w, h, points, series, title);
  // Overlay fill by re-drawing with fill
  const pad = { top: 40, right: 20, bottom: 40, left: 55 };
  const cw = w - pad.left - pad.right, ch = h - pad.top - pad.bottom;
  const allVals = points.flatMap(p => p.values);
  const max = Math.max(...allVals, 0), min = Math.min(0, ...allVals);
  const range = max - min || 1;
  series.forEach((_s, si) => {
    ctx.beginPath();
    points.forEach((p, i) => {
      const x = pad.left + (cw / (points.length - 1 || 1)) * i;
      const y = pad.top + ch * (1 - (p.values[si] - min) / range);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    const lastX = pad.left + cw;
    const baseY = pad.top + ch * (1 - (0 - min) / range);
    ctx.lineTo(lastX, baseY);
    ctx.lineTo(pad.left, baseY);
    ctx.closePath();
    ctx.fillStyle = PALETTE[si % PALETTE.length] + "30";
    ctx.fill();
  });
}

function drawScatter(ctx: CanvasRenderingContext2D, w: number, h: number, points: MultiPoint[], series: string[], title: string) {
  const pad = { top: 40, right: 20, bottom: 40, left: 55 };
  const cw = w - pad.left - pad.right, ch = h - pad.top - pad.bottom;
  const allVals = points.flatMap(p => p.values);
  const max = Math.max(...allVals, 0), min = Math.min(0, ...allVals);
  const range = max - min || 1;
  ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue("--text").trim() || "#222";
  ctx.font = "bold 14px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(title, w / 2, 22);
  // Axes
  ctx.strokeStyle = "#ccc";
  ctx.beginPath();
  ctx.moveTo(pad.left, pad.top); ctx.lineTo(pad.left, pad.top + ch);
  ctx.lineTo(pad.left + cw, pad.top + ch);
  ctx.stroke();
  // Points
  points.forEach((p, i) => {
    const x = pad.left + (cw / (points.length - 1 || 1)) * i;
    p.values.forEach((val, si) => {
      const y = pad.top + ch * (1 - (val - min) / range);
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fillStyle = PALETTE[si % PALETTE.length];
      ctx.fill();
    });
  });
  // Legend
  ctx.font = "11px sans-serif";
  ctx.textAlign = "left";
  series.forEach((s, si) => {
    ctx.fillStyle = PALETTE[si % PALETTE.length];
    ctx.fillRect(pad.left + cw - 100, pad.top + si * 16, 10, 10);
    ctx.fillStyle = "#666";
    ctx.fillText(s, pad.left + cw - 85, pad.top + si * 16 + 9);
  });
}

function drawRadar(ctx: CanvasRenderingContext2D, w: number, h: number, points: MultiPoint[], series: string[], title: string) {
  const cx = w / 2, cy = h / 2 + 10;
  const r = Math.min(w, h) * 0.3;
  const n = points.length;
  if (n < 3) {
    ctx.fillStyle = "#666";
    ctx.font = "13px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("雷达图至少需要 3 个数据点", w / 2, h / 2);
    return;
  }
  ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue("--text").trim() || "#222";
  ctx.font = "bold 14px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(title, w / 2, 22);
  const allVals = points.flatMap(p => p.values);
  const max = Math.max(...allVals, 1);
  // Grid circles
  ctx.strokeStyle = "#ddd";
  for (let g = 1; g <= 4; g++) {
    ctx.beginPath();
    for (let i = 0; i <= n; i++) {
      const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
      const gr = (r * g) / 4;
      const x = cx + gr * Math.cos(angle);
      const y = cy + gr * Math.sin(angle);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  // Axis lines + labels
  points.forEach((p, i) => {
    const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
    ctx.strokeStyle = "#ddd";
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + r * Math.cos(angle), cy + r * Math.sin(angle));
    ctx.stroke();
    ctx.fillStyle = "#666";
    ctx.font = "11px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(p.label, cx + (r + 15) * Math.cos(angle), cy + (r + 15) * Math.sin(angle) + 4);
  });
  // Data polygons
  series.forEach((_s, si) => {
    ctx.beginPath();
    points.forEach((p, i) => {
      const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
      const val = (p.values[si] ?? 0) / max;
      const x = cx + r * val * Math.cos(angle);
      const y = cy + r * val * Math.sin(angle);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.closePath();
    ctx.strokeStyle = PALETTE[si % PALETTE.length];
    ctx.fillStyle = PALETTE[si % PALETTE.length] + "30";
    ctx.fill();
    ctx.stroke();
  });
  // Legend
  ctx.font = "11px sans-serif";
  ctx.textAlign = "left";
  series.forEach((s, si) => {
    ctx.fillStyle = PALETTE[si % PALETTE.length];
    ctx.fillRect(pad_left_radar(w), pad_top_radar(h) + si * 16, 10, 10);
    ctx.fillStyle = "#666";
    ctx.fillText(s, pad_left_radar(w) + 15, pad_top_radar(h) + si * 16 + 9);
  });
}
function pad_left_radar(w: number) { return w - 120; }
function pad_top_radar(_h: number) { return 40; }

function buildSvg(type: ChartType, series: string[], points: MultiPoint[], title: string): string {
  const W = 600, H = 400;
  const pad = { top: 40, right: 20, bottom: 60, left: 55 };
  const cw = W - pad.left - pad.right, ch = H - pad.top - pad.bottom;
  const allVals = points.flatMap(p => p.values);
  const max = Math.max(...allVals, 0), min = Math.min(0, ...allVals);
  const range = max - min || 1;
  let body = "";

  if (type === "bar") {
    const n = series.length;
    const slotW = cw / (points.length || 1);
    const barW = slotW * 0.8 / n;
    const y0 = pad.top + ch * (1 - (0 - min) / range);
    points.forEach((d, i) => {
      const slotX = pad.left + slotW * i;
      d.values.forEach((val, si) => {
        const x = slotX + slotW * 0.1 + si * barW;
        const bh = Math.abs(ch * val / range);
        const y = val >= 0 ? y0 - bh : y0;
        body += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${(barW*0.9).toFixed(1)}" height="${bh.toFixed(1)}" fill="${PALETTE[si%PALETTE.length]}"/>`;
      });
      body += `<text x="${(pad.left+slotW*(i+0.5)).toFixed(1)}" y="${(pad.top+ch+18)}" text-anchor="middle" font-size="11" fill="#888">${d.label}</text>`;
    });
    for (let i = 0; i <= 5; i++) {
      const v = min + (range / 5) * i;
      const y = pad.top + ch - ch * (v - min) / range;
      body += `<line x1="${pad.left}" y1="${y.toFixed(1)}" x2="${pad.left+cw}" y2="${y.toFixed(1)}" stroke="#e5e5e5" stroke-width="1"/>`;
      body += `<text x="${pad.left-6}" y="${(y+4).toFixed(1)}" text-anchor="end" font-size="11" fill="#888">${v.toFixed(v%1?1:0)}</text>`;
    }
  } else if (type === "line") {
    const xStep = cw / (points.length - 1 || 1);
    series.forEach((_, si) => {
      const pts = points.map((d,i) => ({ x: pad.left+xStep*i, y: pad.top+ch-ch*((d.values[si]??0)-min)/range }));
      const d = pts.map((p,i) => `${i?"L":"M"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
      body += `<path d="${d}" fill="none" stroke="${PALETTE[si%PALETTE.length]}" stroke-width="2"/>`;
    });
    points.forEach((d,i) => {
      body += `<text x="${(pad.left+xStep*i).toFixed(1)}" y="${pad.top+ch+18}" text-anchor="middle" font-size="11" fill="#888">${d.label}</text>`;
    });
  } else {
    const total = points.reduce((s,p) => s + Math.abs(p.values[0]??0), 0) || 1;
    const cx = W/2, cy = H/2+10, r = Math.min(W,H)*0.3;
    let angle = -Math.PI/2;
    points.forEach((d,i) => {
      const slice = (Math.abs(d.values[0]??0)/total)*Math.PI*2;
      const x1=cx+r*Math.cos(angle), y1=cy+r*Math.sin(angle);
      const x2=cx+r*Math.cos(angle+slice), y2=cy+r*Math.sin(angle+slice);
      const large=slice>Math.PI?1:0;
      body += `<path d="M${cx},${cy} L${x1.toFixed(1)},${y1.toFixed(1)} A${r},${r} 0 ${large},1 ${x2.toFixed(1)},${y2.toFixed(1)} Z" fill="${PALETTE[i%PALETTE.length]}"/>`;
      angle += slice;
    });
  }

  const legend = series.length > 1
    ? series.map((s,i) => `<rect x="${pad.left+i*90}" y="${H-18}" width="10" height="10" fill="${PALETTE[i%PALETTE.length]}"/><text x="${pad.left+i*90+14}" y="${H-8}" font-size="11" fill="#888">${s}</text>`).join("")
    : "";

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<rect width="${W}" height="${H}" fill="#fff"/>
<text x="${W/2}" y="22" text-anchor="middle" font-size="14" font-weight="bold">${title}</text>
${body}${legend}
</svg>`;
}

/** F16 图表制作 */
export default function ChartTool({ instanceId }: ToolProps) {
  const ns = `chart:${instanceId}`;
  const [type, setType] = usePersistentState<ChartType>(`${ns}:type`, "bar");
  const [title, setTitle] = usePersistentState(`${ns}:title`, "我的图表");
  const [raw, setRaw] = usePersistentState(`${ns}:data`, "一月:1200\n二月:1850\n三月:980\n四月:2300\n五月:1760\n六月:2100");
  const [inputMode, setInputMode] = usePersistentState<"text" | "table">(`${ns}:inputMode`, "text");
  const [tableHeaders, setTableHeaders] = usePersistentState<string[]>(`${ns}:thdr`, ["系列1"]);
  const [tableRows, setTableRows] = usePersistentState<string[][]>(`${ns}:trows`,
    [["一月","1200"],["二月","1850"],["三月","980"],["四月","2300"]]);
  const [tooltip, setTooltip] = useState<{x:number;y:number;text:string}|null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  function updateCell(ri: number, ci: number, val: string) {
    setTableRows(rows => rows.map((r, i) => i === ri ? r.map((c, j) => j === ci ? val : c) : r));
  }
  function updateHeader(i: number, val: string) {
    setTableHeaders(hs => hs.map((h, j) => j === i ? val : h));
  }
  function addCol() {
    setTableHeaders(hs => [...hs, `系列${hs.length + 1}`]);
    setTableRows(rows => rows.map(r => [...r, "0"]));
  }
  function removeCol(i: number) {
    setTableHeaders(hs => hs.filter((_, j) => j !== i));
    setTableRows(rows => rows.map(r => r.filter((_, j) => j !== i + 1)));
  }
  function addRow() { setTableRows(rows => [...rows, ["",...tableHeaders.map(() => "0")]]); }
  function removeRow(ri: number) { setTableRows(rows => rows.filter((_, i) => i !== ri)); }

  const { series, points } = useMemo(() => {
    if (inputMode === "table") {
      return {
        series: tableHeaders,
        points: tableRows
          .map(row => ({ label: row[0] ?? "", values: tableHeaders.map((_, i) => Number(row[i + 1]) || 0) }))
          .filter(p => p.label.trim()),
      };
    }
    return parseMulti(raw);
  }, [inputMode, raw, tableHeaders, tableRows]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const W = canvas.offsetWidth, H = canvas.offsetHeight;
    canvas.width = W * dpr; canvas.height = H * dpr;
    const ctx = canvas.getContext("2d")!;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, W, H);
    if (points.length === 0) {
      ctx.fillStyle = "#aaa"; ctx.font = "14px sans-serif"; ctx.textAlign = "center";
      ctx.fillText("请在左侧输入数据", W / 2, H / 2);
      return;
    }
    if (type === "bar") drawBar(ctx, W, H, points, series, title);
    else if (type === "line") drawLine(ctx, W, H, points, series, title);
    else if (type === "area") drawArea(ctx, W, H, points, series, title);
    else if (type === "scatter") drawScatter(ctx, W, H, points, series, title);
    else if (type === "radar") drawRadar(ctx, W, H, points, series, title);
    else drawPie(ctx, W, H, points, title);
  }, [points, series, type, title]);

  function onMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current; if (!canvas || points.length === 0) return;
    const rect = canvas.getBoundingClientRect();
    const mx = (e.clientX - rect.left);
    const W = canvas.offsetWidth;
    const idx = Math.round((mx - 55) / ((W - 75) / (points.length - 1 || 1)));
    const clamped = Math.max(0, Math.min(points.length - 1, idx));
    const pt = points[clamped];
    if (!pt) return;
    const valText = series.length > 1
      ? series.map((s, i) => `${s}: ${pt.values[i] ?? 0}`).join("\n")
      : String(pt.values[0] ?? "");
    setTooltip({ x: e.clientX, y: e.clientY, text: `${pt.label}\n${valText}` });
  }

  async function download() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const { saveDataUrlWithDialog } = await import("../saveFile");
    await saveDataUrlWithDialog(canvas.toDataURL("image/png"), "chart.png", [
      { name: "PNG", extensions: ["png"] },
    ]);
  }

  return (
    <>
      <div className="ch-tool">
        <div className="ch-left">
          <div className="ch-types">
            {(["bar","line","pie","area","scatter","radar"] as ChartType[]).map((t) => (
              <button key={t} className={type === t ? "on" : ""} onClick={() => setType(t)}>
                {t === "bar" ? "柱状图" : t === "line" ? "折线图" : t === "pie" ? "饼图" : t === "area" ? "面积图" : t === "scatter" ? "散点图" : "雷达图"}
              </button>
            ))}
          </div>
          <input className="ch-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="图表标题" />
          <div className="ch-input-mode">
            <button className={inputMode === "text" ? "on" : ""} onClick={() => setInputMode("text")}>文本</button>
            <button className={inputMode === "table" ? "on" : ""} onClick={() => setInputMode("table")}>表格</button>
          </div>
          {inputMode === "text" ? (
            <>
              <div className="ch-hint">每行一个数据点：标签:数值　或多系列：标签,v1,v2</div>
              <textarea className="ch-data" value={raw} onChange={(e) => setRaw(e.target.value)}
                placeholder={"一月:1200\n二月:1850"} spellCheck={false} />
            </>
          ) : (
            <div className="ch-table-wrap">
              <table className="ch-table">
                <thead>
                  <tr>
                    <th>标签</th>
                    {tableHeaders.map((h, i) => (
                      <th key={i}>
                        <input value={h} onChange={e => updateHeader(i, e.target.value)} />
                        {tableHeaders.length > 1 && <button onClick={() => removeCol(i)} title="删除列">×</button>}
                      </th>
                    ))}
                    <th><button onClick={addCol}>+列</button></th>
                  </tr>
                </thead>
                <tbody>
                  {tableRows.map((row, ri) => (
                    <tr key={ri}>
                      <td><input value={row[0] ?? ""} onChange={e => updateCell(ri, 0, e.target.value)} placeholder="标签" /></td>
                      {tableHeaders.map((_, ci) => (
                        <td key={ci}>
                          <input type="number" value={row[ci + 1] ?? "0"} onChange={e => updateCell(ri, ci + 1, e.target.value)} />
                        </td>
                      ))}
                      <td><button onClick={() => removeRow(ri)}>×</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <button className="ch-add-row" onClick={addRow}>+ 行</button>
            </div>
          )}
        </div>
        <div className="ch-right">
          <div className="ch-canvas-wrap">
            <canvas ref={canvasRef} className="ch-canvas"
              onMouseMove={onMouseMove}
              onMouseLeave={() => setTooltip(null)} />
          </div>
          {series.length > 1 && (
            <div className="ch-legend">
              {series.map((s, i) => (
                <span key={s} className="ch-legend-item">
                  <span className="ch-legend-dot" style={{ background: PALETTE[i % PALETTE.length] }} />
                  {s}
                </span>
              ))}
            </div>
          )}
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button className="ch-dl" onClick={download} disabled={points.length === 0}>下载图片</button>
            <button className="ch-dl" onClick={async () => {
              const { saveTextWithDialog } = await import("../saveFile");
              await saveTextWithDialog(buildSvg(type, series, points, title), "chart.svg", [{ name: "SVG", extensions: ["svg"] }]);
            }} disabled={points.length === 0}>导出 SVG</button>
          </div>
        </div>
      </div>
      {tooltip && createPortal(
        <div className="ch-tooltip" style={{ left: tooltip.x + 12, top: tooltip.y - 8 }}>
          {tooltip.text}
        </div>,
        document.body
      )}
    </>
  );
}
