// useDragSort — 拖拽排序
// 对齐 cc-gui useDragSort

import { useState, useCallback } from "react";

export interface DragSortState {
  draggedId: string | null;
  dragOverId: string | null;
  handleDragStart: (id: string) => (e: React.DragEvent) => void;
  handleDragOver: (id: string) => (e: React.DragEvent) => void;
  handleDragEnd: () => void;
  handleDrop: (id: string) => (e: React.DragEvent) => void;
}

export function useDragSort<T extends { id: string }>(
  items: T[],
  onReorder: (newItems: T[]) => void
): DragSortState {
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  const handleDragStart = useCallback((id: string) => (e: React.DragEvent) => {
    setDraggedId(id);
    e.dataTransfer.effectAllowed = "move";
  }, []);

  const handleDragOver = useCallback((id: string) => (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverId(id);
  }, []);

  const handleDragEnd = useCallback(() => {
    setDraggedId(null);
    setDragOverId(null);
  }, []);

  const handleDrop = useCallback((id: string) => (e: React.DragEvent) => {
    e.preventDefault();
    if (!draggedId || draggedId === id) {
      handleDragEnd();
      return;
    }
    const fromIdx = items.findIndex(i => i.id === draggedId);
    const toIdx = items.findIndex(i => i.id === id);
    if (fromIdx < 0 || toIdx < 0) { handleDragEnd(); return; }
    const newItems = [...items];
    const [moved] = newItems.splice(fromIdx, 1);
    newItems.splice(toIdx, 0, moved);
    onReorder(newItems);
    handleDragEnd();
  }, [draggedId, items, onReorder, handleDragEnd]);

  return { draggedId, dragOverId, handleDragStart, handleDragOver, handleDragEnd, handleDrop };
}
