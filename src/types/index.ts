export const SCHEMA_VERSION = 7;

/** 内容模式：文本 / 生图。与 RunMode 正交，各自维护独立草稿。 */
export type ContentMode = "text" | "image";

/** 运行模式：单条 / 批量。与 ContentMode 正交。 */
export type RunMode = "single" | "batch";

/** AI 评价模式：横向对比 / 按每条样本标准答案判分。 */
export type EvaluationMode = "comparison" | "reference";

/** 单次跑批的限速、超时与重试快照；恢复任务时必须沿用原策略。 */
export interface RunPolicy {
  /** 全局每秒最多启动的真实请求数；0 表示不限速。 */
  qps: number;
  /** 单次请求超时，单位毫秒。 */
  timeoutMs: number;
  /** 首次调用失败后最多自动重试的次数。 */
  retryLimit: number;
}

/** 定向重跑的最小执行单元，避免重新展开完整 Case x target 矩阵。 */
export interface TaskRunPair {
  inputId: string;
  targetId: string;
}

export type TaskRerunScope = "failed" | "selected_cases" | "new_targets";

/** 新重跑任务保存的来源与稀疏调用计划，用于暂停续跑和历史追溯。 */
export interface TaskRerun {
  sourceTaskId: string;
  scope: TaskRerunScope;
  pairs: TaskRunPair[];
  selectedInputIds: string[];
}

/** 统一失败分类，供重试决策、结果展示和历史筛选复用。 */
export type RunErrorType =
  | "timeout"
  | "rate_limit"
  | "auth"
  | "network"
  | "parse"
  | "server"
  | "client"
  | "unknown";

/**
 * 统一目标类型（v4 重构核心）：
 * - 'custom'：所有通过接入机制（AI 解析或手动）配置的目标，涵盖大模型/多模态/生图/算法 API。
 * - 'comfyui'：固定形态（LoRA + prompt + checkpoint），性质不同独立保留。
 */
export type TargetType = "custom" | "comfyui";

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
  /** 所有目标（含 preset 预置项 + 用户接入项）统一存这里，只存定义。 */
  targetConfigs: TargetConfig[];
  tasks: Task[];
  /**
   * 所有历史评价（v4.3 板块⑤唯一数据来源）。
   * ④ 评价完成后追加一条 EvaluationRecord，⑤ 从此列表读取。同一 Task 可被多次评价、独立留存不覆盖。
   */
  evaluations: EvaluationRecord[];
  /** 已保存的不可变 Evaluator 版本；旧项目可缺省。 */
  evaluatorVersions?: EvaluatorVersion[];
  /** 人工标注黄金集的不可变版本；旧项目可缺省。 */
  goldenDatasetVersions?: GoldenDatasetVersion[];
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
  /** 旧项目可缺省；读取时使用当前安全默认值补齐。 */
  runPolicy?: RunPolicy;
  /** 只存定义/列映射，不存值。 */
  paramSnapshot: {
    targetId: string;
    paramDefs: ParamDef[];
  }[];
  results: ResultRow[];
  /** 批量任务最近一次一致检查点；旧项目可缺省。 */
  checkpoint?: TaskCheckpoint;
  /** 定向重跑任务的来源与精确调用范围；普通任务和旧项目可缺省。 */
  rerun?: TaskRerun;
  evaluation?: Evaluation;
  status:
    | "idle"
    | "running"
    | "paused"
    | "partial"
    | "done"
    | "error"
    | "cancelled";
}

export interface TaskCheckpoint {
  completedCalls: number;
  totalCalls: number;
  updatedTime: number;
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
  errorType?: RunErrorType;
  /** 实际请求次数，包含首次调用和自动重试。 */
  attemptCount?: number;
  /** 上游接口状态码；没有 HTTP 响应时为空。 */
  httpStatus?: number;
  /** 新增目标重跑时，标记该结果直接复用自哪个历史任务。 */
  reusedFromTaskId?: string;
}

/**
 * 统一目标配置（v4 重构核心）：一个结构装下所有 custom 目标 + comfyui。
 * Agent 自动接入（source='agent'）与手动填写（source='manual'）产出结构完全相同，仅来源标记不同，行为一致。
 * 核心数据原则：此处只存定义，绝不把运行时「值」写回；真值存 TaskInput。
 */
export interface TargetConfig {
  id: string;
  name: string;
  type: TargetType;
  /** 内容能力标签：text | multimodal | image。与 status 独立两维。 */
  contentKind: ContentKind;
  /** 由 Agent 自动接入得来 还是 手动填写（仅标记来源，行为完全一致）。 */
  source: "agent" | "manual";
  /** 入参定义（AI 解析或手动定义；跑批时由 TaskInput 提供真实值）。 */
  inputParams: ParamDef[];

  /**
   * built-in 路径专用（v4.2）：preset 内置目标的写死 HTTP 调用描述。
   * 由 built-in adapter 读取，平台内部配置、不暴露给用户。preset=true 的目标带此字段。
   */
  requestTemplate?: RequestTemplate;

