import type { EvalDimension } from "@/types";

/**
 * 前端调用 /api/gen-eval-prompt（v4.5 按维度）：用户描述测评场景 + 选定维度
 * → 大模型生成可编辑的评价 Prompt（按维度逐项打分、无总分）。
 */
export async function generateEvalPromptClient(
  scenario: string,
  modelId: string,
  dimensions: EvalDimension[] = [],
  targetNames: string[] = [],
  signal?: AbortSignal
): Promise<string> {
  const response = await fetch("/api/gen-eval-prompt", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ scenario, modelId, dimensions, targetNames }),
    signal,
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error ?? `生成评价 Prompt 失败（${response.status}）`);
  }
  return data.evalPrompt as string;
}
