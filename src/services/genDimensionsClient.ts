import type { EvalDimension } from "@/types";
import type { DimensionGenerationRequest } from "@/lib/dimensionGeneration";

/**
 * 前端调用 /api/gen-dimensions（v4.5）：用户描述测评需求 → 大模型生成若干候选维度。
 * 内置预设维度集仅作模型内部参考，不透出给用户。
 */
export async function generateDimensionsClient(
  request: DimensionGenerationRequest,
  modelId: string,
  signal?: AbortSignal
): Promise<EvalDimension[]> {
  const response = await fetch("/api/gen-dimensions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ request, modelId }),
    signal,
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error ?? `生成维度失败（${response.status}）`);
  }
  return data.dimensions as EvalDimension[];
}
