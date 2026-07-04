import { useMemo } from "react";
import type { ToolProps } from "./types";
import { usePersistentState } from "../storage";
import { copyText, toast } from "../useCopyFeedback";
import { saveTextWithDialog } from "../saveFile";
import { makeRng, idCardChecksum } from "./seededRandom";
import "./DataMock.css";
import LineNumberedArea from "../components/LineNumberedArea";

type FieldType =
  | "name" | "firstName" | "lastName" | "email" | "phone" | "mobile"
  | "idCard" | "address" | "company"
  | "uuid" | "ip" | "ipv6" | "mac" | "md5" | "sha1"
  | "int" | "float" | "bool" | "date" | "datetime" | "timestamp"
  | "color" | "url" | "lorem";

type OutputFmt = "json" | "csv" | "sql";

const FIELD_TYPES: { id: FieldType; label: string; category: string }[] = [
  { id: "name",      label: "姓名",     category: "个人" },
  { id: "firstName", label: "名",       category: "个人" },
  { id: "lastName",  label: "姓",       category: "个人" },
  { id: "email",     label: "邮箱",     category: "个人" },
  { id: "mobile",    label: "手机号",   category: "个人" },
  { id: "phone",     label: "电话",     category: "个人" },
  { id: "idCard",    label: "身份证",   category: "个人" },
  { id: "address",   label: "地址",     category: "个人" },
  { id: "company",   label: "公司",     category: "商业" },
  { id: "uuid",      label: "UUID",     category: "技术" },
  { id: "ip",        label: "IPv4",     category: "技术" },
  { id: "ipv6",      label: "IPv6",     category: "技术" },
  { id: "mac",       label: "MAC",      category: "技术" },
  { id: "md5",       label: "MD5",      category: "技术" },
  { id: "sha1",      label: "SHA1",     category: "技术" },
  { id: "int",       label: "整数",     category: "数值" },
  { id: "float",     label: "浮点数",   category: "数值" },
  { id: "bool",      label: "布尔值",   category: "数值" },
  { id: "date",      label: "日期",     category: "时间" },
  { id: "datetime",  label: "日期时间", category: "时间" },
  { id: "timestamp", label: "时间戳",   category: "时间" },
  { id: "color",     label: "颜色HEX",  category: "其他" },
  { id: "url",       label: "URL",      category: "其他" },
  { id: "lorem",     label: "Lorem",    category: "其他" },
];

const SURNAMES = "赵钱孙李周吴郑王冯陈褚卫蒋沈韩杨朱秦尤许何吕施张孔曹严华金魏陶姜谢邹喻柏水窦章云苏潘葛奚范彭郎鲁韦昌马苗凤花方俞任袁柳酆鲍史唐费廉岑薛雷贺倪汤滕殷罗毕郝邬安常乐于时傅皮齐康伍余元卜顾孟平黄".split("");
const GIVEN = "伟芳娜秀英华慧巧美娟英华慧巧美娟秀娜芳伟刚勇毅俊峰强军平保东文辉力明永健世广志义兴良海山仁波宁贵福生龙元全国胜学祥才发武新利清飞彬富顺信子杰涛昌成康星光天达安岩中茂进林有坚和彪博诚先敬震振壮会思群豪心邦承乐绍功松善厚庆磊民友裕河哲江超浩亮政谦亨奇固之轮翰朗伯宏言若鸣朋斌梁栋维启克伦翔旭鹏泽晨辰士以建家致树炎德行时泰盛雄琛钧冠策腾楠榕风航弘".split("");
const CITIES = ["北京","上海","广州","深圳","杭州","成都","武汉","西安","南京","重庆","苏州","天津","长沙","青岛","郑州","东莞","沈阳","宁波","昆明","大连"];
const STREETS = ["中山路","解放路","建国路","人民路","长安街","和平路","文化路","朝阳路","幸福路","科技路"];
const COMPANIES = ["腾讯","阿里巴巴","华为","百度","字节跳动","美团","京东","网易","滴滴","小米","联想","中国移动","中国电信","中国联通","工商银行","建设银行","农业银行","招商银行"];
const LOREM = "Lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua".split(" ");

const rnd = (rng: () => number, a: number, b: number) => Math.floor(rng() * (b - a + 1)) + a;
const pick = <T,>(rng: () => number, arr: T[]): T => arr[Math.floor(rng() * arr.length)];
const hex2 = (rng: () => number) => Math.floor(rng() * 256).toString(16).padStart(2, "0");
const randHex = (rng: () => number, n: number) => Array.from({ length: n }, () => Math.floor(rng() * 16).toString(16)).join("");

