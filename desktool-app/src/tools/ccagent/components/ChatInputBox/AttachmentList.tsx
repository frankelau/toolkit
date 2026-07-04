// AttachmentList — 附件缩略图列表（对齐 cc-gui AttachmentList）
// Sprint B: 独立附件预览组件

import type { Attachment } from "../../types";

interface AttachmentListProps {
  attachments: Attachment[];
  onRemove: (index: number) => void;
}

export function AttachmentList({ attachments, onRemove }: AttachmentListProps) {
  if (attachments.length === 0) return null;
  return (
    <div className="cc-attachment-list">
      {attachments.map((a, i) => (
        <div key={i} className="cc-attachment-item">
          <img className="cc-attachment-thumb" src={`data:${a.mimeType};base64,${a.data}`} alt={a.name} />
          <button className="cc-attachment-remove" onClick={() => onRemove(i)} title="移除">×</button>
        </div>
      ))}
    </div>
  );
}
