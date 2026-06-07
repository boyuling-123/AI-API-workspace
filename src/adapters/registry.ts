import type { ImageItem, NormalizedLlmOutput, TargetConfig } from "@/types";
import { runCustomTarget } from "./customAdapter";
import { runComfyuiTarget } from "./comfyuiAdapter";
import { runScriptTarget } from "./scriptAdapter";

/**
 * adapter 三类（v4.2）：built-in / script / comfyui。
 *
 * 统一执行入口：上层只调 runTarget(target, ...)，差异全收敛在此，禁止按目标差异 if-else。
 * 输出统一归一化为 { outputText, outputImages[], latencyMs }。
 *
 * 执行路径分流（决策 1，红线：preset 禁走脚本路径）：
 *  - comfyui 目标            → comfyui adapter（固定形态，沿用 v4）。
 *  - preset 内置目标         → built-in adapter（平台写死 HTTP，读 requestTemplate，沿用 v1.x 旧逻辑）。
 *  - 非 preset 的 custom 目标 → script adapter（用户接入，本机子进程执行脚本）。
 */
export interface RunTargetParams {
  prompt: string;
  images?: ImageItem[];
  paramValues?: Record<string, unknown>;
  signal?: AbortSignal;
  /** 服务端调用源 origin，用于把内置相对路由（如 /api/mock-algo）补全为绝对 url。 */
  baseOrigin?: string;
}

/** 判断目标走哪条执行路径。 */
export function resolveAdapterKind(
  target: TargetConfig
): "built-in" | "script" | "comfyui" {
  if (target.type === "comfyui") {
    return "comfyui";
  }
  return target.preset ? "built-in" : "script";
}

export async function runTarget(
  target: TargetConfig,
  params: RunTargetParams
): Promise<NormalizedLlmOutput> {
  const kind = resolveAdapterKind(target);

  if (kind === "comfyui") {
    return runComfyuiTarget({
      target,
      prompt: params.prompt,
      signal: params.signal,
    });
  }

  if (kind === "script") {
    return runScriptTarget({
      target,
      prompt: params.prompt,
      images: params.images,
      paramValues: params.paramValues,
      signal: params.signal,
    });
  }

  // built-in：preset 内置目标，复用现有 HTTP 调用逻辑。
  return runCustomTarget({
    target,
    prompt: params.prompt,
    images: params.images,
    paramValues: params.paramValues,
    signal: params.signal,
    baseOrigin: params.baseOrigin,
  });
}
