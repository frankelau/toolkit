import { useMemo, useState } from "react";
import type { ToolProps } from "./types";
import { usePersistentState } from "../storage";
import { copyText } from "../useCopyFeedback";
import {
  parseStream, getByPath, asText, assemble, assembleWithRules, extractItemText,
  newRule, type StreamRecord, type ExtractRule, type StreamItem,
} from "./streamParse";
import RulesEditor, { type PathPreset } from "./RulesEditor";
import { useResizable } from "./useResizable";
import "./StreamAnalyzer.css";
import LineNumberedArea from "../components/LineNumberedArea";
import DropZone from "../components/DropZone";
import { saveTextWithDialog } from "../saveFile";
import { openTextFile } from "../openFile";

const PATH_PRESETS: PathPreset[] = [
  { label: "OpenAI delta", path: "choices/0/delta/content" },
  { label: "Claude delta", path: "delta/text" },
  { label: "Ollama", path: "response" },
  { label: "整行原文", path: "" },
];

function toItem(r: StreamRecord): StreamItem { return { json: r.json, text: r.raw }; }

export default function StreamAnalyzer({ instanceId }: ToolProps) {
  const ns = `stream:${instanceId}`;
  const [raw, setRaw] = usePersistentState(`${ns}:raw`, "");
  const [path, setPath] = usePersistentState(`${ns}:path`, "choices/0/delta/content");
  const [mode, setMode] = usePersistentState<"simple" | "rules">(`${ns}:mode`, "simple");
  const [rules, setRules] = usePersistentState<ExtractRule[]>(`${ns}:rules`, [{ ...newRule("choices/0/delta/content"), id: "r0" }]);
  const [query, setQuery] = usePersistentState(`${ns}:q`, "");
  const [onlyJson, setOnlyJson] = usePersistentState(`${ns}:oj`, false);
  const [view, setView] = usePersistentState<"assembled" | "records">(`${ns}:view`, "assembled");
  const [showRaw, setShowRaw] = usePersistentState(`${ns}:showraw`, false);
  const [detail, setDetail] = useState<StreamRecord | null>(null);
  const { height, onHandleDown } = useResizable();
  const [rulePresets, setRulePresets] = usePersistentState<{name:string;rules:ExtractRule[]}[]>(`${ns}:rulePresets`, []);
  const [presetSel, setPresetSel] = usePersistentState(`${ns}:presetSel`, "");

  const records = useMemo(() => parseStream(raw), [raw]);
  const items = useMemo(() => records.map(toItem), [records]);
  const jsonCount = useMemo(() => records.filter((r) => r.json !== undefined).length, [records]);
  const doneCount = useMemo(() => records.filter((r) => r.done).length, [records]);
  const badCount = records.length - jsonCount - doneCount;
  const assembled = useMemo(() => (mode === "rules" ? assembleWithRules(items, rules) : assemble(records, path)), [mode, items, rules, records, path]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return records.filter((r) => {
      if (onlyJson && r.json === undefined) return false;
      if (q && !r.raw.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [records, query, onlyJson]);

  function shownValue(r: StreamRecord): string | undefined {
    if (mode === "rules") return extractItemText(toItem(r), rules);
    return path ? (() => { const v = getByPath(r.json, path); return v === undefined ? undefined : asText(v); })() : undefined;
  }

  const renderRecords = filtered.length > 1000 ? filtered.slice(0, 1000) : filtered;

  return (
    <div className="sa-tool">
      <DropZone onText={(_, text) => setRaw(text)} accept=".txt,.log,.ndjson,.jsonl">
        <LineNumberedArea className="sa-input" style={{ height }} value={raw} onChange={setRaw}
          placeholder={"把流式 / 逐行响应粘贴到这里..."}
          spellCheck={false} />
      </DropZone>
      <div className="sa-resize-handle" onMouseDown={onHandleDown} />

      <div className="sa-stats">
        <div className="sa-stat"><span className="sa-num">{records.length}</span><span className="sa-label">总记录</span></div>
        <div className="sa-stat"><span className="sa-num">{jsonCount}</span><span className="sa-label">JSON</span></div>
        {badCount > 0 && <div className="sa-stat"><span className="sa-num sa-bad">{badCount}</span><span className="sa-label">非 JSON</span></div>}
        {doneCount > 0 && <div className="sa-stat"><span className="sa-num">{doneCount}</span><span className="sa-label">[DONE]</span></div>}
        <div className="sa-stat"><span className="sa-num">{assembled.length}</span><span className="sa-label">拼接字符</span></div>
      </div>

      <div className="sa-pathbar">
        <div className="sa-mode">
          <button className={mode === "simple" ? "on" : ""} onClick={() => setMode("simple")}>简单路径</button>
          <button className={mode === "rules" ? "on" : ""} onClick={() => setMode("rules")}>高级规则</button>
        </div>
        {mode === "simple" ? (<>
          <span className="sa-path-label">抽取路径</span>
          <input className="sa-path" value={path} onChange={(e) => setPath(e.target.value)} placeholder="如 choices/0/delta/content（空 = 整行原文）" spellCheck={false} />
          <select className="sa-preset" value="" onChange={(e) => e.target.value !== "" && setPath(e.target.value)}>
            <option value="">预设…</option>
            {PATH_PRESETS.map((p) => <option key={p.label} value={p.path}>{p.label}</option>)}
          </select>
        </>) : <span className="sa-mode-hint">多条规则：先过滤后拼接、按不同条件抽不同字段</span>}
      </div>

      {mode === "rules" && <RulesEditor rules={rules} onChange={setRules} presets={PATH_PRESETS} />}

      {mode === "rules" && (
        <div className="sa-preset-bar">
          <select value={presetSel} onChange={e => {
            setPresetSel(e.target.value);
            const p = rulePresets.find(p => p.name === e.target.value);
            if (p) setRules(p.rules);
          }}>
            <option value="">加载预设...</option>
            {rulePresets.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
          </select>
          <button onClick={() => {
            const name = window.prompt("预设名称");
            if (!name) return;
            setRulePresets(ps => { const out = ps.filter(p => p.name !== name); return [...out, {name, rules}]; });
            setPresetSel(name);
          }}>保存当前</button>
          <button onClick={() => {
            if (!presetSel) return;
            setRulePresets(ps => ps.filter(p => p.name !== presetSel));
            setPresetSel("");
          }} disabled={!presetSel}>删除</button>
          <button onClick={() => saveTextWithDialog(JSON.stringify(rulePresets, null, 2), "rule-presets.json")}>导出 JSON</button>
          <button onClick={async () => {
            const f = await openTextFile();
            if (!f?.text) return;
            try {
              const imported = JSON.parse(f.text) as {name:string;rules:ExtractRule[]}[];
              setRulePresets(ps => {
                const m = new Map(ps.map(p => [p.name, p]));
                for (const p of imported) m.set(p.name, p);
                return [...m.values()];
              });
            } catch { }
          }}>导入 JSON</button>
        </div>
      )}

      <div className="sa-subbar">
        <div className="sa-tabs">
          <button className={view === "assembled" ? "on" : ""} onClick={() => setView("assembled")}>拼接结果</button>
          <button className={view === "records" ? "on" : ""} onClick={() => setView("records")}>记录列表 ({filtered.length})</button>
        </div>
        <span className="sa-spacer" />
        {view === "records" && (<>
          <input className="sa-search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="搜索…" />
          <label className="sa-check"><input type="checkbox" checked={onlyJson} onChange={(e) => setOnlyJson(e.target.checked)} />仅 JSON</label>
          <label className="sa-check"><input type="checkbox" checked={showRaw} onChange={(e) => setShowRaw(e.target.checked)} />显示原文</label>
        </>)}
        {view === "assembled" ? <button onClick={() => copyText(assembled)} disabled={!assembled}>复制</button> : null}
        <button onClick={() => { setRaw(""); setQuery(""); }} disabled={!raw}>清空</button>
      </div>

      <div className="sa-output">
        {records.length === 0 ? <div className="sa-empty">粘贴流式响应后，这里显示分析结果</div>
        : view === "assembled" ? (
          assembled ? <pre className="sa-assembled">{assembled}</pre>
          : <div className="sa-empty">{mode === "rules" ? "当前规则没抽到内容" : <>路径 <code>{path || "(空)"}</code> 没抽到内容</>}</div>
        ) : (
          <div className="sa-events">
            {filtered.length === 0 ? <div className="sa-empty">没有匹配的记录</div>
            : renderRecords.map((r) => {
              const val = showRaw ? undefined : shownValue(r);
              const transformed = !showRaw && val !== undefined;
              return <div key={r.n} className="sa-event" onDoubleClick={() => setDetail(r)}>
                <span className="sa-ev-n">{r.n}</span>
                <span className={`sa-ev-type ${r.done ? "done" : r.json ? "json" : "bad"}`}>{r.done ? "DONE" : r.json ? "JSON" : "TEXT"}</span>
                <span className="sa-ev-data">{transformed ? <span className="sa-ev-extract">{val}</span> : r.raw}</span>
              </div>;
            })}
            {filtered.length > 1000 && <div className="sa-list-cap">仅显示前 1000 条（共 {filtered.length} 条），使用搜索筛选</div>}
          </div>
        )}
      </div>

      {detail && (<div className="sa-overlay" onClick={() => setDetail(null)}>
        <div className="sa-modal" onClick={(e) => e.stopPropagation()}>
          <div className="sa-modal-head">
            <span className={`sa-ev-type ${detail.done ? "done" : detail.json ? "json" : "bad"}`}>{detail.done ? "DONE" : detail.json ? "JSON" : "TEXT"}</span>
            <span className="sa-modal-n">第 {detail.n} 条</span>
            <span className="sa-spacer" />
            <button onClick={() => copyText(detail.raw)}>复制</button>
            <button className="sa-close" onClick={() => setDetail(null)}>✕</button>
          </div>
          <pre className="sa-modal-body">{detail.json !== undefined ? JSON.stringify(detail.json, null, 2) : detail.raw}</pre>
        </div>
      </div>)}
    </div>
  );
}
