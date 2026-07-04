import React from "react";
import { copyText } from "../useCopyFeedback";
import type { ToolProps } from "./types";
import { usePersistentState } from "../storage";
import "./ColorTool.css";

interface RGB {
  r: number;
  g: number;
  b: number;
}

function hexToRgb(hex: string): RGB | null {
  let h = hex.trim().replace(/^#/, "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

function rgbToHex({ r, g, b }: RGB): string {
  return (
    "#" +
    [r, g, b]
      .map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0"))
      .join("")
  );
}

function rgbToHsl({ r, g, b }: RGB): { h: number; s: number; l: number } {
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
  let h = 0;
  const l = (max + min) / 2;
  const d = max - min;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  if (d !== 0) {
    if (max === rn) h = ((gn - bn) / d) % 6;
    else if (max === gn) h = (bn - rn) / d + 2;
    else h = (rn - gn) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h: Math.round(h), s: Math.round(s * 100), l: Math.round(l * 100) };
}

function hslToRgb(h: number, s: number, l: number): RGB {
  const sn = s / 100, ln = l / 100;
  const c = (1 - Math.abs(2 * ln - 1)) * sn;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = ln - c / 2;
  let rn = 0, gn = 0, bn = 0;
  if (h < 60)       { rn = c; gn = x; bn = 0; }
  else if (h < 120) { rn = x; gn = c; bn = 0; }
  else if (h < 180) { rn = 0; gn = c; bn = x; }
  else if (h < 240) { rn = 0; gn = x; bn = c; }
  else if (h < 300) { rn = x; gn = 0; bn = c; }
  else              { rn = c; gn = 0; bn = x; }
  return {
    r: Math.round((rn + m) * 255),
    g: Math.round((gn + m) * 255),
    b: Math.round((bn + m) * 255),
  };
}

function relativeLuminance({ r, g, b }: RGB): number {
  const chan = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * chan(r) + 0.7152 * chan(g) + 0.0722 * chan(b);
}

function contrastRatio(L1: number, L2: number): number {
  const lighter = Math.max(L1, L2);
  const darker = Math.min(L1, L2);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * F12 颜色转换
 * HEX / RGB / HSL 互转，取色器与预览。
 */
export default function ColorTool({ instanceId }: ToolProps) {
  const [hex, setHex] = usePersistentState(`color:${instanceId}:hex`, "#5b8def");
  const [alpha, setAlpha] = usePersistentState(`color:${instanceId}:alpha`, 100);
  const [history, setHistory] = usePersistentState(`color:${instanceId}:history`, [] as string[]);

  const [rgbInput, setRgbInput] = React.useState<string | null>(null);
  const [hslInput, setHslInput] = React.useState<string | null>(null);
  const [rgbErr, setRgbErr] = React.useState(false);
  const [hslErr, setHslErr] = React.useState(false);

  const rgb = hexToRgb(hex);
  const valid = rgb !== null;
  const hsl = rgb ? rgbToHsl(rgb) : null;

  const rgbStr = rgb ? `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})` : "—";
  const hslStr = hsl ? `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)` : "—";
  const hexStr = valid ? rgbToHex(rgb!) : "—";

  const alphaHex = Math.round((alpha / 100) * 255).toString(16).padStart(2, "0").toUpperCase();
  const hex8Str = valid ? `${hexStr.toUpperCase()}${alphaHex}` : "—";

  const lumColor = rgb ? relativeLuminance(rgb) : 0;
  const lumWhite = 1.0;
  const lumBlack = 0.0;
  const contrastVsWhite = contrastRatio(lumColor, lumWhite);
  const contrastVsBlack = contrastRatio(lumColor, lumBlack);

  function copy(text: string) {
    if (!valid) return;
    copyText(text);
  }

  function setChannel(ch: keyof RGB, v: number) {
    if (!rgb) return;
    setHex(rgbToHex({ ...rgb, [ch]: v }));
  }

  function addToHistory(hexColor: string) {
    const normalized = hexColor.toLowerCase();
    setHistory(prev => {
      if (prev[0] === normalized) return prev;
      const deduped = prev.filter(h => h !== normalized);
      return [normalized, ...deduped].slice(0, 20);
    });
  }

  return (
    <div className="ct-tool">
      <div className="ct-main">
        <div
          className="ct-preview"
          style={{ background: valid ? hexStr : "transparent" }}
        >
          <input
            type="color"
            value={valid ? hexStr : "#000000"}
            onChange={(e) => { setHex(e.target.value); addToHistory(e.target.value); }}
            className="ct-picker"
            title="取色器"
          />
        </div>

        <div className="ct-fields">
          <div className="ct-field">
            <label>HEX</label>
            <input
              className={!valid ? "err" : ""}
              value={hex}
              onChange={(e) => setHex(e.target.value)}
              onBlur={() => { if (valid) addToHistory(hexStr); }}
              spellCheck={false}
            />
            <button onClick={() => copy(hexStr)} disabled={!valid}>复制</button>
          </div>
          <div className="ct-field">
            <label>HEX8</label>
            <input value={hex8Str} readOnly spellCheck={false} />
            <button onClick={() => copy(hex8Str)} disabled={!valid}>复制</button>
          </div>
          <div className="ct-field">
            <label>RGB</label>
            <input
              className={rgbErr ? "err" : ""}
              value={rgbInput !== null ? rgbInput : rgbStr}
              onChange={(e) => {
                const v = e.target.value;
                setRgbInput(v);
                const m = v.match(/^\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*$/);
                if (m) {
                  const [r, g, b] = [+m[1], +m[2], +m[3]];
                  if (r <= 255 && g <= 255 && b <= 255) {
                    setHex(rgbToHex({ r, g, b }));
                    setRgbErr(false);
                    return;
                  }
                }
                setRgbErr(true);
              }}
              onBlur={() => { setRgbInput(null); setRgbErr(false); }}
              spellCheck={false}
            />
            <button onClick={() => copy(rgbStr)} disabled={!valid}>复制</button>
          </div>
          <div className="ct-field">
            <label>HSL</label>
            <input
              className={hslErr ? "err" : ""}
              value={hslInput !== null ? hslInput : hslStr}
              onChange={(e) => {
                const v = e.target.value;
                setHslInput(v);
                const m = v.match(/^\s*(\d{1,3})\s*,\s*(\d{1,3})%?\s*,\s*(\d{1,3})%?\s*$/);
                if (m) {
                  const [h, s, l] = [+m[1], +m[2], +m[3]];
                  if (h <= 360 && s <= 100 && l <= 100) {
                    setHex(rgbToHex(hslToRgb(h, s, l)));
                    setHslErr(false);
                    return;
                  }
                }
                setHslErr(true);
              }}
              onBlur={() => { setHslInput(null); setHslErr(false); }}
              spellCheck={false}
            />
            <button onClick={() => copy(hslStr)} disabled={!valid}>复制</button>
          </div>
        </div>
      </div>

      {rgb && (
        <div className="ct-sliders">
          {(["r", "g", "b"] as const).map((ch) => (
            <div key={ch} className="ct-slider">
              <span className="ct-slider-label">{ch.toUpperCase()}</span>
              <input
                type="range"
                min={0}
                max={255}
                value={rgb[ch]}
                onChange={(e) => setChannel(ch, Number(e.target.value))}
              />
              <span className="ct-slider-val">{rgb[ch]}</span>
            </div>
          ))}
          <div className="ct-slider">
            <span className="ct-slider-label">A</span>
            <input
              type="range"
              min={0}
              max={100}
              value={alpha}
              onChange={(e) => setAlpha(Number(e.target.value))}
            />
            <span className="ct-slider-val">{alpha}%</span>
          </div>
        </div>
      )}

      {valid && (
        <div className="ct-wcag">
          <div className="ct-wcag-row">
            <span className="ct-wcag-label">vs 白色</span>
            <span className="ct-wcag-ratio">{contrastVsWhite.toFixed(2)}:1</span>
            {contrastVsWhite >= 7 && <span className="ct-badge ct-badge-aaa">AAA</span>}
            {contrastVsWhite >= 4.5 && contrastVsWhite < 7 && <span className="ct-badge ct-badge-aa">AA</span>}
            {contrastVsWhite < 4.5 && <span className="ct-badge ct-badge-fail">✗</span>}
          </div>
          <div className="ct-wcag-row">
            <span className="ct-wcag-label">vs 黑色</span>
            <span className="ct-wcag-ratio">{contrastVsBlack.toFixed(2)}:1</span>
            {contrastVsBlack >= 7 && <span className="ct-badge ct-badge-aaa">AAA</span>}
            {contrastVsBlack >= 4.5 && contrastVsBlack < 7 && <span className="ct-badge ct-badge-aa">AA</span>}
            {contrastVsBlack < 4.5 && <span className="ct-badge ct-badge-fail">✗</span>}
          </div>
        </div>
      )}

      {history.length > 0 && (
        <div className="ct-history">
          {history.map((h) => (
            <button
              key={h}
              className="ct-history-dot"
              style={{ background: h }}
              title={h}
              onClick={() => setHex(h)}
              aria-label={`恢复颜色 ${h}`}
            />
          ))}
        </div>
      )}

      {/* 调色板生成 */}
      {valid && rgb && hsl && (
        <div className="ct-palette">
          <div className="ct-palette-title">调色方案</div>
          <div className="ct-palette-row">
            <div className="ct-palette-group">
              <span className="ct-palette-label">互补色</span>
              <button className="ct-palette-swatch" style={{ background: rgbToHex(hslToRgb((hsl.h + 180) % 360, hsl.s, hsl.l)) }} onClick={() => setHex(rgbToHex(hslToRgb((hsl.h + 180) % 360, hsl.s, hsl.l)))} title="互补色" />
            </div>
            <div className="ct-palette-group">
              <span className="ct-palette-label">类比色</span>
              {[hsl.h, (hsl.h + 30) % 360, (hsl.h + 330) % 360].map((nh, i) => (
                <button key={i} className="ct-palette-swatch" style={{ background: rgbToHex(hslToRgb(nh, hsl.s, hsl.l)) }} onClick={() => setHex(rgbToHex(hslToRgb(nh, hsl.s, hsl.l)))} title={`类比色 ${i + 1}`} />
              ))}
            </div>
            <div className="ct-palette-group">
              <span className="ct-palette-label">三元色</span>
              {[hsl.h, (hsl.h + 120) % 360, (hsl.h + 240) % 360].map((nh, i) => (
                <button key={i} className="ct-palette-swatch" style={{ background: rgbToHex(hslToRgb(nh, hsl.s, hsl.l)) }} onClick={() => setHex(rgbToHex(hslToRgb(nh, hsl.s, hsl.l)))} title={`三元色 ${i + 1}`} />
              ))}
            </div>
            <div className="ct-palette-group">
              <span className="ct-palette-label">明暗渐变</span>
              {[20, 40, 60, 80].map((nl, i) => (
                <button key={i} className="ct-palette-swatch" style={{ background: rgbToHex(hslToRgb(hsl.h, hsl.s, nl)) }} onClick={() => setHex(rgbToHex(hslToRgb(hsl.h, hsl.s, nl)))} title={`亮度 ${nl}%`} />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 对比度预览 */}
      {valid && rgb && (
        <div className="ct-contrast-preview">
          <div className="ct-contrast-title">文字对比预览</div>
          <div className="ct-contrast-row">
            <div className="ct-contrast-box" style={{ background: hexStr, color: "#fff" }}>
              白色文字在 {hexStr} 上
            </div>
            <div className="ct-contrast-box" style={{ background: hexStr, color: "#000" }}>
              黑色文字在 {hexStr} 上
            </div>
          </div>
          <div className="ct-contrast-row">
            <div className="ct-contrast-box" style={{ background: "#fff", color: hexStr, border: "1px solid var(--border)" }}>
              {hexStr} 文字在白色上
            </div>
            <div className="ct-contrast-box" style={{ background: "#000", color: hexStr }}>
              {hexStr} 文字在黑色上
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
