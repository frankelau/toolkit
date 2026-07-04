import type { ReactNode } from "react";
import "./EmptyHint.css";

interface Props {
  visible: boolean;
  children: ReactNode;
}

export default function EmptyHint({ visible, children }: Props) {
  if (!visible) return null;
  return <div className="empty-hint">{children}</div>;
}
