export const SCHEMA_VERSION = 8;

/** 内容模式：文本 / 生图。与 RunMode 正交，各自维护独立草稿。 */
export type ContentMode = "text" | "image";

/** 运行模式：单条 / 批量。与 ContentMode 正交。 */
export type RunMode = "single" | "batch";

/**
 * 统一目标类型（v4.8 重构核心）：
 * - 'base-model'：基础大模型，作为平台 AI 能力的驱动源（Agent、裁判、生成器等）。
 * - 'target'：被测算法接口或第三方服务，是测评的对象。
 */
export type ModelKind = "base-model" | "target";
export type BaseModelProtocol = "auto" | "openai" | "anthropic";

/**
 * 内容能力标签（置灰/筛选依据），与可用性 status 独立两维。
 * - 'text'       纯文本：只接文字、出文字。
 * - 'multimodal' 多模态：能看图（图片输入）+ 出文字。注意：不生图。
 * - 'image'      生图：输出图片。只有这一类进生图模式、算生图费用。
 */
export type ContentKind = "text" | "multimodal" | "image";

export interface Project {
  id: string;
  version: number;
  name: string;
  createTime: number;
  updateTime: number;
  /** 所有模型/接口接入项（含 base-model 和 target）统一存这里。 */
  endpoints: ModelEndpoint[];
  tasks: Task[];
  /**
   * 所有历史评价（v4.3 板块⑤唯一数据来源）。
   * ④ 评价完成后追加一条 EvaluationRecord，⑤ 从此列表读取。同一 Task 可被多次评价、独立留存不覆盖。
   */
  evaluations: EvaluationRecord[];
}

/**
 * 统一模型/接口接入项（v4.8 核心数据模型）。
 * 区分“基础大模型”与“被测接口”，是所有 AI 场景过滤和调用的基石。
 */
export interface ModelEndpoint {
  id: string;
  name: string;
  kind: ModelKind; // 'base-model' | 'target'
  capability: ContentKind; // 'text' | 'multimodal' | 'image'
  supportsToolUse?: boolean; // 是否支持 function calling (仅 base-model 有意义)
  
  // base-model 专用字段（v4.8 方案1：key 明文存 IndexedDB，随请求传后端）
  baseUrl?: string;
  /** 明文 API Key，仅存本地 IndexedDB，绝不写入代码库；调用时随请求传给本地后端。 */
  apiKey?: string;
  modelName?: string;
  /** 基础大模型协议：auto 自动探测，或显式指定 OpenAI / Anthropic。 */
  protocol?: BaseModelProtocol;

  // target 专用字段（沿用原 TargetConfig 的部分逻辑）
  type?: "custom" | "comfyui";
  inputParams?: ParamDef[];
  requestTemplate?: RequestTemplate;
  script?: ScriptConfig;
  comfyui?: ComfyuiConfig;
  /** target 接入若需鉴权，仍用引用名（服务端 .env.local 注入），与 base-model 的明文 key 区分。 */
  apiKeyRef?: string;

  // ---- 兼容旧代码的别名 / 冗余字段 ----
  /** capability 的旧名（部分旧组件仍读此字段），与 capability 保持同值。 */
  contentKind?: ContentKind;
  /** 内置预置目标标记（v4.2 遗留，preset=true 走 built-in adapter）。 */
  preset?: boolean;
  /** 来源标记（agent 自动接入 / manual 手动填写），仅标记、行为一致。 */
  source?: "agent" | "manual";

  status: "unverified" | "tested_ok" | "tested_fail" | "unsupported";
  rawDoc?: string;
}

/**
 * 从一个 base-model 的 ModelEndpoint 抽取出运行时配置（v4.8）。
 * 供前端在调用 AI 功能时，把选定模型的配置打包随请求传给后端。
 */
export function toBaseModelConfig(endpoint: ModelEndpoint): BaseModelConfig {
  return {
    baseUrl: endpoint.baseUrl ?? "",
    apiKey: endpoint.apiKey ?? "",
    modelName: endpoint.modelName ?? "",
    protocol: endpoint.protocol ?? "auto",
  };
}

// 为了兼容旧代码，保留部分别名引用
export type TargetConfig = ModelEndpoint;

/**
 * 基础大模型运行时配置（v4.8 方案1）。
 * 前端从 IndexedDB 取出选定的 base-model 配置，随每次 AI 请求 body 传给后端。
 * 后端直接用该配置调用模型，不再读 process.env。key 仅存本地、走本地后端代理。
 */
