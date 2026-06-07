import { RUNTIME_CONFIG } from "@/config/runtime";

/**
 * Agent 自动接入配置（v4.4）。
 *
 * 干活的 Agent 模型固定为 DeepSeek（经实测：走现有 DashScope Anthropic 兼容网关的
 * deepseek-v4-pro 支持 Anthropic 格式的 tool use），复用项目已有 DASHSCOPE_API_KEY，
 * 不另配 DeepSeek 官方 key。被测评的目标模型仍可自由接入/选择，不碰工具。
 *
 * 关键定调：
 *  - 协议格式为 Anthropic tool use（tools 用 input_schema、模型回 content[].tool_use、
 *    结果以 tool_result block 喂回），而非 OpenAI function calling。
 *  - Agent 仅用于「接入阶段」；跑批阶段 script 目标直接执行已验证脚本，不启动 Agent。
 */

export const AGENT_CONFIG = {
  /** 经网关实测唯一可用且支持 tool use 的 DeepSeek 型号。 */
  model: "deepseek-v4-pro",
  /** 复用现有 DashScope Anthropic 兼容网关。 */
  baseUrl: RUNTIME_CONFIG.dashscopeBaseUrl,
  /** 接入助手所需的环境变量 key（与内置大模型共用）。 */
  apiKeyEnvName: "DASHSCOPE_API_KEY",
  /** 调大 max_tokens 防长脚本截断（PRD 要求 ≥8192）。 */
  maxTokens: 8192,
  /** Agent 循环步数上限，防失控烧 token。 */
  maxSteps: 30,
} as const;

/**
 * Agent System Prompt（PRD 3.4）：把原 v4.3 的「平台死规则」转化为「Agent 自我遵守的规矩」。
 */
export const AGENT_SYSTEM_PROMPT = `你是 API 接入助手。任务：根据用户对接文档，编写 Python 脚本调用该 API，在本机实际运行测试，自主修复所有问题直到真跑通并返回有效结果，然后保存为可用接口。

工具：run_script（本机跑脚本，脚本从 stdin 读参数 JSON）、install_package（pip 装包）、save_target（验证通过后保存接口）、ask_user（缺关键信息时向用户提问）。

流程（自主驱动，能自己解决的不要问用户）：
1. 读文档，判断接口能力：纯文本对话 / 看图输出文字 / 生成图片。
2. 写 Python 脚本：参数从 stdin 读取（json.loads(sys.stdin.read())），不写死；API key 从环境变量读；异步 API（提交→轮询）在脚本内完成完整轮询；脚本最后必须把结果 JSON 用固定标记包裹后 print 到 stdout，格式严格如下（标记一字不差，结果 JSON 必须是合法 JSON）：
   ===RESULT_JSON_START==={"text":"文本或空","images":["URL或本地路径",...]}===RESULT_JSON_END===
   平台只认这对标记之间的内容作为结果，没有这对标记一律判失败。调试信息请打到 stderr（print(..., file=sys.stderr)），不要混进这对标记里。图片可写本地文件后把路径放进 images，平台会自动转 base64；环境变量 SCRIPT_OUTPUT_DIR 是可写的产物目录。
3. 调 run_script 用合理测试参数实际运行。
4. 自主处理结果：缺库→install_package；有 bug→改脚本；鉴权/参数错→对照文档改；反复迭代直到输出非空结果 JSON。
5. 判断能力标签：纯文字→text；能接图输出文字→multimodal；输出图片→image。
6. 整理参数清单（名称/类型 string·number·boolean·image/是否必填/说明），说明一律用大白话中文，避免专业术语。
7. 调 save_target 传入：接口名、最终脚本、参数清单、能力标签。
8. 用简短中文告诉用户：接口类型、要填哪些参数、测试返回了什么（供用户确认真实有效）。

遇到缺信息时（用 ask_user）：
- 文档里没写、但跑通必需的关键信息（如 API Key 真值/环境变量名、某个必填参数该填什么、鉴权方式、接口域名、模型名等），不要瞎猜也不要直接判失败，调 ask_user 用一句清楚的中文问用户，等用户回答后再继续。
- 一次只问一个问题（ask_user 单独调用，不要和别的工具同一轮一起调）；问之前先自己尝试，确实卡住了再问。
- 用户回答会作为对话回复给你，据此继续接入。

铁律：必须真跑通才保存；结果 JSON 必须是 API 真实返回，不得编造/占位；缺关键信息用 ask_user 问用户而不是编造；环境缺 Python 或缺库时给清晰可照做的终端命令。`;

