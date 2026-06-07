import type { ApiDocParseResult, BaseModelConfig } from "@/types";

/**
 * 前端调用 /api/parse-doc（v4.8）：把粘贴的 API 文档 + 选定的基础大模型配置交给后端，
 * 后端调用大模型结构化解读，返回结果用于透出展示。key 仅本地存储、随请求走本地后端代理。
 */
export async function parseApiDoc(
  doc: string,
  baseModel: BaseModelConfig,
  signal?: AbortSignal
): Promise<ApiDocParseResult> {
  const response = await fetch("/api/parse-doc", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ doc, baseModel }),
    signal,
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error ?? `文档解读失败（${response.status}）`);
  }
  return data as ApiDocParseResult;
}
