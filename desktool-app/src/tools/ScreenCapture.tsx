import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { openPath } from "@tauri-apps/plugin-opener";
import type { ToolProps } from "./types";
import { toast } from "../useCopyFeedback";
import { saveDataUrlWithDialog } from "../saveFile";
import { stitchFrames } from "./stitchFrames";
import AnnotationCanvas from "./AnnotationCanvas";
import "./ScreenCapture.css";

type Tab = "screenshot" | "scroll" | "record";

export default function ScreenCapture(_: ToolProps) {
  const [tab, setTab] = useState<Tab>("screenshot");
  const [imgSrc, setImgSrc] = useState("");
  const [ocrText, setOcrText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [recPath, setRecPath] = useState("");
  const [frames, setFrames] = useState(8);
  const [scrollImg, setScrollImg] = useState("");
  const [annotating, setAnnotating] = useState(false);
  const [hideWin, setHideWin] = useState(true);

  async function run<T>(fn: () => Promise<T>, onOk: (v: T) => void) {
    setErr(""); setBusy(true);
    try { onOk(await fn()); } catch (e) { setErr(String(e)); } finally { setBusy(false); }
  }

  async function takeShot(interactive: boolean) {
    const win = getCurrentWindow();
    if (hideWin) { await win.hide(); await new Promise(r => setTimeout(r, 250)); }
    try {
      await run(() => invoke<string>("take_screenshot", { interactive }), (src) => {
        setImgSrc(src); setOcrText(""); setAnnotating(true);
      });
    } finally {
      if (hideWin) await win.show();
    }
  }

  const runOcr = () => run(() => invoke<string>("ocr_image"), setOcrText);
  const startRec = () => run(() => invoke<string>("record_screen"), (p) => { setRecPath(p); toast("录制完成", "success"); });
  const startScroll = () => run(async () => {
    const imgs = await invoke<string[]>("scroll_capture", { frames, delayMs: 350 });
    return await stitchFrames(imgs);
  }, (img) => { setScrollImg(img); toast(`已拼接 ${frames} 帧`, "success"); });

  async function saveShot(dataUrl: string) {
    const res = await saveDataUrlWithDialog(dataUrl, "screenshot.png", [{ name: "PNG", extensions: ["png"] }]);
    if (res.saved) toast("已保存到 " + res.path, "success");
    setImgSrc(dataUrl); setAnnotating(false);
  }

  async function saveScroll() {
    if (!scrollImg) return;
    const res = await saveDataUrlWithDialog(scrollImg, "scroll-capture.png", [{ name: "PNG 图片", extensions: ["png"] }]);
    if (res.saved) toast("已保存到 " + res.path, "success");
  }

  function copyOcr() { navigator.clipboard.writeText(ocrText); toast("已复制", "success"); }

  if (annotating && imgSrc) {
    return <AnnotationCanvas src={imgSrc} onClose={() => setAnnotating(false)} onSave={saveShot} />;
  }

  return (
    <div className="sc-root">
      <div className="sc-tabs">
        {(["screenshot", "scroll", "record"] as Tab[]).map((t) => (
          <button key={t} className={tab === t ? "active" : ""} onClick={() => setTab(t)}>
            {t === "screenshot" ? "📷 截图" : t === "scroll" ? "📜 滚动截图" : "🎥 录屏"}
          </button>
        ))}
        <label className="sc-hide-toggle" title="截图前隐藏此窗口">
          <input type="checkbox" checked={hideWin} onChange={e => setHideWin(e.target.checked)} />
          截图前隐藏窗口
        </label>
      </div>

      {tab === "screenshot" && (
        <div className="sc-panel">
          <div className="sc-actions">
            <button onClick={() => takeShot(false)} disabled={busy}>全屏截图</button>
            <button onClick={() => takeShot(true)} disabled={busy}>选区截图</button>
            {imgSrc && <button onClick={runOcr} disabled={busy}>识别文字</button>}
            {imgSrc && <button onClick={() => setAnnotating(true)} disabled={busy}>标注</button>}
          </div>
          {err && <div className="sc-err">{err}</div>}
          {busy && <div className="sc-busy">处理中…</div>}
          {imgSrc && <img className="sc-img" src={imgSrc} alt="截图预览" onClick={() => setAnnotating(true)} style={{ cursor: "pointer" }} title="点击标注" />}
          {ocrText && (
            <div className="sc-ocr-wrap">
              <div className="sc-ocr-header"><span>识别结果</span><button onClick={copyOcr}>复制</button></div>
              <textarea className="sc-ocr" value={ocrText} readOnly />
            </div>
          )}
        </div>
      )}

      {tab === "scroll" && (
        <div className="sc-panel">
          <div className="sc-actions">
            <label className="sc-frames">帧数<input type="number" min={2} max={30} value={frames} onChange={e => setFrames(Math.min(30, Math.max(2, Number(e.target.value) || 2)))} disabled={busy} /></label>
            <button onClick={startScroll} disabled={busy}>{busy ? "捕获中…" : "开始滚动截图"}</button>
            {scrollImg && <button onClick={saveScroll} disabled={busy}>保存长图</button>}
          </div>
          <div className="sc-hint">拖拽选择要捕获的区域，松开后会自动滚动并逐帧截图，再拼接成长图。</div>
          {err && <div className="sc-err">{err}</div>}
          {busy && <div className="sc-busy">捕获并拼接中…</div>}
          {scrollImg && <img className="sc-img" src={scrollImg} alt="滚动长图" />}
        </div>
      )}

      {tab === "record" && (
        <div className="sc-panel">
          <div className="sc-actions">
            <button onClick={startRec} disabled={busy}>{busy ? "⏺ 录制中（点菜单栏停止）…" : "开始录屏"}</button>
          </div>
          {err && <div className="sc-err">{err}</div>}
          {recPath && <div className="sc-rec-result"><span className="sc-rec-path">{recPath}</span><button onClick={() => openPath(recPath)}>打开</button></div>}
        </div>
      )}
    </div>
  );
}
