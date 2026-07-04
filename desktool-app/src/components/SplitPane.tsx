import { useCallback, useRef, type ReactNode } from "react";
import "./SplitPane.css";

interface Props {
  left: ReactNode;
  right: ReactNode;
  /** 左栏占比 0~1 */
  ratio: number;
  onRatioChange: (r: number) => void;
  /** 左栏最小/最大占比 */
  min?: number;
  max?: number;
}

/**
 * 左右可拖拽分隔的两栏布局。
 * 通过监听 pointer 事件实时计算分隔位置占比。
 */
export default function SplitPane({
  left,
  right,
  ratio,
  onRatioChange,
  min = 0.15,
  max = 0.85,
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      const wrap = wrapRef.current;
      if (!wrap) return;

      const move = (ev: PointerEvent) => {
        const rect = wrap.getBoundingClientRect();
        const r = (ev.clientX - rect.left) / rect.width;
        onRatioChange(Math.min(max, Math.max(min, r)));
      };
      const up = () => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    },
    [onRatioChange, min, max],
  );

  return (
    <div className="split" ref={wrapRef}>
      <div className="split-pane" style={{ width: `${ratio * 100}%` }}>
        {left}
      </div>
      <div
        className="split-handle"
        onPointerDown={onPointerDown}
        title="拖动调整宽度"
      >
        <div className="split-grip" />
      </div>
      <div className="split-pane" style={{ width: `${(1 - ratio) * 100}%` }}>
        {right}
      </div>
    </div>
  );
}
