import type { NormalizedLlmOutput, TargetConfig } from "@/types";

/**
 * 前端侧算法 API 调用入口：转发到服务端 /api/run-api（key 注入只在服务端）。
 * 归一化结构与大模型一致（NormalizedLlmOutput），供 runService 统一聚合。
 */
export async function runAlgorithmApi(
  target: TargetConfig,
  paramValues: Record<string, unknown>,
  signal?: AbortSignal
): Promise<NormalizedLlmOutput> {
  const response = await fetch("/api/run-api", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ apiConfig: target, paramValues }),
    signal,
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error ?? `算法 API 调用失败（${response.status}）`);
  }
  return data as NormalizedLlmOutput;
}