// UUID uses crypto by design — not seeded (UUID is not reproducible by spec)
function uuidV4() {
  const a = new Uint8Array(16); crypto.getRandomValues(a);
  a[6] = (a[6] & 0x0f) | 0x40; a[8] = (a[8] & 0x3f) | 0x80;
  const h = (b: number) => b.toString(16).padStart(2, "0");
  return `${h(a[0])}${h(a[1])}${h(a[2])}${h(a[3])}-${h(a[4])}${h(a[5])}-${h(a[6])}${h(a[7])}-${h(a[8])}${h(a[9])}-${h(a[10])}${h(a[11])}${h(a[12])}${h(a[13])}${h(a[14])}${h(a[15])}`;
}

interface Field { key: string; type: FieldType; min?: number; max?: number; }

function generate(type: FieldType, rng: () => number, field?: Field): string | number | boolean {
  switch (type) {
    case "lastName":  return pick(rng, SURNAMES);
    case "firstName": return `${pick(rng, GIVEN)}${rng() > 0.5 ? pick(rng, GIVEN) : ""}`;
    case "name":      return `${pick(rng, SURNAMES)}${pick(rng, GIVEN)}${rng() > 0.5 ? pick(rng, GIVEN) : ""}`;
    case "email":     return `${randHex(rng, 6)}@${pick(rng, ["example","test","mock","demo"])}.${pick(rng, ["com","net","org","cn"])}`;
    case "mobile":    return `1${pick(rng, ["3","4","5","6","7","8","9"])}${Array.from({length:9},()=>rnd(rng,0,9)).join("")}`;
    case "phone":     return `0${rnd(rng,10,99)}-${rnd(rng,10000000,99999999)}`;
    case "idCard":    {
      const d = `${rnd(rng,1960,2000)}${String(rnd(rng,1,12)).padStart(2,"0")}${String(rnd(rng,1,28)).padStart(2,"0")}`;
      const body = `${rnd(rng,100000,999999)}${d}${String(rnd(rng,0,999)).padStart(3,"0")}`;
      return body + idCardChecksum(body);
    }
    case "address":   return `${pick(rng, CITIES)}市${pick(rng, STREETS)}${rnd(rng,1,999)}号`;
    case "company":   return `${pick(rng, CITIES)}${pick(rng, COMPANIES)}${pick(rng, ["科技","网络","信息","数字"])}有限公司`;
    case "uuid":      return uuidV4();
    case "ip":        return `${rnd(rng,1,254)}.${rnd(rng,0,255)}.${rnd(rng,0,255)}.${rnd(rng,1,254)}`;
    case "ipv6":      return Array.from({length:8},()=>randHex(rng,4)).join(":");
    case "mac":       return Array.from({length:6},()=>hex2(rng)).join(":");
    case "md5":       return randHex(rng, 32);
    case "sha1":      return randHex(rng, 40);
    case "int":       { const lo = field?.min ?? -100000; const hi = field?.max ?? 100000; return rnd(rng, lo, hi); }
    case "float":     { const lo = field?.min ?? 0; const hi = field?.max ?? 10000; return parseFloat((rng() * (hi - lo) + lo).toFixed(4)); }
    case "bool":      return rng() > 0.5;
    // date/datetime/timestamp are relative to Date.now() at call time — NOT fully seed-reproducible
    // across runs (same caveat as uuid via crypto.getRandomValues above).
    case "date":      { const d = new Date(Date.now() - rnd(rng,0,10) * 365 * 86400000); return d.toISOString().slice(0,10); }
    case "datetime":  { const d = new Date(Date.now() - rnd(rng,0,5) * 365 * 86400000); return d.toISOString().replace("T"," ").slice(0,19); }
    case "timestamp": return Math.floor((Date.now() - rnd(rng,0,1e9)) / 1000);
    case "color":     return `#${hex2(rng)}${hex2(rng)}${hex2(rng)}`;
    case "url":       return `https://${randHex(rng,6)}.${pick(rng,["example","test","mock","demo"])}.com/${randHex(rng,4)}`;
    case "lorem":     return LOREM.slice(0, rnd(rng,5,12)).join(" ");
    default:          return "";
  }
}

