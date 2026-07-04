import type { ToolDef } from "./types";
import JsonFormatter from "./JsonFormatter";
import JsonDiff from "./JsonDiff";
import MarkdownTool from "./MarkdownTool";
import FindReplace from "./FindReplace";
import EncodeTool from "./EncodeTool";
import TimeTool from "./TimeTool";
import TimeCalculator from "./TimeCalculator";
import CodeBeautify from "./CodeBeautify";
import HttpClient from "./HttpClient";
import McpTester from "./McpTester";
import BaseConvert from "./BaseConvert";
import ColorTool from "./ColorTool";
import PasswordGen from "./PasswordGen";
import IdGen from "./IdGen";
import QrTool from "./QrTool";
import ImageBase64 from "./ImageBase64";
import SvgToImage from "./SvgToImage";
import LogAnalyzer from "./LogAnalyzer";
import CodeMinify from "./CodeMinify";
import RegexTool from "./RegexTool";
import WebSocketTool from "./WebSocketTool";
import Notes from "./Notes";
import AiChat from "./AiChat";
import CcAgent from "./CcAgent";
import CrontabTool from "./CrontabTool";
import LoanCalc from "./LoanCalc";
import DataMock from "./DataMock";
import CsvConvert from "./CsvConvert";
import ChartTool from "./ChartTool";
import SseAnalyzer from "./SseAnalyzer";
import StreamAnalyzer from "./StreamAnalyzer";
import CarAssistant from "./CarAssistant";
import ScreenCapture from "./ScreenCapture";
import HostConfig from "./HostConfig";
import HttpProxy from "./HttpProxy";
import SwitchHosts from "./SwitchHosts";
import { withMultiTab } from "./MultiTab";

/**
 * 工具注册表。新增功能时在此追加一项即可，导航与多标签会自动接入。
 * id 对应需求文档（桌面工具需求文档.md §4）中的功能编号。
 * storageNs 是该工具持久化键的前缀，需全局唯一。
 */
