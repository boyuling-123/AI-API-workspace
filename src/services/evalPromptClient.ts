import type { BaseModelConfig, EvalDimension } from "@/types";

/**
 * 前端调用 /api/gen-eval-prompt（v4.5 按维度；v4.8 传完整基础模型配置）：
 * 用户描述测评场景 + 选定维度 + 选定的基础大模型 → 大模型生成可编辑的评价 Prompt（按维度逐项打分、无总分）。
 * key 仅本地存储、走本地后端代理。
 */
export async function generateEvalPromptClient(
  scenario: string,
  baseModel: BaseModelConfig,
  dimensions: EvalDimension[] = [],
  targetNames: string[] = [],
  signal?: AbortSignal
): Promise<string> {
  const response = await fetch("/api/gen-eval-prompt", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ scenario, baseModel, dimensions, targetNames }),
    signal,
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error ?? `生成评价 Prompt 失败（${response.status}）`);
  }
  return data.evalPrompt as string;
}
