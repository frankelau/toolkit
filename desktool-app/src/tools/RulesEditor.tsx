import { COND_OP_LABELS, newRule, type CondOp, type ExtractRule } from "./streamParse";

/** 抽取路径预设（供两个分析器复用） */
export interface PathPreset { label: string; path: string; }

interface Props {
  rules: ExtractRule[];
  onChange: (rules: ExtractRule[]) => void;
  /** 抽取/条件字段下拉预设 */
  presets: PathPreset[];
}

/**
 * 抽取规则编辑器。多条规则，每条 =「条件（字段/运算符/值）+ 抽取路径 + 分隔串」。
 * 条目按顺序命中第一条启用且满足条件的规则，按其路径抽取拼接。
 * 支持：先过滤后拼接（条件 + 抽取）、按不同条件抽取不同字段（多条规则）。
 */
export default function RulesEditor({ rules, onChange, presets }: Props) {
  function update(id: string, patch: Partial<ExtractRule>) {
    onChange(rules.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }
  function remove(id: string) {
    onChange(rules.filter((r) => r.id !== id));
  }
  function add() {
    onChange([...rules, newRule()]);
  }
  function move(id: string, dir: -1 | 1) {
    const i = rules.findIndex((r) => r.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= rules.length) return;
    const next = rules.slice();
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  }

  const needsValue = (op: CondOp) => op === "eq" || op === "ne" || op === "contains" || op === "regex";
  const needsField = (op: CondOp) => op !== "any";

  return (
    <div className="sa-rules">
      <div className="sa-rules-hint">
        从上到下匹配，每条记录命中<b>第一条</b>满足条件的规则并按其路径抽取。可实现先过滤后拼接、按不同条件抽不同字段。
      </div>
      {rules.map((r, idx) => (
        <div key={r.id} className={`sa-rule ${r.enabled ? "" : "off"}`}>
          <div className="sa-rule-line">
            <input
              type="checkbox"
              checked={r.enabled}
              title="启用/停用"
              onChange={(e) => update(r.id, { enabled: e.target.checked })}
            />
            <span className="sa-rule-no">#{idx + 1}</span>
            <span className="sa-rule-tag">当</span>
            {needsField(r.condOp) ? (
              <input
                className="sa-rule-field"
                value={r.condField}
                placeholder='条件字段（空=原文, $event=事件名）'
                onChange={(e) => update(r.id, { condField: e.target.value })}
                spellCheck={false}
              />
            ) : (
              <span className="sa-rule-mute">所有记录</span>
            )}
            <select
              className="sa-rule-op"
              value={r.condOp}
              onChange={(e) => update(r.id, { condOp: e.target.value as CondOp })}
            >
              {(Object.keys(COND_OP_LABELS) as CondOp[]).map((op) => (
                <option key={op} value={op}>{COND_OP_LABELS[op]}</option>
              ))}
            </select>
            {needsValue(r.condOp) && (
              <input
                className="sa-rule-val"
                value={r.condValue}
                placeholder="比较值"
                onChange={(e) => update(r.id, { condValue: e.target.value })}
                spellCheck={false}
              />
            )}
          </div>
          <div className="sa-rule-line">
            <span className="sa-rule-tag">抽取</span>
            <input
              className="sa-rule-field"
              value={r.extractPath}
              placeholder="抽取路径（空=原文）"
              onChange={(e) => update(r.id, { extractPath: e.target.value })}
              spellCheck={false}
            />
            <select
              className="sa-rule-preset"
              value=""
              onChange={(e) => e.target.value !== "" && update(r.id, { extractPath: e.target.value })}
            >
              <option value="">预设…</option>
              {presets.map((p) => <option key={p.label} value={p.path}>{p.label}</option>)}
            </select>
            <input
              className="sa-rule-sep"
              value={r.sep ?? ""}
              placeholder="分隔串(可空, 支持\n)"
              onChange={(e) => update(r.id, { sep: e.target.value })}
              spellCheck={false}
            />
            <span className="sa-spacer" />
            <button className="sa-rule-mini" title="上移" disabled={idx === 0} onClick={() => move(r.id, -1)}>↑</button>
            <button className="sa-rule-mini" title="下移" disabled={idx === rules.length - 1} onClick={() => move(r.id, 1)}>↓</button>
            <button className="sa-rule-mini" title="删除" disabled={rules.length <= 1} onClick={() => remove(r.id)}>✕</button>
          </div>
        </div>
      ))}
      <button className="sa-rule-add" onClick={add}>+ 添加规则</button>
    </div>
  );
}