  /**
   * script 路径专用（v4.2）：用户接入目标的脚本。非 preset 的 custom 目标带此字段。
   * preset 目标禁止带 script（禁走脚本路径）。
   */
  script?: ScriptConfig;

  /** comfyui 专用（固定形态：LoRA + prompt + checkpoint）。 */
  comfyui?: ComfyuiConfig;

  /**
   * key 的环境变量引用名（如 'MY_API_KEY'）。前端只存引用名，
   * 真值在服务端 .env.local，由 getApiKey(keyRef) 注入。为空表示无需鉴权。
   */
  apiKeyRef?: string;
  status: "unverified" | "tested_ok" | "tested_fail" | "unsupported";
  /** AI 解析时粘贴的文档原文（手动填则可空）。 */
  rawDoc?: string;
  /** true=内置预置目标（来自 presetTargets，一般只读/不可删，status 视为 tested_ok）。 */
  preset?: boolean;
}

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
  /** 维度定义（这条维度具体考察什么），供用户理解与裁判参考。 */
  desc?: string;
  /** 结构化评分锚点；新建评价固定要求 0/5/10 三档，旧记录可缺省。 */
  scoreLevels?: EvalDimensionScoreLevel[];
  /** 裁判必须引用或检查的证据要求；旧记录可缺省。 */
  evidenceRequirements?: string[];
  /** 可直接执行的判定步骤或边界；旧记录可缺省。 */
  judgeInstruction?: string;
  /** 已确认的评价权重百分比；新评价要求全部维度合计 100，旧记录可缺省。 */
  weight?: number;
  /** 一票否决阈值；该维度得分低于此值时触发否决，未配置时不参与否决。 */
  vetoThreshold?: number;
}

export interface EvalDimensionScoreLevel {
  score: number;
  criteria: string;
}

/**
 * 可复用的不可变 Evaluator 版本。每次修改都追加新版本，不覆盖历史快照。
 */
export interface EvaluatorVersion {
  id: string;
  /** 同一 Evaluator 家族的稳定 id。 */
  evaluatorId: string;
  version: number;
  name: string;
  createTime: number;
  createdBy: string;
  changeNote?: string;
  /** 创建该版本时绑定的跑批任务，用于追溯适用数据。 */
  applicableTaskId: string;
  evalModelId: string;
  userRequirement: string;
  dimensions: EvalDimension[];
  evalPrompt: string;
  evaluationMode: EvaluationMode;
  expectedAnswerColumn?: string;
  /** 维度与策略快照指纹。 */
  policyFingerprint: string;
  /** 完整执行定义指纹，用于识别页面草稿是否已修改。 */
  definitionFingerprint: string;
  /** 身份、版本元数据与执行定义的完整快照指纹。 */
  integrityFingerprint: string;
}

export type GoldenHumanLabel = "pass" | "fail";

/** Judge 校准使用的一条人工真值，不包含任何 Judge 运行结果。 */
export interface GoldenDatasetCase {
  caseId: string;
  prompt: string;
  candidateOutput: string;
  expectedAnswer?: string;
  humanLabel: GoldenHumanLabel;
  humanScore?: number;
  reviewerNote?: string;
}

/**
 * 人工黄金集不可变快照。已发布版本只能读取；修改时必须追加新版本。
 */
export interface GoldenDatasetVersion {
  id: string;
  /** 同一黄金集家族的稳定 id。 */
  datasetId: string;
  version: number;
  name: string;
  createTime: number;
  createdBy: string;
  changeNote?: string;
  sourceFileName?: string;
  cases: GoldenDatasetCase[];
  contentFingerprint: string;
  integrityFingerprint: string;
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
 * 单个目标在一条输入下的独立维度评分，以及平台确定性计算的策略结果。
 */
export interface TargetDimensionScores {
  targetId: string;
  targetName: string;
  /** Judge 按维度逐项打分，顺序与本次选定维度一致。 */
  dimensionScores: { dimension: string; score: number; comment: string }[];
  /** 平台按已确认权重确定性计算的 0-10 加权分；旧记录可缺省。 */
  weightedScore?: number;
  /** 是否命中任一维度的一票否决规则；旧记录可缺省。 */
  vetoed?: boolean;
  /** 命中的否决规则说明；旧记录可缺省。 */
  vetoReasons?: string[];
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
  /** 评价类型。旧记录为空时按 full 兼容。 */
  evaluationKind?: "full" | "new_dimensions";
  /** 新增维度评价所基于的根评价记录 id。 */
  sourceEvaluationId?: string;
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
  /** 评价模式。旧记录为空时按 comparison 兼容。 */
  evaluationMode?: EvaluationMode;
  /** 标准答案模式下使用的 extraFields 列名；auto 表示自动识别。 */
  expectedAnswerColumn?: string;
  /** 本次评价实际绑定的不可变 Evaluator 版本；旧记录或未保存草稿可缺省。 */
  evaluatorVersionId?: string;
  results: {
    inputId: string;
    /** 各目标的独立维度评分与平台策略结果。 */
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
  modelId: string;
  prompt: string;
  images?: ImageItem[];
  maxTokens?: number;
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
