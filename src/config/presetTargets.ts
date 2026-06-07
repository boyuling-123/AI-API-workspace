import type { TargetConfig } from "@/types";
import { RUNTIME_CONFIG } from "@/config/runtime";

/**
 * 内置预置目标（v4 统一架构）。
 *
 * v4 删除了独立的 ModelConfig 结构，内置目标改为以 TargetConfig（preset=true、status=tested_ok）
 * 形态预置在此处，与用户接入的目标走完全相同的存储、调用、跑批链路。
 *
 * 这些是「默认初始值」：新建项目时塞入，用户可自由编辑/删除；删掉后不会自动恢复，新建项目才重新生成。
 *
 * 关键约束：
 *  - preset=true 的目标一般只读/不可删（由 UI 控制）。
 *  - 至少包含一个可用裁判目标（contentKind='multimodal'，能看图+出文字），保证 AI 评价开箱可用。
 *  - 内置大模型经 DashScope Anthropic 兼容网关调用，由 customAdapter 内部按 Anthropic 兼容形态处理；
 *    requestTemplate.url 指向网关，apiKeyRef 指向共享的 DASHSCOPE_API_KEY。
 */

const DASHSCOPE_KEY_REF = "DASHSCOPE_API_KEY";

/** DashScope Anthropic 兼容网关大模型的通用请求模板。bodyTemplate 中的 {{...}} 由运行时填充。 */
function dashscopeRequestTemplate(apiModelName: string): TargetConfig["requestTemplate"] {
  return {
    url: `${RUNTIME_CONFIG.dashscopeBaseUrl}/v1/messages`,
    method: "POST",
    headers: [{ key: "content-type", value: "application/json" }],
    bodyTemplate: JSON.stringify({
      model: apiModelName,
      max_tokens: RUNTIME_CONFIG.maxTokens,
      messages: [{ role: "user", content: "{{prompt}}" }],
    }),
    stream: false,
    outputTextPath: "content.0.text",
  };
}

export const PRESET_TARGETS: TargetConfig[] = [
  {
    id: "deepseek-v4-pro",
    name: "DeepSeek V4 Pro",
    kind: "target",
    capability: "text",
    type: "custom",
    contentKind: "text",
    source: "manual",
    preset: true,
    status: "tested_ok",
    apiKeyRef: DASHSCOPE_KEY_REF,
    inputParams: [{ name: "prompt", type: "string", required: true, desc: "提示词" }],
    requestTemplate: dashscopeRequestTemplate("deepseek-v4-pro"),
  },
  {
    id: "kimi-k2.6",
    name: "Kimi K2.6（多模态）",
    kind: "target",
    capability: "multimodal",
    type: "custom",
    contentKind: "multimodal",
    source: "manual",
    preset: true,
    status: "tested_ok",
    apiKeyRef: DASHSCOPE_KEY_REF,
    inputParams: [
      { name: "prompt", type: "string", required: true, desc: "提示词" },
      { name: "image", type: "image", required: false, desc: "输入图片" },
    ],
    requestTemplate: dashscopeRequestTemplate("kimi-k2.6"),
  },
  {
    id: "qwen3.6-plus",
    name: "Qwen3.6 Plus（多模态 · 默认裁判）",
    kind: "target",
    capability: "multimodal",
    type: "custom",
    contentKind: "multimodal",
    source: "manual",
    preset: true,
    status: "tested_ok",
    apiKeyRef: DASHSCOPE_KEY_REF,
    inputParams: [
      { name: "prompt", type: "string", required: true, desc: "提示词" },
      { name: "image", type: "image", required: false, desc: "输入图片" },
    ],
    requestTemplate: dashscopeRequestTemplate("qwen3.6-plus"),
  },
  {
    id: "builtin-mock-algo",
    name: "Mock 生图算法（内置样例）",
    kind: "target",
    capability: "image",
    type: "custom",
    contentKind: "image",
    source: "manual",
    preset: true,
    status: "tested_ok",
    inputParams: [
      { name: "prompt", type: "string", required: true, desc: "生图提示词" },
      {
        name: "num_images",
        type: "number",
        required: false,
        desc: "生成图片数量（1-8）",
        defaultValue: 1,
      },
    ],
    requestTemplate: {
      url: "/api/mock-algo",
      method: "POST",
      headers: [],
      bodyTemplate: JSON.stringify({ prompt: "{{prompt}}", num_images: "{{num_images}}" }),
      stream: false,
      outputTextPath: "data.caption",
      outputImagePath: "data.images",
    },
  },
];

/** 默认裁判目标 id：AI 评价开箱即用时优先选用。 */
export const DEFAULT_JUDGE_TARGET_ID = "qwen3.6-plus";

/** 新建项目时的默认目标（预置大模型 + Mock 算法）。用户可自由编辑/删除。 */
export function getDefaultTargetConfigs(): TargetConfig[] {
  return PRESET_TARGETS.map((target) => ({ ...target }));
}

/**
 * 某个目标是否支持图片输入（仅 multimodal：能看图+出文字）。
 * 用于「输入含图时纯文本目标置灰」与「含图裁判」判断。
 * 注意：image（生图）输出图片，不接图片输入做理解，故不算支持图片输入。
 */
export function targetSupportsImage(target: Pick<TargetConfig, "capability" | "contentKind">): boolean {
  return (target.capability ?? target.contentKind) === "multimodal";
}
