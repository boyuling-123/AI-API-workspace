import type { BaseModelConfig, GenDataRequest, TaskInput } from "@/types";

/**
 * 前端调用 /api/gen-data（v4.8）：把造数据需求 + 选定的基础大模型配置交给后端，
 * 后端调用大模型生成数据，返回归一化的 TaskInput[]。key 仅本地存储、走本地后端代理。
 */
export async function generateTaskData(
  request: GenDataRequest,
  baseModel: BaseModelConfig,
  signal?: AbortSignal
): Promise<TaskInput[]> {
  const response = await fetch("/api/gen-data", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ request, baseModel }),
    signal,
  });

  const data = await response.json();
  if (!response.ok || !data.ok) {
    throw new Error(data?.error ?? `造数据失败（${response.status}）`);
  }
  return data.items as TaskInput[];
}
