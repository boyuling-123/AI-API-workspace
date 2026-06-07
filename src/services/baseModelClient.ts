import "server-only";
import type { BaseModelConfig, ImageItem, NormalizedLlmOutput } from "@/types";
import { callAnthropicCompatible } from "@/adapters/anthropicCompatible";
import { callOpenAICompatible } from "@/adapters/openaiCompatible";
import {
  getBaseModelProtocolOrder,
  normalizeBaseModelConfig,
} from "@/adapters/baseModelProtocol";

export interface CallBaseModelParams {
  prompt: string;
  images?: ImageItem[];
  signal?: AbortSignal;
}

/**
 * v4.8 统一基础大模型调用入口（后端）。
 *
 * 方案1：前端从 IndexedDB 取出选定的 base-model 配置（baseUrl + apiKey 明文 + modelName），
 * 随请求 body 传给本地后端；后端直接用该配置调用模型，不再读 process.env。
 *
 * 所有 AI 能力场景（Agent / 文档解读 / 生成数据 / 生成维度 / 生成 prompt / 自动评分）统一走这里。
 */
export async function callBaseModel(
  config: BaseModelConfig,
  params: CallBaseModelParams
): Promise<NormalizedLlmOutput> {
  assertValidBaseModelConfig(config);
  const normalized = normalizeBaseModelConfig(config);
  const protocolOrder = getBaseModelProtocolOrder(normalized);
  const errors: string[] = [];

  for (const protocol of protocolOrder) {
    try {
      const call =
        protocol === "openai" ? callOpenAICompatible : callAnthropicCompatible;
      return await call(
        {
          baseUrl: normalized.baseUrl,
          apiKey: normalized.apiKey,
          apiModelName: normalized.modelName,
        },
        {
          prompt: params.prompt,
          images: params.images,
          signal: params.signal,
        }
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "未知错误";
      errors.push(`${protocolLabel(protocol)} 调用失败：${message}`);
    }
  }

  throw new Error(errors.join("；"));
}

/**
 * 校验前端传入的基础大模型配置完整性，缺字段直接抛错，便于路由层返回明确提示。
 */
export function assertValidBaseModelConfig(
  config: BaseModelConfig | undefined | null
): asserts config is BaseModelConfig {
  if (!config) {
    throw new Error(
      "缺少基础大模型配置，请先在「接口与模型管理」接入一个基础大模型并在当前功能选择它"
    );
  }
  if (!config.baseUrl?.trim()) {
    throw new Error("基础大模型配置缺少 baseUrl");
  }
  if (!config.apiKey?.trim()) {
    throw new Error("基础大模型配置缺少 apiKey");
  }
  if (!config.modelName?.trim()) {
    throw new Error("基础大模型配置缺少 modelName");
  }
}

function protocolLabel(protocol: "openai" | "anthropic"): string {
  return protocol === "openai" ? "OpenAI" : "Anthropic";
}