export const TOOLS: ToolDef[] = [
  {
    id: "F20",
    name: "智能助手",
    desc: "自配 Claude/OpenAI 服务，流式对话",
    category: "ai",
    icon: "🤖",
    storageNs: "ai",
    singleton: true,
    component: AiChat,
  },
  {
    id: "F40",
    name: "CC Agent",
    desc: "Claude Code / Codex CLI 可视化 Agent，自主编辑文件、跑终端",
    category: "ai",
    icon: "🧠",
    storageNs: "ccagent",
    singleton: true,
    component: withMultiTab(CcAgent, "ccagent"),
  },
  {
    id: "F35",
    name: "汽车助手",
    desc: "看车选车买车用车，AI 对话 + 搜索增强",
    category: "ai",
    icon: "🚗",
    storageNs: "car",
    component: CarAssistant,
  },
  {
    id: "F01",
    name: "JSON 美化",
    desc: "格式化、压缩、校验、键排序",
    category: "format",
    icon: "{}",
    storageNs: "json",
    singleton: true,
    component: withMultiTab(JsonFormatter, "json"),
  },
  {
    id: "F02",
    name: "JSON 比对",
    desc: "两个 JSON 键值比对并高亮差异",
    category: "format",
    icon: "⇄",
    storageNs: "jsondiff",
    singleton: true,
    component: withMultiTab(JsonDiff, "jsondiff"),
  },
  {
    id: "F22",
    name: "Markdown",
    desc: "Markdown 编写与实时预览",
    category: "format",
    icon: "M↓",
    storageNs: "md",
    singleton: true,
    component: withMultiTab(MarkdownTool, "md"),
  },
  {
    id: "F03",
    name: "代码美化",
    desc: "JS/CSS/HTML/XML/SQL/JSON 美化",
    category: "format",
    icon: "</>",
    storageNs: "code",
    component: CodeBeautify,
  },
  {
    id: "F04",
    name: "代码压缩",
    desc: "JS/CSS/HTML 代码压缩/混淆",
    category: "format",
    icon: "«»",
    storageNs: "minify",
    component: CodeMinify,
  },
  {
    id: "T01",
    name: "查找替换",
    desc: "字符串查找与替换，支持正则",
    category: "format",
    icon: "🔍",
    storageNs: "fr",
    component: FindReplace,
  },
  {
    id: "T03",
    name: "日志分析",
    desc: "粘贴日志：级别过滤、搜索高亮、统计与异常聚合",
    category: "productivity",
    icon: "📋",
    storageNs: "log",
    singleton: true,
    component: withMultiTab(LogAnalyzer, "log"),
  },
  {
    id: "T04",
    name: "SSE 分析",
    desc: "粘贴 SSE 响应：事件解析、类型统计、增量拼接还原",
    category: "productivity",
    icon: "📡",
    storageNs: "sse",
    singleton: true,
    component: withMultiTab(SseAnalyzer, "sse"),
  },
  {
    id: "T05",
    name: "流式数据分析",
    desc: "粘贴流式/NDJSON 响应：逐行解析、按路径抽取拼接",
    category: "productivity",
    icon: "🌊",
    storageNs: "stream",
    singleton: true,
    component: withMultiTab(StreamAnalyzer, "stream"),
  },
  {
    id: "F21",
    name: "便签笔记",
    desc: "目录分类管理，本地存储，导入导出",
    category: "productivity",
    icon: "📝",
    storageNs: "notes",
    component: Notes,
  },
  {
    id: "F09",
    name: "编码转换",
    desc: "URL/Base64/Unicode/Hex/HTML 编解码",
    category: "encode",
    icon: "⇆",
    storageNs: "encode",
    component: EncodeTool,
  },
  {
    id: "F11",
    name: "时间戳转换",
    desc: "时间与时间戳互转、多时区时钟",
    category: "encode",
    icon: "🕐",
    storageNs: "time",
    component: TimeTool,
  },
  {
    id: "F33",
    name: "时间戳计算器",
    desc: "格式解析、批量转换、时间差与加减计算",
    category: "encode",
    icon: "🧮",
    storageNs: "tcalc",
    component: TimeCalculator,
  },
  {
    id: "F10",
    name: "进制转换",
    desc: "2~36 进制任意互转",
    category: "encode",
    icon: "01",
    storageNs: "base",
    component: BaseConvert,
  },
  {
    id: "F12",
    name: "颜色转换",
    desc: "HEX/RGB/HSL 互转与取色",
    category: "encode",
    icon: "🎨",
    storageNs: "color",
    component: ColorTool,
  },
  {
    id: "F27",
    name: "随机密码",
    desc: "可定制的安全随机密码生成",
    category: "encode",
    icon: "🔑",
    storageNs: "pwd",
    component: PasswordGen,
  },
  {
    id: "F30",
    name: "UUID/ID 生成",
    desc: "UUID/NanoID/雪花 ID 生成与解析",
    category: "encode",
    icon: "🆔",
    storageNs: "idgen",
    component: IdGen,
  },
  {
    id: "F05",
    name: "简易 Postman",
    desc: "HTTP 接口调试，绕过跨域",
    category: "network",
    icon: "⇅",
    storageNs: "http",
    singleton: true,
    component: HttpClient,
  },
  {
    id: "T02",
    name: "MCP 测试",
    desc: "连接 MCP 服务、调用工具",
    category: "ai",
    icon: "🔌",
    storageNs: "mcp",
    singleton: true,
    component: McpTester,
  },
  {
    id: "F06",
    name: "WebSocket",
    desc: "ws/wss 连接测试、消息收发",
    category: "network",
    icon: "🔗",
    storageNs: "ws",
    singleton: true,
    component: WebSocketTool,
  },
  {
    id: "F13",
    name: "二维码生成",
    desc: "文本生成二维码，可调色与下载",
    category: "image",
    icon: "▦",
    storageNs: "qr",
    component: QrTool,
  },
  {
    id: "F14",
    name: "图片转Base64",
    desc: "图片与 Base64 双向转换",
    category: "image",
    icon: "🖼",
    storageNs: "img2b64",
    component: ImageBase64,
  },
  {
    id: "F15",
    name: "SVG转图片",
    desc: "SVG 转 PNG/JPG/WEBP",
    category: "image",
    icon: "◵",
    storageNs: "svg2img",
    component: SvgToImage,
  },
  {
    id: "F07",
    name: "正则速查",
    desc: "常用正则速查表 + 在线测试/替换",
    category: "reference",
    icon: "(.*)",
    storageNs: "regex",
    component: RegexTool,
  },
  {
    id: "F32",
    name: "CSV转JSON",
    desc: "Excel/CSV 转 JSON/XML/SQL/PHP",
    category: "format",
    icon: "⊞",
    storageNs: "csv",
    component: CsvConvert,
  },
  {
    id: "F24",
    name: "数据 Mock",
    desc: "生成测试数据：个人/技术/数值，多格式输出",
    category: "format",
    icon: "🎲",
    storageNs: "mock",
    component: DataMock,
  },
  {
    id: "F16",
    name: "图表制作",
    desc: "柱状/折线/饼图，可导出图片",
    category: "image",
    icon: "📊",
    storageNs: "chart",
    component: ChartTool,
  },
  {
    id: "F25",
    name: "Crontab",
    desc: "Crontab 表达式生成、解析与下次执行预览",
    category: "reference",
    icon: "⏰",
    storageNs: "cron",
    component: CrontabTool,
  },
  {
    id: "F26",
    name: "贷款计算",
    desc: "月供还款计划，支持按月供反推利率",
    category: "reference",
    icon: "💰",
    storageNs: "loan",
    component: LoanCalc,
  },
  {
    id: "F36",
    name: "截图工具",
    desc: "全屏/选区截图、文字识别(OCR)、录屏",
    category: "image",
    icon: "📷",
    storageNs: "screencap",
    singleton: true,
    component: ScreenCapture,
  },
  {
    id: "F37",
    name: "环境管理",
    desc: "管理 dev/prod/staging 等多套接口环境，全局一键切换",
    category: "network",
    icon: "🌐",
    storageNs: "hostconfig",
    singleton: true,
    component: HostConfig,
  },
  {
    id: "F38",
    name: "HTTP 代理",
    desc: "本地 HTTP 代理：域名映射、路径重写、参数注入，支持 H5 联调",
    category: "network",
    icon: "🔀",
    storageNs: "hproxy",
    singleton: true,
    component: HttpProxy,
  },
  {
    id: "F39",
    name: "SwitchHosts",
    desc: "分组管理 /etc/hosts 条目，一键切换本地/测试/生产域名映射",
    category: "network",
    icon: "🗂️",
    storageNs: "switchhosts",
    singleton: true,
    component: SwitchHosts,
  },

];

export const TOOL_MAP = new Map(TOOLS.map((t) => [t.id, t]));
