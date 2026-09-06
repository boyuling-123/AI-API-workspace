import type { ArchiveSummary } from "./localArchive";

export const PLATFORM_ACTION_NAMES = ["get_platform_capabilities", "get_archive_summary"] as const;
export type PlatformActionName = typeof PLATFORM_ACTION_NAMES[number];

export const PLATFORM_ACTIONS = [
  { name: "get_platform_capabilities", title: "查询平台能力", description: "列出当前已开放的只读工具及明确不支持的操作，不读取业务数据。" },
  { name: "get_archive_summary", title: "读取归档统计", description: "核对已配置的本机历史索引，仅返回统计和来源声明，不返回正文、路径或原始 ID。" },
] as const;

export const ACTION_LIMITS = [
  "仅开放两项只读工具，不启动模型或评价。",
  "不接收文件路径、原始数据、标准答案或密钥。",
  "不读取浏览器项目，不写入、删除或迁移数据。",
  "观测页已验证真实 LangGraph 调度固定 Mock 节点；模型调用为 0，不代表任意用户 Agent 或框架已兼容。",
  "本平台观测 JSON 回读仅用于查看；外部文件来源未认证，不证明现场执行，也不会重放 Agent。",
  "外部 MCP 宿主可能将统计送给其模型；本工具不控制宿主的数据策略。",
] as const;

export const ACTION_ERRORS = {
  INVALID_ACTION: "不支持的操作或参数。当前工具只接受空参数对象。",
  LOCAL_ONLY: "仅允许从本机同源工作台调用只读工具。",
  NOT_CONFIGURED: "尚未配置本地历史归档。请先按接入文档连接本机目录，再重试。",
  ARCHIVE_UNAVAILABLE: "归档未能完成核对。请检查本机配置和源文件；没有修改任何数据。",
  SERVICE_UNAVAILABLE: "工具服务暂不可用，请检查本机服务后重试。",
} as const;
export type ActionErrorCode = keyof typeof ACTION_ERRORS;

export type PlatformActionResult =
  | { action: "get_platform_capabilities"; schemaVersion: 1; tools: typeof PLATFORM_ACTIONS; limits: typeof ACTION_LIMITS; transport: "stdio"; modelCalls: 0 }
  | { action: "get_archive_summary"; schemaVersion: 1; summary: ArchiveSummary; scope: "local-read-only-archive"; modelCalls: 0; definitions: { totalRecords: string; uniqueRecordIds: string; provenance: string } };

export type PlatformActionResponse = { ok: true; data: PlatformActionResult }
  | { ok: false; code: ActionErrorCode; error: string };
