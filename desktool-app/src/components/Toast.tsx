import { useEffect, useState } from "react";
import { onToast, type ToastPayload } from "../toastBus";
import "./Toast.css";

const LIFETIME = 2000;
const MAX = 3;

export default function ToastHost() {
  const [items, setItems] = useState<ToastPayload[]>([]);

  useEffect(() => {
    const ids: ReturnType<typeof setTimeout>[] = [];
    const off = onToast((t) => {
      setItems((prev) => [...prev, t].slice(-MAX));
      ids.push(
        setTimeout(() => {
          setItems((prev) => prev.filter((x) => x.id !== t.id));
        }, LIFETIME),
      );
    });
    return () => {
      off();
      ids.forEach(clearTimeout);
    };
  }, []);

  if (!items.length) return null;
  return (
    <div className="toast-host" role="status" aria-live="polite">
      {items.map((t) => (
        <div key={t.id} className={`toast toast-${t.type}`}>
          {t.message}
        </div>
      ))}
    </div>
  );
}
