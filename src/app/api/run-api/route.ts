import { NextResponse } from "next/server";
import { callAlgorithmApi } from "@/services/algoClient";
import type { TargetConfig } from "@/types";

export const runtime = "nodejs";
export const maxDuration = 60;

interface RunApiBody {
  apiConfig: TargetConfig;
  paramValues: Record<string, unknown>;
}

/**
 * 算法 API 纯执行路由：执行调用并返回归一化输出，不附带原始响应（省内存）。
 * 鉴权 key 由 algoClient 在服务端按 apiKeyRef 注入。
 */
export async function POST(request: Request) {
  let body: RunApiBody;
  try {
    body = (await request.json()) as RunApiBody;
  } catch {
    return NextResponse.json(
      { error: "请求体解析失败，需为合法 JSON" },
      { status: 400 }
    );
  }

  if (!body.apiConfig?.requestTemplate?.url) {
    return NextResponse.json(
      { error: "缺少 apiConfig 或其 requestTemplate.url" },
      { status: 400 }
    );
  }

  try {
    const result = await callAlgorithmApi(
      body.apiConfig,
      body.paramValues ?? {},
      { withRaw: false, baseOrigin: new URL(request.url).origin }
    );
    return NextResponse.json({
      outputText: result.outputText,
      outputImages: result.outputImages,
      latencyMs: result.latencyMs,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "未知错误";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