export interface BaseModelConfig {
  /** 模型网关地址；可填 OpenAI 兼容或 Anthropic 兼容入口。 */
  baseUrl: string;
  /** 明文 API Key（仅本地存储 + 随请求传给本地后端，绝不写入代码库）。 */
  apiKey: string;
  /** 实际模型名，如 qwen-max / deepseek-chat。 */
  modelName: string;
  /** 协议类型：auto 自动探测，或显式指定 openai / anthropic。 */
  protocol?: BaseModelProtocol;
}

export interface Task {
  id: string;
  createTime: number;
  finishTime?: number;
  /** 本次任务的内容模式（文本 / 生图）。 */
  contentMode: ContentMode;
  /** 本次任务的运行模式（单条 / 批量）。 */
  runMode: RunMode;
  inputs: TaskInput[];
  targetIds: string[];
  concurrency: number;
  /** 只存定义/列映射，不存值。 */
  paramSnapshot: {
    targetId: string;
    paramDefs: ParamDef[];
  }[];
  results: ResultRow[];
  evaluation?: Evaluation;
  status: "idle" | "running" | "partial" | "done" | "error" | "cancelled";
}

export interface TaskInput {
  id: string;
  prompt: string;
  images: ImageItem[];
  extraFields?: Record<string, unknown>;
}

export interface ImageItem {
  id: string;
  name: string;
  source: "url" | "base64";
  value: string;
}

export interface ResultRow {
  inputId: string;
  items: ResultItem[];
}

export interface ResultItem {
  targetId: string;
  targetName: string;
  /** 内容能力标签，用于结果区展示（文本 / 多模态 / 生图）。 */
  contentKind?: ContentKind;
  status: "pending" | "running" | "success" | "error" | "interrupted";
  outputText?: string;
  /** 展示用原图；单目标可返回多张（生图）。 */
  outputImages?: string[];
  latencyMs?: number;
  error?: string;
}

/* 旧 interface TargetConfig 已合并入 ModelEndpoint，此处仅保留类型别名（行83）。 */

/** custom 目标的请求描述模板。本期仅支持非流式（stream 恒为 false）。 */
export interface RequestTemplate {
  url: string;
  method: "GET" | "POST";
  headers: { key: string; value: string }[];
  /** 含 {{参数}} 占位，运行时用 TaskInput 真实值填充。 */
  bodyTemplate: string;
  /** ⚠️ 本期仅支持非流式，恒为 false。 */
  stream: false;
  /** 方案 B：声明所需预置安全能力（仅可从 capabilities 清单中勾选）。 */
  preprocess?: string[];
  /** 从响应取文本的路径（JSONPath 风格）。 */
  outputTextPath?: string;
  /** 从响应取图片的路径。 */
  outputImagePath?: string;
}

/**
 * 脚本接入配置（v4.2，仅用户接入的 custom 目标，preset 目标禁带）。
 *
 * 执行约定：
 *  - 参数经 stdin 传入一个 params JSON，脚本从 stdin 读取，禁字符串替换进 code。
 *  - 结果以 ===RESULT_JSON_START==={...}===RESULT_JSON_END=== 标记包裹输出，与调试 print 区分。
 *  - 成功 = 标记内 { text, images[] } 非空。
 */
export interface ScriptConfig {
  /** 脚本语言：仅 python 正式支持，node 可选；shell 已砍。默认 python。 */
  lang: "python" | "node";
  /** 脚本全文。从 stdin 读取 params JSON，结果以 RESULT_JSON 标记输出。 */
  code: string;
  /** 是否已本地跑通且用户「确认创建」。 */
  verified: boolean;
  /** 最近一次测试塞入的参数 JSON（给用户确认用，v4.4）。 */
  lastTestInput?: string;
  /** 最近一次测试的原始输出（rawOutput，排查/确认用）。 */
  lastTestOutput?: string;
  /** 图片等产物的本地临时落地文件夹（仅临时 + 向用户展示，非结果唯一存储）。 */
  outputDir?: string;
}

/** ComfyUI 固定形态配置。 */
export interface ComfyuiConfig {
  serverUrl: string;
  /** checkpoint（由 /api/comfyui/list 拉取后下拉选择）。 */
  baseModel: string;
  /** LoRA（由 /api/comfyui/list 拉取后下拉选择，可选）。 */
  loraName?: string;
  /** LoRA 权重，可选。 */
  loraWeight?: number;
}

