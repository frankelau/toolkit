// fileChanges.ts — 文件变更相关类型

export interface EditOperation {
  toolName: string;
  oldString: string;
  newString: string;
  additions: number;
  deletions: number;
  replaceAll?: boolean;
}

export interface FileChangeSummary {
  filePath: string;
  fileName: string;
  status: 'A' | 'M';
  additions: number;
  deletions: number;
  operations: EditOperation[];
}
