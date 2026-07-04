import { useState, type ReactNode } from "react";
import "./DropZone.css";

interface Props {
  onText?: (name: string, text: string) => void;
  onBinary?: (name: string, bytes: Uint8Array) => void;
  accept?: string;
  children: ReactNode;
}

export default function DropZone({ onText, onBinary, accept, children }: Props) {
  const [over, setOver] = useState(false);

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setOver(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    // 只在真正离开容器时才清除（子元素触发不算）
    if (e.currentTarget === e.target) setOver(false);
  }

  async function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setOver(false);
    const file = e.dataTransfer.files[0];
    if (!file) return;
    // accept 简单匹配（如 "image/*" 检查 file.type.startsWith("image/")）
    if (accept && !matchAccept(file.type, accept)) return;

    if (onText) {
      const text = await file.text();
      onText(file.name, text);
    } else if (onBinary) {
      const buf = await file.arrayBuffer();
      onBinary(file.name, new Uint8Array(buf));
    }
  }

  return (
    <div
      className={`drop-zone ${over ? "drop-over" : ""}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {children}
      {over && <div className="drop-overlay">松开导入文件</div>}
    </div>
  );
}

function matchAccept(mimeType: string, accept: string): boolean {
  const patterns = accept.split(",").map((a) => a.trim());
  return patterns.some((p) => {
    if (p.endsWith("/*")) return mimeType.startsWith(p.slice(0, -1));
    return mimeType === p;
  });
}
