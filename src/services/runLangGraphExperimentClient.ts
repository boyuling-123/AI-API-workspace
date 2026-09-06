import { parseLangGraphExperiment } from "@/lib/langgraphExperiment";

export async function runLangGraphExperimentClient(signal?: AbortSignal) {
  const response = await fetch("/api/experiments/langgraph", {
    method: "POST", headers: { "x-eval-experiment": "langgraph-mock" }, signal,
  });
  if (!response.ok) {
    // Never display an arbitrary server/proxy response body.
    throw new Error(response.status === 409 ? "另一个框架实验正在运行，请稍后重试。"
      : response.status === 504 ? "框架实验超时，请重试。" : "框架实验暂不可用，请重试或重启本地平台。");
  }
  try { return parseLangGraphExperiment(await response.json()); }
  catch { throw new Error("框架实验返回格式不正确，未替换之前的结果。"); }
}
