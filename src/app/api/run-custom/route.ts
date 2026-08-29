import { NextResponse } from "next/server";
import { runTarget } from "@/adapters/registry";
import type { ImageItem, TargetConfig } from "@/types";
import { normalizeRunPolicy } from "@/lib/runPolicy";
import { normalizeRunError, RunError } from "@/lib/runError";

export const runtime = "nodejs";
export const maxDuration = 60;

interface RunCustomBody {
  target: TargetConfig;
  prompt: string;
  images?: ImageItem[];
  paramValues?: Record<string, unknown>;
  timeoutMs?: number;
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
      {
        error: "请求体解析失败，需为合法 JSON",
        errorType: "client",
        retryable: false,
      },
      { status: 400 }
    );
  }

  if (!body.target?.id) {
    return NextResponse.json(
      { error: "缺少 target 配置", errorType: "client", retryable: false },
      { status: 400 }
    );
  }
  if (typeof body.prompt !== "string") {
    return NextResponse.json(
      { error: "缺少 prompt", errorType: "client", retryable: false },
      { status: 400 }
    );
  }

  const timeoutMs = normalizeRunPolicy({ timeoutMs: body.timeoutMs }).timeoutMs;
  const controller = new AbortController();
  let timedOut = false;
  const onRequestAbort = () => controller.abort(request.signal.reason);
  if (request.signal.aborted) {
    onRequestAbort();
  } else {
    request.signal.addEventListener("abort", onRequestAbort, { once: true });
  }
  const timeoutId = setTimeout(() => {
    timedOut = true;
    controller.abort(new DOMException("Request timeout", "AbortError"));
  }, timeoutMs);

  try {
    const result = await runTarget(body.target, {
      prompt: body.prompt,
      images: body.images,
      paramValues: body.paramValues,
      baseOrigin: new URL(request.url).origin,
      signal: controller.signal,
    });
    return NextResponse.json({
      outputText: result.outputText,
      outputImages: result.outputImages,
      latencyMs: result.latencyMs,
    });
  } catch (error) {
    const runError =
      timedOut && !request.signal.aborted
        ? new RunError(`请求超过 ${Math.round(timeoutMs / 1_000)} 秒`, {
            type: "timeout",
            cause: error,
          })
        : normalizeRunError(error);
    return NextResponse.json(
      {
        error: runError.message,
        errorType: runError.type,
        retryable: runError.retryable,
        httpStatus: runError.httpStatus,
      },
      { status: responseStatusFor(runError) }
    );
  } finally {
    clearTimeout(timeoutId);
    request.signal.removeEventListener("abort", onRequestAbort);
  }
}

function responseStatusFor(error: RunError): number {
  if (error.type === "auth") return error.httpStatus ?? 401;
  if (error.type === "rate_limit") return 429;
  if (error.type === "timeout") return 504;
  if (error.type === "client") return error.httpStatus ?? 400;
  if (error.type === "parse" || error.type === "network" || error.type === "server") {
    return 502;
  }
  return 500;
}
