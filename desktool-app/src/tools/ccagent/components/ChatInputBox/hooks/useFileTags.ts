// useFileTags — 文件标签（@file 引用的文件管理）
// 对齐 cc-gui useFileTags

import { useState, useCallback } from "react";

export interface FileTag {
  id: string;
  path: string;
  name: string;
  content?: string;
}

export interface FileTagsState {
  tags: FileTag[];
  addTag: (path: string, name: string, content?: string) => void;
  removeTag: (id: string) => void;
  clearTags: () => void;
  hasTag: (path: string) => boolean;
  getTotalContent: () => string;
}

export function useFileTags(): FileTagsState {
  const [tags, setTags] = useState<FileTag[]>([]);

  const addTag = useCallback((path: string, name: string, content?: string) => {
    setTags(prev => {
      if (prev.some(t => t.path === path)) return prev;
      return [...prev, { id: Math.random().toString(36).slice(2), path, name, content }];
    });
  }, []);

  const removeTag = useCallback((id: string) => {
    setTags(prev => prev.filter(t => t.id !== id));
  }, []);

  const clearTags = useCallback(() => setTags([]), []);

  const hasTag = useCallback((path: string) => tags.some(t => t.path === path), [tags]);

  const getTotalContent = useCallback(() => {
    return tags
      .filter(t => t.content)
      .map(t => `<file path="${t.path}">\n${t.content}\n</file>`)
      .join("\n\n");
  }, [tags]);

  return { tags, addTag, removeTag, clearTags, hasTag, getTotalContent };
}
