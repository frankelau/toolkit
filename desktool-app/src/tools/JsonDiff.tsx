import { useMemo } from "react";
import type { ToolProps } from "./types";
import { usePersistentState } from "../storage";
import { openTextFile } from "../openFile";
import DiffTextarea from "../components/DiffTextarea";
import { alignToLines } from "./jsonAlignDiff";
import { compareLines } from "./lineCompare";
import "./JsonDiff.css";

type Parsed = { ok: true; value: unknown } | { ok: false; error: string };

function tryParse(text: string): Parsed {
  if (!text.trim()) return { ok: false, error: "为空" };
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

function removeKeys(obj: unknown, keys: Set<string>): unknown {
  if (Array.isArray(obj)) return obj.map((v) => removeKeys(v, keys));
  if (obj && typeof obj === "object") {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      if (!keys.has(k)) result[k] = removeKeys(v, keys);
    }
    return result;
  }
  return obj;
}

/**
 * F02 JSON 比对工具
 * 编辑与对比合一：两个始终可编辑的框，实时按行高亮差异。
 * 「格式化对齐」按 key 排序并在缺失处插入空行，使左右逐行对齐
 * （忽略 key 顺序）：某侧独有的行=绿，value 不同的行=红。
 */
export default function JsonDiff({ instanceId }: ToolProps) {
  const ns = `jsondiff:${instanceId}`;
  const [left, setLeft] = usePersistentState(`${ns}:left`, "");
  const [right, setRight] = usePersistentState(`${ns}:right`, "");
  const [ignoreCase, setIgnoreCase] = usePersistentState(`${ns}:igc`, false);
  const [ignoreWs, setIgnoreWs] = usePersistentState(`${ns}:igw`, false);
  const [ignoreKeys, setIgnoreKeys] = usePersistentState(`${ns}:igk`, "");

  const pl = useMemo(() => tryParse(left), [left]);
  const pr = useMemo(() => tryParse(right), [right]);

  // 应用忽略 key 过滤
  const ignoreKeySet = useMemo(() => {
    return new Set(ignoreKeys.split(/[,\s]+/).filter(Boolean));
  }, [ignoreKeys]);

  // 过滤掉忽略的 key
  const leftFiltered = useMemo(() => {
    if (ignoreKeySet.size === 0) return left;
    try {
      const obj = JSON.parse(left);
      const filtered = removeKeys(obj, ignoreKeySet);
      return JSON.stringify(filtered, null, 2);
    } catch { return left; }
  }, [left, ignoreKeySet]);

  const rightFiltered = useMemo(() => {
    if (ignoreKeySet.size === 0) return right;
    try {
      const obj = JSON.parse(right);
      const filtered = removeKeys(obj, ignoreKeySet);
      return JSON.stringify(filtered, null, 2);
    } catch { return right; }
  }, [right, ignoreKeySet]);

  // 实时逐行比较高亮
  const { leftTags, rightTags, added, diff } = useMemo(
    () => compareLines(leftFiltered, rightFiltered, { ignoreCase, ignoreWhitespace: ignoreWs }),
    [leftFiltered, rightFiltered, ignoreCase, ignoreWs],
  );

  /** 按 key 对齐：排序 + 插入空行占位，写回两个可编辑框 */
  function alignBoth() {
    if (!pl.ok || !pr.ok) return;
    const { left: l, right: r } = alignToLines(pl.value, pr.value);
    setLeft(l.join("\n"));
    setRight(r.join("\n"));
  }

  async function openLeft() {
    const r = await openTextFile([{ name: "JSON", extensions: ["json", "txt"] }]);
    if (r?.text != null) setLeft(r.text);
  }
  async function openRight() {
    const r = await openTextFile([{ name: "JSON", extensions: ["json", "txt"] }]);
    if (r?.text != null) setRight(r.text);
  }

  const total = added + diff;
  const hasContent = left.trim() !== "" || right.trim() !== "";

  return (
    <div className="jd-tool">
      <div className="jd-toolbar">
        <button
          className="jd-primary"
          onClick={alignBoth}
          disabled={!pl.ok || !pr.ok}
          title="按 key 排序并对齐两侧（忽略 key 顺序），缺失处补空行"
        >
          格式化对齐
        </button>
        <button
          onClick={() => {
            setLeft("");
            setRight("");
          }}
        >
          清空
        </button>
        <button onClick={openLeft} title="打开文件到左侧">📁 左</button>
        <button onClick={openRight} title="打开文件到右侧">📁 右</button>
        <label className="jd-opt">
          <input type="checkbox" checked={ignoreCase} onChange={(e) => setIgnoreCase(e.target.checked)} /> 忽略大小写
        </label>
        <label className="jd-opt">
          <input type="checkbox" checked={ignoreWs} onChange={(e) => setIgnoreWs(e.target.checked)} /> 忽略空白
        </label>
        <input
          className="jd-ignore-keys"
          value={ignoreKeys}
          onChange={(e) => setIgnoreKeys(e.target.value)}
          placeholder="忽略 key（逗号分隔）"
          spellCheck={false}
        />
        <span className="jd-sep" />
        <span className={`jd-valid ${pl.ok ? "ok" : "err"}`}>
          左：{pl.ok ? "合法" : pl.error}
        </span>
        <span className={`jd-valid ${pr.ok ? "ok" : "err"}`}>
          右：{pr.ok ? "合法" : pr.error}
        </span>

        <span className="jd-legend">
          <span className="lg added">仅一侧</span>
          <span className="lg diff">value 不同</span>
        </span>

        {hasContent && (
          <span className="jd-counts">
            {total === 0 ? (
              <span className="c-equal">✓ 一致</span>
            ) : (
              <>
                <span className="c-added">仅一侧 {added}</span>
                <span className="c-removed">不同 {diff}</span>
              </>
            )}
          </span>
        )}
      </div>

      <div className="jd-live">
        <DiffTextarea
          value={left}
          onChange={setLeft}
          tags={leftTags}
          placeholder="左侧 JSON"
        />
        <DiffTextarea
          value={right}
          onChange={setRight}
          tags={rightTags}
          placeholder="右侧 JSON"
        />
      </div>
    </div>
  );
}
