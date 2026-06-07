import type { BaseModelConfig, ImageItem, NormalizedLlmOutput } from "@/types";
import { callBaseModel } from "@/services/baseModelClient";

export interface ChatWithBaseModelParams {
  /** v4.8：前端传入的基础大模型完整配置（baseUrl + apiKey 明文 + modelName）。 */
  baseModel: BaseModelConfig;
  prompt: string;
  images?: ImageItem[];
}

/**
 * 统一大模型对话入口（v4.8 重构）。
 *
 * 原先按 modelId 在写死的 PRESET_TARGETS 里查目标；现改为直接接收前端传入的
 * BaseModelConfig，调用 callBaseModel。所有 AI 能力场景（文档解读 / 生成数据 /
 * 生成维度 / 生成 prompt / 自动评分）统一走这里，不再依赖任何硬编码模型。
 */
export async function chatWithModel(
  params: ChatWithBaseModelParams,
  signal?: AbortSignal
): Promise<NormalizedLlmOutput> {
  return callBaseModel(params.baseModel, {
    prompt: params.prompt,
    images: params.images,
    signal,
  });
}
