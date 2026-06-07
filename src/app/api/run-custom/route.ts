import { NextResponse } from "next/server";
import { runTarget } from "@/adapters/registry";
import type { ImageItem, TargetConfig } from "@/types";

export const runtime = "nodejs";
export const maxDuration = 60;

interface RunCustomBody {
  target: TargetConfig;
  prompt: string;
  images?: ImageItem[];
  paramValues?: Record<string, unknown>;
}

/**
 * 统一执行入口（v4 M2）：合并原 /api/chat（预置大模型）与 /api/run-api（算法）两条路径。
 * 前端只需把整个 TargetConfig + 运行参数发到这里，服务端经 runTarget 统一分发
 * （custom 内部再判 DashScope/通用 template；comfyui 走三步），归一化输出。
 *
 * 鉴权 key 由各 adapter 在服务端按 apiKeyRef 注入，绝不经过前端。
 * baseOrigin 传给 adapter，用于把内置相对路由（如 /api/mock-algo）补全为绝对 url。
 */
export async function POST(request: Request) {
  let body: RunCustomBody;
  try {
    body = (await request.json()) as RunCustomBody;
  } catch {
    return NextResponse.json(
      { error: "请求体解析失败，需为合法 JSON" },
      { status: 400 }
    );
  }

  if (!body.target?.id) {
    return NextResponse.json({ error: "缺少 target 配置" }, { status: 400 });
  }
  if (typeof body.prompt !== "string") {
    return NextResponse.json({ error: "缺少 prompt" }, { status: 400 });
  }

  try {
    const result = await runTarget(body.target, {
      prompt: body.prompt,
      images: body.images,
      paramValues: body.paramValues,
      baseOrigin: new URL(request.url).origin,
    });
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
