import type { ImageItem, NormalizedLlmOutput, TargetConfig } from "@/types";
import { RUNTIME_CONFIG } from "@/config/runtime";
import { getApiKey } from "@/services/getApiKey";
import { callAnthropicCompatible } from "./anthropicCompatible";
import { applyPreprocess } from "@/services/preprocess";
import { extractByPath } from "@/services/jsonPath";

/**
 * 统一 custom 目标执行参数。
 * 真实参数值来自 TaskInput（prompt / images / extraFields），定义来自 TargetConfig。
 */
export interface CustomAdapterParams {
  target: TargetConfig;
  prompt: string;
  images?: ImageItem[];
  /** 其余入参真实值（来自 TaskInput.extraFields）。 */
  paramValues?: Record<string, unknown>;
  signal?: AbortSignal;
  maxTokens?: number;
  /** 服务端调用源 origin，用于把内置相对路由补全为绝对 url。 */
  baseOrigin?: string;
}

/** 判断是否为经 DashScope Anthropic 兼容网关调用的大模型目标。 */
function isDashscopeAnthropic(target: TargetConfig): boolean {
  const url = target.requestTemplate?.url ?? "";
  return url.includes("/apps/anthropic");
}

/** 把 bodyTemplate 中的 {{参数}} 占位替换为真实值。 */
function fillBodyTemplate(
  bodyTemplate: string,
  values: Record<string, unknown>
): string {
  return bodyTemplate.replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (_, name: string) => {
    const value = values[name];
    if (value === undefined || value === null) {
      return "";
    }
    return typeof value === "string" ? value : JSON.stringify(value);
  });
}

function mergeAbortSignals(
  external: AbortSignal | undefined,
  internal: AbortSignal
): AbortSignal {
  if (!external) {
    return internal;
  }
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (external.aborted || internal.aborted) {
    controller.abort();
  }
  external.addEventListener("abort", abort);
  internal.addEventListener("abort", abort);
  return controller.signal;
}

/**
 * 统一执行一个 custom 目标，归一化输出为 { outputText, outputImages[], latencyMs }。
 *
 * 两条内部分支（差异全收敛在此，上层禁止 if-else）：
 *  - DashScope Anthropic 兼容大模型：复用 callAnthropicCompatible（保住已验证的多模态图片 block 能力）。
 *  - 其他 custom 目标（用户接入的算法/生图/大模型）：走通用 requestTemplate 执行。
 */
export async function runCustomTarget(
  params: CustomAdapterParams
): Promise<NormalizedLlmOutput> {
  const {
    target,
    prompt,
    images,
    paramValues = {},
    signal,
    maxTokens,
    baseOrigin,
  } = params;
  const template = target.requestTemplate;
  if (!template) {
    throw new Error(`目标 ${target.name} 缺少 requestTemplate，无法执行`);
  }

  if (isDashscopeAnthropic(target)) {
    const apiModelName = extractDashscopeModelName(template.bodyTemplate);
    return callAnthropicCompatible(
      {
        baseUrl: RUNTIME_CONFIG.dashscopeBaseUrl,
        apiKey: getApiKey(target.apiKeyRef),
        apiModelName,
      },
      { prompt, images, signal, maxTokens }
    );
  }

  return runGenericTemplate(
    target,
    template,
    prompt,
    paramValues,
    images,
    signal,
    baseOrigin
  );
}

/**
 * 把相对 url（以 '/' 开头，指向本平台内置路由如 /api/mock-algo）补全为绝对 url。
 * 服务端 fetch 不接受相对路径，优先用调用方传入的 baseOrigin，兜底环境变量 / localhost。
 */
function resolveUrl(url: string, baseOrigin?: string): string {
  if (/^https?:\/\//.test(url)) {
    return url;
  }
  const origin =
    baseOrigin ??
    process.env.NEXT_PUBLIC_BASE_URL ??
    (process.env.PORT
      ? `http://localhost:${process.env.PORT}`
      : "http://localhost:3000");
  return new URL(url, origin).toString();
}

