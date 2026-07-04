// dependency.ts — 依赖检查类型

export interface DependencyInfo {
  name: string;
  path: string | null;
  version: string | null;
  installed: boolean;
}
