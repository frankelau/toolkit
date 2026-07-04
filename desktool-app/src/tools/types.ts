import type { ComponentType } from "react";

/** 所有工具组件都会收到的 props */
export interface ToolProps {
  /** 标签实例 id，用于按实例隔离持久化数据 */
  instanceId: string;
}

/** 工具分类，对应需求文档 §4 的功能分类 */
export type ToolCategory =
  | "ai"         // AI 助手
  | "format"     // 数据格式化与转换
  | "encode"     // 编码与计算
  | "network"    // 网络调试
  | "image"      // 图像与可视化
  | "productivity" // 生产力与笔记
  | "reference"; // 参考速查与扩展

export const CATEGORY_LABELS: Record<ToolCategory, string> = {
  ai: "AI 工具",
  format: "格式转换",
  encode: "编码计算",
  network: "网络调试",
  image: "图像处理",
  productivity: "效率工具",
  reference: "参考速查",
};

/** 单个工具的定义。新增功能时往 registry 里加一项即可。 */
export interface ToolDef {
  /** 需求文档编号，如 F01 */
  id: string;
  /** 显示名称 */
  name: string;
  /** 一句话描述 */
  desc: string;
  /** 所属分类 */
  category: ToolCategory;
  /** 图标（emoji 或字符），用于导航 */
  icon: string;
  /** 持久化命名空间前缀（如 "json"）；关闭标签时按 `${ns}:${instanceId}` 清理实例数据 */
  storageNs: string;
  /** true = 全局只允许开一个标签，再次点击侧栏聚焦已有标签 */
  singleton?: boolean;
  /** 工具主体组件 */
  component: ComponentType<ToolProps>;
}
