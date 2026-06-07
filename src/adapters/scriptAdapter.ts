import type { ImageItem, NormalizedLlmOutput, TargetConfig } from "@/types";
import { runScript } from "@/services/script/runScriptService";
import { getApiKey } from "@/services/getApiKey";

/**
 * 脚本目标执行参数（v4.2，仅用户接入的非 preset custom 目标）。
 * 真实参数值来自 TaskInput（prompt / images / extraFields），打包成 params JSON 经 stdin 传脚本。
 */
export interface ScriptAdapterParams {
  target: TargetConfig;
  prompt: string;
  images?: ImageItem[];
  /** 其余入参真实值（来自 TaskInput.extraFields），与 prompt 一起打包成 params JSON。 */
  paramValues?: Record<string, unknown>;
  signal?: AbortSignal;
}

/**
 * 把入参图片转成脚本可读的字符串数组（url 直传 / base64 取 value）。
 * 脚本从 params.images 取这些图片地址，自行决定如何使用。
 */
function imagesToParamValue(images: ImageItem[] | undefined): string[] {
  if (!images || images.length === 0) {
    return [];
  }
  return images.map((image) => image.value).filter((value) => Boolean(value));
}

/**
 * 执行一个脚本目标，归一化输出为 { outputText, outputImages[], latencyMs }。
 *
 * 约定（详见 PRD v4.2 决策 2/3/6）：
 *  - 参数打包成 params JSON 经 stdin 传给脚本（禁字符串替换进 code）。
 *  - 结果以 ===RESULT_JSON_START==={...}===RESULT_JSON_END=== 标记提取，非空判成功。
 *  - 图片产物转 base64 data URL 收进结果体系（runScript 内部已处理）。
 *
 * 同进程直接调用 runScriptService（不走 HTTP 往返），输出失败时抛错由上层捕获为该格子错误状态。
 */
export async function runScriptTarget(
  params: ScriptAdapterParams
): Promise<NormalizedLlmOutput> {
  const { target, prompt, images, paramValues = {} } = params;
  const script = target.script;
  if (!script) {
    throw new Error(`目标 ${target.name} 缺少 script，无法走脚本路径执行`);
  }

  // params JSON：prompt + 图片 + 其余入参，经 stdin 注入脚本（禁字符串替换进 code）。
  const stdinParams: Record<string, unknown> = {
    prompt,
    images: imagesToParamValue(images),
    ...paramValues,
  };

  // 仅注入该目标声明的那一个 key（决策7）；无 apiKeyRef 时不注入。
  let apiKeyValue: string | undefined;
  if (target.apiKeyRef) {
    try {
      apiKeyValue = getApiKey(target.apiKeyRef);
    } catch {
      apiKeyValue = undefined;
    }
  }

  const result = await runScript({
    lang: script.lang,
    code: script.code,
    paramValues: stdinParams,
    apiKeyEnvName: target.apiKeyRef,
    apiKeyValue,
  });

  if (!result.ok) {
    const detail = [
      result.error,
      result.stderr ? `stderr: ${result.stderr}` : "",
      result.envInfo ? `env: ${result.envInfo}` : "",
    ]
      .filter(Boolean)
      .join("\n");
    throw new Error(detail || "脚本执行失败");
  }

  return {
    outputText: result.text,
    outputImages: result.images,
    latencyMs: result.latencyMs,
  };
}
