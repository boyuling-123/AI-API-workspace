import type { ApiDocParseResult } from "@/types";

/**
 * 前端调用 /api/parse-doc：把粘贴的 API 文档交给大模型解读，返回结构化结果用于透出展示。
 * 仅展示，不回写 ApiConfig。
 */
export async function parseApiDoc(
  doc: string,
  modelId: string,
  signal?: AbortSignal
): Promise<ApiDocParseResult> {
  const response = await fetch("/api/parse-doc", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ doc, modelId }),
    signal,
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error ?? `文档解读失败（${response.status}）`);
  }
  return data as ApiDocParseResult;
}
