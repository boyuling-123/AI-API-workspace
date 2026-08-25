import type { GenDataRequest, TaskInput } from "@/types";

/**
 * 前端调用 /api/gen-data：把造数据需求交给大模型，返回归一化的 TaskInput[]。
 */
export async function generateTaskData(
  request: GenDataRequest,
  modelId: string,
  signal?: AbortSignal
): Promise<TaskInput[]> {
  const response = await fetch("/api/gen-data", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ request, modelId }),
    signal,
  });

  const data = await response.json();
  if (!response.ok || !data.ok) {
    throw new Error(data?.error ?? `造数据失败（${response.status}）`);
  }
  return data.items as TaskInput[];
}