/**
 * Agent 可用工具定义（Anthropic tool use 格式：input_schema）。
 */
export const AGENT_TOOLS = [
  {
    name: "run_script",
    description:
      "在本机实际执行一段 Python 脚本。脚本从 stdin 读取一个 params JSON 获取参数。脚本必须把结果用 ===RESULT_JSON_START==={...}===RESULT_JSON_END=== 标记包裹后 print 到 stdout，平台只认这对标记之间的 JSON（含 text、images 字段）判定成功，标记内 text 与 images 都为空也判失败。调试输出请打到 stderr。返回脚本的标准输出/标准错误/退出码与解析到的结果。",
    input_schema: {
      type: "object",
      properties: {
        code: { type: "string", description: "要执行的完整 Python 脚本源码" },
        paramValues: {
          type: "object",
          description:
            "经 stdin 传给脚本的参数键值（如 {\"prompt\":\"你好\"}），脚本用 json.loads(sys.stdin.read()) 读取。",
        },
        apiKeyEnvName: {
          type: "string",
          description:
            "该接口鉴权 key 在 .env.local 中的环境变量名（可选，仅注入这一个）。",
        },
      },
      required: ["code", "paramValues"],
    },
  },
  {
    name: "install_package",
    description:
      "用 pip 安装缺失的 Python 第三方包（当 run_script 报 ModuleNotFoundError 时调用）。",
    input_schema: {
      type: "object",
      properties: {
        packages: {
          type: "array",
          items: { type: "string" },
          description: "要安装的 pip 包名数组，如 [\"requests\"]。",
        },
      },
      required: ["packages"],
    },
  },
  {
    name: "save_target",
    description:
      "在脚本真跑通、返回有效结果后，把它保存为可用接口（暂存为待确认草稿，由用户最终确认后才真正存入）。",
    input_schema: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description:
            "接口名称（必填，不能为空）。给一个简洁、能体现这个接口用途的中文名，如「通义千问文本对话」「SD 文生图」，方便用户在列表里识别。",
        },
        code: { type: "string", description: "跑通后的最终 Python 脚本全文" },
        capability: {
          type: "string",
          enum: ["text", "multimodal", "image"],
          description:
            "能力标签：纯文字 text / 看图出文字 multimodal / 生成图片 image。",
        },
        inputParams: {
          type: "array",
          description: "参数清单。",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              type: {
                type: "string",
                enum: ["string", "number", "boolean", "image"],
              },
              required: { type: "boolean" },
              desc: { type: "string", description: "大白话说明这个参数干嘛的" },
            },
            required: ["name", "type", "required"],
          },
        },
        apiKeyEnvName: {
          type: "string",
          description: "该接口鉴权 key 的环境变量名（可选）。",
        },
      },
      required: ["name", "code", "capability", "inputParams"],
    },
  },
  {
    name: "ask_user",
    description:
      "当缺少跑通接口所必需、且文档里没有、自己又无法推断的关键信息时（如 API Key 真值或环境变量名、某个必填参数到底填什么、鉴权方式、接口域名、模型名等），用一句清楚的中文向用户提问。一次只问一个问题，单独调用此工具（不要和其他工具同一轮一起调）。用户的回答会作为对话回复返回给你，据此继续接入。",
    input_schema: {
      type: "object",
      properties: {
        question: {
          type: "string",
          description: "要问用户的问题，一句话讲清楚你缺什么、为什么需要。",
        },
      },
      required: ["question"],
    },
  },
] as const;