/** 从预置大模型的 bodyTemplate 里取出 model 字段（apiModelName）。 */
function extractDashscopeModelName(bodyTemplate: string): string {
  try {
    const parsed = JSON.parse(bodyTemplate) as { model?: string };
    if (parsed.model) {
      return parsed.model;
    }
  } catch {
    // bodyTemplate 非合法 JSON 时退回正则提取。
  }
  const match = bodyTemplate.match(/"model"\s*:\s*"([^"]+)"/);
  if (!match) {
    throw new Error("无法从 bodyTemplate 解析 model 字段");
  }
  return match[1];
}

/** 通用 requestTemplate 执行：preprocess → 填充 → 非流式请求 → 按 outputPath 取 → 归一化。 */
async function runGenericTemplate(
  target: TargetConfig,
  template: NonNullable<TargetConfig["requestTemplate"]>,
  prompt: string,
  paramValues: Record<string, unknown>,
  images: ImageItem[] | undefined,
  signal: AbortSignal | undefined,
  baseOrigin: string | undefined
): Promise<NormalizedLlmOutput> {
  const timeoutController = new AbortController();
  const timeoutId = setTimeout(
    () => timeoutController.abort(),
    RUNTIME_CONFIG.callTimeoutMs
  );
  const mergedSignal = mergeAbortSignals(signal, timeoutController.signal);
  const startTime = Date.now();

  try {
    const baseValues: Record<string, unknown> = { prompt, ...paramValues };
    const prepared = await applyPreprocess(template.preprocess, {
      target,
      values: baseValues,
      images,
    });

    const filledBody = fillBodyTemplate(template.bodyTemplate, prepared.values);
    const headers: Record<string, string> = {};
    for (const header of template.headers) {
      headers[header.key] = header.value;
    }
    if (target.apiKeyRef && !headers.Authorization && !headers.authorization) {
      headers.Authorization = `Bearer ${getApiKey(target.apiKeyRef)}`;
    }
    Object.assign(headers, prepared.extraHeaders);

    const requestInit: RequestInit = {
      method: template.method,
      headers,
      signal: mergedSignal,
    };
    if (template.method === "POST") {
      requestInit.body = filledBody;
      if (!headers["Content-Type"] && !headers["content-type"]) {
        headers["Content-Type"] = "application/json";
      }
    }

    const resolvedUrl = resolveUrl(template.url, baseOrigin);
    const url =
      template.method === "GET"
        ? appendQuery(resolvedUrl, prepared.values)
        : resolvedUrl;

    const response = await fetch(url, requestInit);
    const data = (await response.json()) as Record<string, unknown>;
    if (!response.ok) {
      const message =
        (data as { error?: { message?: string }; message?: string }).error
          ?.message ??
        (data as { message?: string }).message ??
        `HTTP ${response.status}`;
      throw new Error(message);
    }

    const outputText = template.outputTextPath
      ? String(extractByPath(data, template.outputTextPath) ?? "")
      : "";
    const outputImages = template.outputImagePath
      ? normalizeImages(extractByPath(data, template.outputImagePath))
      : [];

    return {
      outputText,
      outputImages,
      latencyMs: Date.now() - startTime,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

/** GET 请求把参数拼到 query string。 */
function appendQuery(url: string, values: Record<string, unknown>): string {
  const query = Object.entries(values)
    .filter(([, value]) => value !== undefined && value !== null)
    .map(
      ([key, value]) =>
        `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`
    )
    .join("&");
  if (!query) {
    return url;
  }
  return url.includes("?") ? `${url}&${query}` : `${url}?${query}`;
}

/** 把响应里取到的图片字段归一化为字符串数组（兼容单图字符串 / 数组）。 */
function normalizeImages(raw: unknown): string[] {
  if (!raw) {
    return [];
  }
  if (typeof raw === "string") {
    return [raw];
  }
  if (Array.isArray(raw)) {
    return raw.filter((item): item is string => typeof item === "string");
  }
  return [];
}
