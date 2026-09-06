import { isLocalRequest } from "@/server/localRequest";
import { ExperimentError, runLangGraphExperiment } from "@/server/langgraphExperiment";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store" };

export async function POST(request: Request) {
  if (!isLocalRequest(request, "x-eval-experiment", "langgraph-mock")) {
    return Response.json({ error: "仅允许从本机工作台运行固定实验。" }, { status: 403, headers });
  }
  if (new URL(request.url).search) return Response.json({ error: "固定实验不接受参数或原始数据。" }, { status: 400, headers });
  // Do not buffer arbitrary input. The endpoint has no user-data input contract.
  if (request.body) {
    const reader = request.body.getReader();
    try {
      const first = await reader.read();
      if (!first.done) {
        await reader.cancel();
        return Response.json({ error: "固定实验不接受参数或原始数据。" }, { status: 400, headers });
      }
    } catch { return Response.json({ error: "请求已中断或格式不正确。" }, { status: 400, headers }); }
    finally { reader.releaseLock(); }
  }
  try { return Response.json(await runLangGraphExperiment(request.signal), { headers }); }
  catch (error) {
    return Response.json({ error: error instanceof ExperimentError ? error.message : "本地实验失败，请重试。" },
      { status: error instanceof ExperimentError ? error.status : 503, headers });
  }
}
