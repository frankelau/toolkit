import type { AgentTool, SubagentDef, ServiceConfig, AgentLoopRequest, AgentLoopResult } from "./types";
import { runAgentLoop } from "./agentLoop";

/** 内置子代理 */
export const BUILTIN_SUBAGENTS: SubagentDef[] = [
  {
    id: "researcher",
    name: "搜索研究员",
    description: "专门负责搜索车辆信息、口碑、评测、新闻。当需要查找最新车辆资讯时委派给此代理。",
    systemPrompt: "你是一个汽车信息搜索专家。你的任务是使用搜索工具查找车辆相关信息，并整理成结构化的摘要返回。搜索结果要标注来源链接。",
    allowedTools: ["free_web_search", "free_image_search", "web_fetch"],
  },
  {
    id: "used_car_appraiser",
    name: "二手车鉴定师",
    description: "评估二手车价值、识别风险、给出购买建议。当用户询问二手车估价或车况评估时委派给此代理。",
    systemPrompt: "你是一位资深二手车鉴定师，拥有丰富的车辆评估经验。根据用户提供的信息（车型、年份、里程、车况等），给出估值范围、风险提示和购买建议。",
    allowedTools: ["free_web_search", "calculate"],
  },
  {
    id: "insurance_calculator",
    name: "保险计算器",
    description: "计算车险保费、对比保险方案。当用户询问保险费用或方案对比时委派给此代理。",
    systemPrompt: "你是一个车险专家。根据车辆信息和用户需求，计算保费、对比不同保险方案，给出性价比建议。保费计算可以使用 calculate 工具。",
    allowedTools: ["calculate", "free_web_search"],
  },
];

/** 创建子代理工具（注册到主 Agent 的工具列表） */
export function createSubagentTool(
  subagents: SubagentDef[],
  svc: ServiceConfig,
  allTools: AgentTool[],
): AgentTool {
  return {
    id: "local:delegate_to_subagent",
    name: "delegate_to_subagent",
    description: `将任务委派给专业子代理。可选子代理：\n${subagents.map(s => `- ${s.name}: ${s.description}`).join("\n")}`,
    inputSchema: {
      type: "object",
      properties: {
        subagent: {
          type: "string",
          description: `子代理名称，可选：${subagents.map(s => s.name).join(", ")}`,
        },
        task: {
          type: "string",
          description: "委派给子代理的任务描述",
        },
      },
      required: ["subagent", "task"],
    },
    source: "local",
    execute: async (args: Record<string, unknown>) => {
      const subagentName = String(args.subagent || "");
      const task = String(args.task || "");
      const sub = subagents.find(s => s.name === subagentName || s.id === subagentName);
      if (!sub) {
        return { text: `子代理「${subagentName}」不存在。可用：${subagents.map(s => s.name).join(", ")}` };
      }

      // 过滤工具：只允许子代理使用 allowedTools 中的工具
      const subTools = allTools.filter(t => sub.allowedTools.includes(t.name));

      // 子代理的 Service 配置（覆盖 systemPrompt 和可选 model）
      const subSvc: ServiceConfig = {
        ...svc,
        systemPrompt: sub.systemPrompt,
        model: sub.model || svc.model,
      };

      const loopReq: AgentLoopRequest = {
        service: subSvc,
        messages: [{ role: "user", content: task }],
        tools: subTools,
        callbacks: {
          onToken: () => {}, // 子代理不流式输出到 UI
          onToolStart: () => {},
          onToolEnd: () => {},
        },
        maxRounds: 8,
      };

      try {
        const result: AgentLoopResult = await runAgentLoop(loopReq);
        return { text: `子代理「${sub.name}」的回复：\n\n${result.text}` };
      } catch (e) {
        return { text: `子代理执行失败：${e instanceof Error ? e.message : String(e)}` };
      }
    },
  };
}

/** 获取所有子代理（内置 + 自定义） */
export function getAllSubagents(custom: SubagentDef[] = []): SubagentDef[] {
  const map = new Map<string, SubagentDef>();
  for (const s of BUILTIN_SUBAGENTS) map.set(s.id, s);
  for (const s of custom) map.set(s.id, s);
  return Array.from(map.values());
}
