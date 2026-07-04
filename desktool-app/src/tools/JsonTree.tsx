import { useState } from "react";
import { copyText } from "../useCopyFeedback";
import "./JsonTree.css";

interface Props {
  data: unknown;
  /** 字号缩放倍数 */
  fontScale?: number;
}

type Json = unknown;

function isObj(v: Json): v is Record<string, Json> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

/** 可折叠 JSON 树查看器，节点可收起、可复制 */
export default function JsonTree({ data, fontScale = 1 }: Props) {
  const [version, setVersion] = useState(0);
  const [defaultOpen, setDefaultOpen] = useState<boolean | undefined>(true);

  function expandAll() { setDefaultOpen(true); setVersion((v) => v + 1); }
  function collapseAll() { setDefaultOpen(false); setVersion((v) => v + 1); }

  return (
    <div className="jt-root" style={{ fontSize: `${13 * fontScale}px` }}>
      <div className="jt-header">
        <button className="jt-hbtn" onClick={expandAll}>展开全部</button>
        <button className="jt-hbtn" onClick={collapseAll}>收缩全部</button>
      </div>
      <Node key={version} value={data} name={null} depth={0} isLast defaultOpen={defaultOpen} path="$" />
    </div>
  );
}

function Node({
  value,
  name,
  depth,
  isLast,
  defaultOpen,
  path = "",
}: {
  value: Json;
  name: string | null;
  depth: number;
  isLast: boolean;
  defaultOpen?: boolean;
  path?: string;
}) {
  const [open, setOpen] = useState(defaultOpen !== undefined ? defaultOpen : depth < 2);

  const container = Array.isArray(value) || isObj(value);
  const keyPart =
    name !== null ? <span className="jt-key">"{name}"</span> : null;
  const colon = name !== null ? <span className="jt-punc">: </span> : null;
  const comma = !isLast ? <span className="jt-punc">,</span> : null;

  function copyNode(e: React.MouseEvent) {
    e.stopPropagation();
    if (typeof value === "string") {
      copyText(value);
    } else if (value === null || typeof value === "number" || typeof value === "boolean") {
      copyText(String(value));
    } else {
      copyText(JSON.stringify(value, null, 2));
    }
  }

  function copyPath(e: React.MouseEvent) {
    e.stopPropagation();
    copyText(path || "$", "已复制 JSONPath");
  }

  if (!container) {
    return (
      <div className="jt-line" style={{ paddingLeft: depth * 16 }}>
        {keyPart}
        {colon}
        <Scalar value={value} />
        {comma}
        <button className="jt-copy" onClick={copyNode} title="复制此值">
          ⧉
        </button>
        <button className="jt-copy jt-copy-path" onClick={copyPath} title="复制 JSONPath">
          ⊕
        </button>
      </div>
    );
  }

  const entries: [string | number, Json][] = Array.isArray(value)
    ? value.map((v, idx) => [idx, v])
    : Object.entries(value as Record<string, Json>);
  const openCh = Array.isArray(value) ? "[" : "{";
  const closeCh = Array.isArray(value) ? "]" : "}";

  return (
    <div className="jt-node">
      <div
        className="jt-line jt-clickable"
        style={{ paddingLeft: depth * 16 }}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="jt-toggle">{open ? "▾" : "▸"}</span>
        {keyPart}
        {colon}
        <span className="jt-punc">{openCh}</span>
        {!open && (
          <span className="jt-collapsed">
            … {entries.length} {Array.isArray(value) ? "项" : "键"} {closeCh}
          </span>
        )}
        {comma && !open ? comma : null}
        <button className="jt-copy" onClick={copyNode} title="复制此节点">
          ⧉
        </button>
        <button className="jt-copy jt-copy-path" onClick={copyPath} title="复制 JSONPath">
          ⊕
        </button>
      </div>
      {open && (
        <>
          {entries.map(([k, v], idx) => {
            const childPath = Array.isArray(value)
              ? `${path}[${k}]`
              : `${path}${/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(String(k)) ? "." + k : `["${k}"]`}`;
            return (
              <Node
                key={k}
                value={v}
                name={Array.isArray(value) ? null : String(k)}
                depth={depth + 1}
                isLast={idx === entries.length - 1}
                defaultOpen={defaultOpen}
                path={childPath}
              />
            );
          })}
          <div className="jt-line" style={{ paddingLeft: depth * 16 }}>
            <span className="jt-punc">{closeCh}</span>
            {comma}
          </div>
        </>
      )}
    </div>
  );
}

const IMG_EXT = /\.(jpe?g|png|gif|webp|svg|bmp)(\?.*)?$/i;

function isUrl(s: string) {
  return s.startsWith("http://") || s.startsWith("https://");
}

function Scalar({ value }: { value: Json }) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);

  if (value === null) return <span className="jt-null">null</span>;
  if (typeof value === "boolean") return <span className="jt-bool">{String(value)}</span>;
  if (typeof value === "number") return <span className="jt-num">{String(value)}</span>;
  if (typeof value === "string") {
    if (isUrl(value)) {
      const isImg = IMG_EXT.test(value.split("?")[0]);
      return (
        <>
          <a
            className="jt-link"
            href={value}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            onMouseEnter={isImg ? (e) => setPos({ x: e.clientX, y: e.clientY }) : undefined}
            onMouseMove={isImg ? (e) => setPos({ x: e.clientX, y: e.clientY }) : undefined}
            onMouseLeave={isImg ? () => setPos(null) : undefined}
          >
            "{value}"
          </a>
          {isImg && pos && (
            <div className="jt-img-preview" style={{ left: pos.x + 16, top: pos.y + 16 }}>
              <img src={value} alt="" />
            </div>
          )}
        </>
      );
    }
    return <span className="jt-str">"{value}"</span>;
  }
  return <span>{String(value)}</span>;
}
