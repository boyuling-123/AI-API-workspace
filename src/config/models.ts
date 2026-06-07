/**
 * DashScope（百炼）Anthropic 兼容网关的模型名映射（v4）。
 *
 * v4 删除了独立的 ModelConfig 结构，内置目标改由 config/presetTargets.ts 以 TargetConfig 表达。
 * 本文件仅保留「平台内置 modelId → DashScope apiModelName」的轻量映射，供 customAdapter 调用网关时使用。
 */
export interface DashscopeModelMapping {
  id: string;
  apiModelName: string;
}

export const DASHSCOPE_MODELS: DashscopeModelMapping[] = [
  { id: "deepseek-v4-pro", apiModelName: "deepseek-v4-pro" },
  { id: "kimi-k2.6", apiModelName: "kimi-k2.6" },
  { id: "qwen3.6-plus", apiModelName: "qwen3.6-plus" },
];

export function getDashscopeModelName(modelId: string): string {
  const mapping = DASHSCOPE_MODELS.find((item) => item.id === modelId);
  return mapping?.apiModelName ?? modelId;
}
