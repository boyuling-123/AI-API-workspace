import type { ModelEndpoint } from "@/types";

/**
 * 判断一个 endpoint 是否具备 AI 调用能力（有完整的 baseUrl + apiKey + modelName 配置）。
 * 统一模型池：不再按 kind 硬性区分，任何有完整 AI 配置的模型都可以承担 AI 能力场景。
 */
export function hasAiConfig(endpoint: ModelEndpoint): boolean {
  return !!(endpoint.baseUrl?.trim() && endpoint.apiKey?.trim() && endpoint.modelName?.trim());
}

/**
 * 根据场景获取符合条件的 AI 能力候选列表。
 * 统一模型池：只要有完整 AI 配置 + 匹配场景所需能力，就作为候选。
 */
export function getModelCandidates(
  endpoints: ModelEndpoint[],
  scenario:
    | "agent"
    | "gen-data-text"
    | "gen-data-image"
    | "eval-dimensions"
    | "eval-prompt"
    | "evaluate-text"
    | "evaluate-multimodal"
): ModelEndpoint[] {
  const aiModels = endpoints.filter(hasAiConfig);

  switch (scenario) {
    case "agent":
      return aiModels.filter((m) => m.supportsToolUse === true);
    case "gen-data-image":
      return aiModels.filter((m) => m.capability === "image");
    case "evaluate-multimodal":
      return aiModels.filter((m) => m.capability === "multimodal");
    case "gen-data-text":
    case "eval-dimensions":
    case "eval-prompt":
    case "evaluate-text":
      return aiModels.filter((m) => ["text", "multimodal"].includes(m.capability));
    default:
      return [];
  }
}

/**
 * 检查是否存在至少一个具备 AI 调用能力的模型。
 * 用于引导页判断：没有任何 AI 模型 → 显示首次配置引导。
 */
export function hasAnyBaseModel(endpoints: ModelEndpoint[]): boolean {
  return endpoints.some(hasAiConfig);
}
