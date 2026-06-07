import type { BaseModelConfig, EvalDimension } from "@/types";

/**
 * 前端调用 /api/gen-dimensions（v4.8）：用户描述测评需求 + 选定的基础大模型配置 → 后端生成若干候选维度。
 * 内置预设维度集仅作模型内部参考，不透出给用户。key 仅本地存储、走本地后端代理。
 */
export async function generateDimensionsClient(
  userRequirement: string,
  baseModel: BaseModelConfig,
  signal?: AbortSignal
): Promise<EvalDimension[]> {
  const response = await fetch("/api/gen-dimensions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userRequirement, baseModel }),
    signal,
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error ?? `生成维度失败（${response.status}）`);
  }
  return data.dimensions as EvalDimension[];
}