/** AI 造数据请求。 */
export interface GenDataRequest {
  /** 决定需要哪些列（文本/生图）。 */
  contentMode: ContentMode;
  /** 造一条 / 造批量数据。 */
  shape: "one" | "batch";
  /** batch 时的条数。 */
  count?: number;
  /** 用户对数据内容的描述。 */
  requirement: string;
  /** 当前选中目标所需列（prompt / image_url / 各参数名），作为约束传给 AI。 */
  targetColumns: string[];
}

export interface ParamDef {
  name: string;
  type: "string" | "number" | "boolean" | "image";
  required: boolean;
  desc?: string;
  defaultValue?: unknown;
  value?: unknown;
}

export interface Evaluation {
  userRequirement: string;
  evalPrompt: string;
  /** 裁判目标 id（含图裁判须选 contentKind='multimodal' 的目标）。 */
  evalModelId: string;
  /** 评价范围：全量 / 选中行。 */
  scope?: "all" | "selected";
  selectedInputIds?: string[];
  status: "idle" | "running" | "done" | "error";
  results?: {
    inputId: string;
    scores: { targetId: string; score: number; comment: string }[];
    summary: string;
    recommendation: string;
  }[];
}

/**
 * 单个评价维度（v4.5）：一个考察角度，如「准确性」「流畅度」。
 * 由内置预设维度集或 AI 按需求生成，最终由用户勾选/增删改后定稿。
 */
export interface EvalDimension {
  /** 维度名（如「准确性」），作为表格列头与评分键。 */
  name: string;
  /** 维度说明（这条维度具体考察什么），供用户理解与裁判参考。 */
  desc?: string;
}

/**
 * 内置预设维度集（v4.5，config/dimensionPresets.ts）：按场景预置一组常用维度，可一键选用后再增删改。
 */
export interface DimensionPreset {
  id: string;
  /** 预设名（如「翻译质量」）。 */
  name: string;
  /** 适用场景说明。 */
  scene: string;
  dimensions: EvalDimension[];
}

/**
 * 单个目标在一条输入下的多维度评分（v4.5）：每个维度独立打分（0-10）+ 一句理由，不算总分。
 */
export interface TargetDimensionScores {
  targetId: string;
  targetName: string;
  /** 按维度逐项打分，顺序与本次选定维度一致；不含总分字段。 */
  dimensionScores: { dimension: string; score: number; comment: string }[];
  /** 可选的总体点评（非分数，仅文字）。 */
  overallComment?: string;
}

/**
 * AI 评价记录（v4.3 板块⑤；v4.5 改为多维度评分）：每做完一次评价生成一条，
 * 存入 Project.evaluations，独立留存不覆盖。④ 只往这里写、⑤ 只从这里读，是评价数据的唯一权威来源。
 */
export interface EvaluationRecord {
  id: string;
  /** 来源批次 Task id。 */
  sourceTaskId: string;
  createTime: number;
  /** 裁判目标 id（含图裁判须 contentKind='multimodal'）。 */
  evalModelId: string;
  userRequirement: string;
  /** 本次评价选定的维度（v4.5），决定表格维度列与每目标的 dimensionScores。 */
  dimensions: EvalDimension[];
  evalPrompt: string;
  scope: "all" | "selected";
  selectedInputIds?: string[];
  /** 评价条数。 */
  count: number;
  status: "done" | "error";
  results: {
    inputId: string;
    /** 各目标的多维度评分（v4.5，无总分）。 */
    scores: TargetDimensionScores[];
    summary: string;
    recommendation: string;
  }[];
}

export interface NormalizedLlmOutput {
  outputText: string;
  outputImages: string[];
  latencyMs: number;
}

export interface LlmChatParams {
  /** v4.8：前端传入的基础大模型完整配置。 */
  baseModel: BaseModelConfig;
  prompt: string;
  images?: ImageItem[];
}

/**
 * AI 解析任意目标文档（大模型/多模态/生图/算法）的结构化结果（v4 统一接入）。
 * 仅用于透出展示填进接入表单，全字段可手动改；产出对齐 TargetConfig 草稿。
 */
