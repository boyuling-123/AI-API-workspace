import type { NormalizedLlmOutput, ParamDef, TargetConfig } from "@/types";
import { getApiKey } from "@/services/getApiKey";

/**
 * 算法 API adapter（服务端运行）。
 *
 * 职责：
 * 1. 根据 ApiConfig 把用户填写的参数值组装成 HTTP 请求（GET query / POST body）。
 * 2. 注入鉴权：若配置了 apiKeyRef，则按引用名从服务端环境变量取真值放入 Authorization。
 * 3. 按 outputTextPath / outputImagePath 从响应里提取输出，归一化为 NormalizedLlmOutput。
 *
 * 设计约束：key 真值仅在服务端注入，绝不经过前端。
 */

export interface AlgoCallResult extends NormalizedLlmOutput {
  /** 原始响应（截断后）用于诊断，仅 test-api 透出。 */
  rawResponse?: unknown;
}

/** 按 a.b[0].c 形式的路径从对象中取值。路径为空返回 undefined。 */
function getByPath(source: unknown, path?: string): unknown {
  if (!path) return undefined;
  const segments = path
    .replace(/\[(\d+)\]/g, ".$1")
    .split(".")
    .filter((segment) => segment.length > 0);

  let current: unknown = source;
  for (const segment of segments) {
    if (current == null || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

/** 把提取到的图片值归一化为字符串数组（支持单个字符串或字符串数组）。 */
function normalizeImages(value: unknown): string[] {
  if (value == null) return [];
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string");
  }
  if (typeof value === "string") return [value];
  return [];
}

/** 把提取到的文本值归一化为字符串。 */
function normalizeText(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  return JSON.stringify(value);
}

/**
 * 按 ParamDef 校验并转换用户填写的参数值，缺失必填项时抛错。
 * 仅作类型对齐与必填校验，不修改值本身的语义。
 */
function buildPayload(
  inputParams: ParamDef[],
  paramValues: Record<string, unknown>
): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  for (const def of inputParams) {
    const raw = paramValues[def.name];
    const hasValue = raw !== undefined && raw !== null && raw !== "";
    if (!hasValue) {
      if (def.required) {
        throw new Error(`缺少必填参数：${def.name}`);
      }
      if (def.defaultValue !== undefined) {
        payload[def.name] = def.defaultValue;
      }
      continue;
    }
    payload[def.name] = coerceByType(def.type, raw);
  }
  return payload;
}

function coerceByType(type: ParamDef["type"], raw: unknown): unknown {
  switch (type) {
    case "number": {
      const num = typeof raw === "number" ? raw : Number(raw);
      if (Number.isNaN(num)) {
        throw new Error(`参数类型不匹配，期望 number：${String(raw)}`);
      }
      return num;
    }
    case "boolean":
      return typeof raw === "boolean" ? raw : raw === "true" || raw === true;
    default:
      return raw;
  }
}

/** 构造请求头：合并自定义 headers + 注入鉴权 + 默认 Content-Type。 */
function buildHeaders(target: TargetConfig): Record<string, string> {
  const template = target.requestTemplate;
  const headers: Record<string, string> = {};
  for (const { key, value } of template?.headers ?? []) {
    if (key) headers[key] = value;
  }
  if (target.apiKeyRef) {
    const apiKey = getApiKey(target.apiKeyRef);
    if (!headers["Authorization"]) {
      headers["Authorization"] = `Bearer ${apiKey}`;
    }
  }
  if (template?.method === "POST" && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }
  return headers;
}

/**
 * 把相对 url（以 '/' 开头，指向本平台内置路由如 mock-algo）补全为绝对 url。
 * 服务端 fetch 不接受相对路径，优先用调用方传入的 baseOrigin（来自请求头），
 * 兜底用环境变量 / localhost:3000。
 */
function resolveUrl(url: string, baseOrigin?: string): string {
  if (/^https?:\/\//.test(url)) return url;
  const origin =
    baseOrigin ??
    process.env.NEXT_PUBLIC_BASE_URL ??
    (process.env.PORT ? `http://localhost:${process.env.PORT}` : "http://localhost:3000");
  return new URL(url, origin).toString();
}

/** 把 payload 拼到 url 的 query string 上（GET 用）。 */
function appendQuery(url: string, payload: Record<string, unknown>): string {
  const target = new URL(url);
  for (const [key, value] of Object.entries(payload)) {
    target.searchParams.set(key, String(value));
  }
  return target.toString();
}

/**
 * 执行一次算法 API 调用并归一化输出。
 * @param withRaw 是否在结果里附带原始响应（test-api 诊断用，run-api 不带以省内存）。
 */
export async function callAlgorithmApi(
  target: TargetConfig,
  paramValues: Record<string, unknown>,
  options?: { signal?: AbortSignal; withRaw?: boolean; baseOrigin?: string }
): Promise<AlgoCallResult> {
  const template = target.requestTemplate;
  if (!template?.url) {
    throw new Error(`目标 ${target.name} 缺少 requestTemplate.url`);
  }
  const payload = buildPayload(target.inputParams ?? [], paramValues);
  const headers = buildHeaders(target);

  const isGet = template.method === "GET";
  const resolvedUrl = resolveUrl(template.url, options?.baseOrigin);
  const requestUrl = isGet ? appendQuery(resolvedUrl, payload) : resolvedUrl;

  const startedAt = Date.now();
  const response = await fetch(requestUrl, {
    method: template.method,
    headers,
    body: isGet ? undefined : JSON.stringify(payload),
    signal: options?.signal,
  });
  const latencyMs = Date.now() - startedAt;

  const text = await response.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = text;
  }

  if (!response.ok) {
    const detail =
      typeof parsed === "string" ? parsed : JSON.stringify(parsed);
    throw new Error(
      `算法 API 返回 ${response.status}：${detail.slice(0, 500)}`
    );
  }

  const outputText = normalizeText(
    template.outputTextPath
      ? getByPath(parsed, template.outputTextPath)
      : parsed
  );
  const outputImages = normalizeImages(
    getByPath(parsed, template.outputImagePath)
  );

  return {
    outputText,
    outputImages,
    latencyMs,
    rawResponse: options?.withRaw ? parsed : undefined,
  };
}