/** F24 数据 Mock */
export default function DataMock({ instanceId }: ToolProps) {
  const ns = `mock:${instanceId}`;
  const [fields, setFields] = usePersistentState<Field[]>(`${ns}:fields`, [
    { key: "id", type: "int" }, { key: "name", type: "name" }, { key: "email", type: "email" }, { key: "phone", type: "mobile" },
  ]);
  const [count, setCount] = usePersistentState(`${ns}:count`, 10);
  const [fmt, setFmt] = usePersistentState<OutputFmt>(`${ns}:fmt`, "json");
  const [tableName, setTableName] = usePersistentState(`${ns}:table`, "users");
  const [seed, setSeed] = usePersistentState(`${ns}:seed`, 1);
  const [templates, setTemplates] = usePersistentState<Record<string, Field[]>>(`${ns}:tpl`, {});

  const output = useMemo(() => {
    const rng = makeRng(seed || 1);
    const rows = Array.from({ length: count }, () =>
      Object.fromEntries(fields.map((f) => [f.key || f.type, generate(f.type, rng, f)]))
    );
    if (fmt === "json") return JSON.stringify(rows, null, 2);
    if (fmt === "csv") {
      const keys = fields.map((f) => f.key || f.type);
      return [keys.join(","), ...rows.map((r) => keys.map((k) => JSON.stringify(r[k])).join(","))].join("\n");
    }
    // SQL INSERT
    const keys = fields.map((f) => f.key || f.type);
    const vals = rows.map((r) =>
      `(${keys.map((k) => { const v = r[k]; return typeof v === "string" ? `'${v.replace(/'/g, "''")}'` : String(v); }).join(", ")})`
    ).join(",\n  ");
    return `INSERT INTO \`${tableName}\` (\`${keys.join("`, `")}\`) VALUES\n  ${vals};`;
  }, [fields, count, fmt, tableName, seed]);

  function addField() {
    setFields((fs) => [...fs, { key: `field${fs.length + 1}`, type: "int" }]);
  }
  function updateField(i: number, patch: Partial<Field>) {
    setFields((fs) => fs.map((f, idx) => idx === i ? { ...f, ...patch } : f));
  }
  function removeField(i: number) {
    setFields((fs) => fs.filter((_, idx) => idx !== i));
  }

  async function exportOutput() {
    if (!output) return;
    const fileName = fmt === "json" ? "mock.json" : fmt === "csv" ? "mock.csv" : "mock.sql";
    const res = await saveTextWithDialog(output, fileName);
    if (res.saved) toast("已保存到 " + res.path, "success");
  }

  function saveTemplate() {
    const name = prompt("模板名称");
    if (!name) return;
    setTemplates((t) => ({ ...t, [name]: fields }));
  }

  function loadTemplate(name: string) {
    if (templates[name]) setFields(templates[name]);
  }

  const tplNames = Object.keys(templates);

  return (
    <div className="dm-tool">
      <div className="dm-config">
        <div className="dm-fields">
          {fields.map((f, i) => (
            <div key={i} className="dm-field-row">
              <input className="dm-key" value={f.key} onChange={(e) => updateField(i, { key: e.target.value })} placeholder="字段名" />
              <select value={f.type} onChange={(e) => updateField(i, { type: e.target.value as FieldType })}>
                {FIELD_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
              {(f.type === "int" || f.type === "float") && (
                <>
                  <input className="dm-range" type="number" placeholder="min" value={f.min ?? ""} onChange={(e) => updateField(i, { min: e.target.value === "" ? undefined : Number(e.target.value) })} />
                  <input className="dm-range" type="number" placeholder="max" value={f.max ?? ""} onChange={(e) => updateField(i, { max: e.target.value === "" ? undefined : Number(e.target.value) })} />
                </>
              )}
              <button onClick={() => removeField(i)}>×</button>
            </div>
          ))}
          <button className="dm-add" onClick={addField}>+ 添加字段</button>
        </div>

        <div className="dm-opts">
          <label>条数<input type="number" min={1} max={1000} value={count} onChange={(e) => setCount(Math.min(1000, Number(e.target.value)))} /></label>
          <label>格式
            <select value={fmt} onChange={(e) => setFmt(e.target.value as OutputFmt)}>
              <option value="json">JSON</option>
              <option value="csv">CSV</option>
              <option value="sql">SQL INSERT</option>
            </select>
          </label>
          {fmt === "sql" && <label>表名<input value={tableName} onChange={(e) => setTableName(e.target.value)} /></label>}
          <label>种子
            <div className="dm-seed-row">
              <input type="number" value={seed} onChange={(e) => setSeed(Number(e.target.value))} />
              <button title="随机种子" onClick={() => setSeed(Math.floor(Math.random() * 1e9))}>🎲</button>
            </div>
          </label>
          {tplNames.length > 0 && (
            <label>模板
              <select defaultValue="" onChange={(e) => { if (e.target.value) loadTemplate(e.target.value); }}>
                <option value="">— 载入模板 —</option>
                {tplNames.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
          )}
          <button className="dm-gen" onClick={() => setSeed(Math.floor(Math.random() * 1e9))}>重新生成</button>
          <button onClick={saveTemplate}>保存模板</button>
          <button onClick={() => copyText(output)} disabled={!output}>复制</button>
          <button onClick={exportOutput} disabled={!output}>💾 导出</button>
        </div>
      </div>

      <LineNumberedArea className="dm-output" value={output} readOnly spellCheck={false} />
    </div>
  );
}