export interface ApiDocParseResult {
  /** 接口地址。 */
  endpoint?: string;
  method?: "GET" | "POST";
  /** 鉴权方式描述（如 Bearer Token、API Key Header 等）。 */
  authType?: string;
  /** 建议的 key 环境变量引用名（如 MY_API_KEY），供用户填 apiKeyRef 参考。 */
  suggestedKeyRef?: string;
  /** 建议的内容能力标签：text | multimodal | image。 */
  contentKind?: ContentKind;
  /** 请求参数字段（对照 ParamDef 填表）。 */
  requestParams: {
    name: string;
    type: "string" | "number" | "boolean" | "image";
    required: boolean;
    desc?: string;
  }[];
  /** 建议的请求体模板（含 {{参数}} 占位）。 */
  bodyTemplate?: string;
  /** 建议声明的预置安全能力（只能取自 capabilities 清单中的能力名）。 */
  preprocess?: string[];
  /** 建议的输出文本提取路径（如 data.caption）。 */
  outputTextPath?: string;
  /** 建议的输出图片提取路径（如 data.images）。 */
  outputImagePath?: string;
  /** 一句话总结这份文档/接口的用途。 */
  summary: string;
  /** AI 解读时的不确定项 / 风险提示，供用户重点核对。 */
  warnings: string[];
}

/** 脚本语言（v4.2）：仅 python 正式支持，node 可选。 */
export type ScriptLang = "python" | "node";

/**
 * 脚本执行结果（v4.4）。runScript 底层函数的返回类型，跑批执行与 Agent run_script 工具共用。
 * 成功 = RESULT_JSON 标记内 { text, images[] } 非空；图片已转 base64/blob 收进结果体系。
 */
export type RunScriptResult =
  | {
      ok: true;
      text: string;
      images: string[];
      /** 图片产物的本地临时落地文件夹（仅展示用）。 */
      outputDir?: string;
      /** 脚本完整原始 stdout（含调试日志，供"原始输出"展示）。 */
      rawOutput: string;
      latencyMs: number;
    }
  | {
      ok: false;
      error: string;
      /** stderr 全文（失败诊断，Agent 据此自主修复）。 */
      stderr: string;
      /** 子进程退出码。 */
      exitCode: number | null;
      /** 环境探测结果（如"未检测到 python 命令 / python 版本"）。 */
      envInfo: string;
      latencyMs: number;
    };

/**
 * Agent 自动接入待确认草稿（v4.4）。
 * Agent 调 save_target 跑通后产出，经 SSE 返回前端展示三项供用户确认，
 * 用户确认后由 /api/confirm-target 才真正存为 TargetConfig。
 */
export interface PendingTarget {
  name: string;
  /** 跑通后的最终 Python 脚本全文。 */
  code: string;
  /** 能力标签：text | multimodal | image。 */
  capability: ContentKind;
  /** Agent 整理的入参清单。 */
  inputParams: ParamDef[];
  /** 鉴权 key 的环境变量名（可选）。 */
  apiKeyRef?: string;
  /** 最后一次测试塞入的参数 JSON（给用户确认用）。 */
  lastTestInput?: string;
  /** 最后一次测试的原始输出（给用户确认用）。 */
  lastTestOutput?: string;
  /** 最后一次测试渲染出的文本结果。 */
  resultText?: string;
  /** 最后一次测试渲染出的图片（base64/URL）。 */
  resultImages?: string[];
  /** 脚本图片产物临时落地文件夹。 */
  outputDir?: string;
}

/** Agent 可调用的工具名（v4.4）。 */
export type AgentToolName =
  | "run_script"
  | "install_package"
  | "save_target"
  | "ask_user";

/**
 * Agent 接入过程 SSE 事件（v4.4）。前端实时消费以展示进度。
 *  - thinking     Agent 的思考/说明文本
 *  - tool         Agent 决定调某工具（含简要入参摘要）
 *  - tool_result  工具执行结果摘要
 *  - ask          Agent 缺信息，向用户提问（暂停会话，等用户带 sessionId 回复后续跑）
 *  - done         接入完成，附 pending 草稿待用户确认
 *  - error        失败，附原因与可能的解决建议
 */
export type AgentStreamEvent =
  | { type: "thinking"; text: string }
  | { type: "tool"; tool: AgentToolName; summary: string }
  | { type: "tool_result"; tool: AgentToolName; ok: boolean; summary: string }
  | { type: "ask"; sessionId: string; question: string }
  | { type: "done"; pending: PendingTarget; message: string }
  | { type: "error"; error: string; suggestion?: string };
