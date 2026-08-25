import type { LlmChatParams, NormalizedLlmOutput } from "@/types";
import { runTarget } from "@/adapters/registry";
import { PRESET_TARGETS } from "@/config/presetTargets";

/**
 * 兼容入口（v4）：原 /api/chat 按 modelId 调用大模型。
 * 现统一改走 runTarget——按 modelId 在预置目标里找到对应 TargetConfig 后执行。
 * 后续 M2 用 /api/run-custom 直接传整个 TargetConfig 取代本入口。
 */
export async function chatWithModel(
  params: LlmChatParams,
  signal?: AbortSignal
): Promise<NormalizedLlmOutput> {
  const target = PRESET_TARGETS.find((item) => item.id === params.modelId);
  if (!target) {
    throw new Error(`未知模型 modelId: ${params.modelId}`);
  }
  return runTarget(target, {
    prompt: params.prompt,
    images: params.images,
    maxTokens: params.maxTokens,
    signal,
  });
}
