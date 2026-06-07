import type { BaseModelConfig, BaseModelProtocol } from "@/types";

export type ResolvedBaseModelProtocol = Exclude<BaseModelProtocol, "auto">;

export interface NormalizedBaseModelConfig
  extends Omit<BaseModelConfig, "protocol"> {
  protocol: BaseModelProtocol;
}

export function normalizeBaseModelConfig(
  config: BaseModelConfig
): NormalizedBaseModelConfig {
  return {
    ...config,
    protocol: config.protocol ?? "auto",
  };
}

export function withResolvedProtocol(
  config: BaseModelConfig,
  protocol: ResolvedBaseModelProtocol
): BaseModelConfig {
  return {
    ...config,
    protocol,
  };
}

export function getBaseModelProtocolOrder(
  config: Pick<BaseModelConfig, "baseUrl" | "protocol">
): ResolvedBaseModelProtocol[] {
  if (config.protocol === "openai" || config.protocol === "anthropic") {
    return [config.protocol];
  }

  const lower = config.baseUrl.trim().toLowerCase();
  const guessed: ResolvedBaseModelProtocol[] = [];

  if (lower.includes("/anthropic") || lower.endsWith("/v1/messages")) {
    guessed.push("anthropic");
  }
  if (
    lower.includes("/openai") ||
    lower.includes("/compatible-mode") ||
    lower.endsWith("/v1") ||
    lower.endsWith("/chat/completions")
  ) {
    guessed.push("openai");
  }

  if (guessed.length === 0) {
    guessed.push("anthropic");
  }
  if (!guessed.includes("openai")) {
    guessed.push("openai");
  }
  if (!guessed.includes("anthropic")) {
    guessed.push("anthropic");
  }

  return guessed;
}

export function buildAnthropicMessagesUrl(baseUrl: string): string {
  const normalized = trimTrailingSlash(baseUrl);
  if (normalized.endsWith("/v1/messages")) {
    return normalized;
  }
  if (normalized.endsWith("/v1")) {
    return `${normalized}/messages`;
  }
  return `${normalized}/v1/messages`;
}

export function buildOpenAIChatCompletionsUrl(baseUrl: string): string {
  const normalized = trimTrailingSlash(baseUrl);
  if (
    normalized.endsWith("/v1/chat/completions") ||
    normalized.endsWith("/chat/completions")
  ) {
    return normalized;
  }
  if (normalized.endsWith("/v1")) {
    return `${normalized}/chat/completions`;
  }
  return `${normalized}/v1/chat/completions`;
}

export async function parseJsonResponse<T>(
  response: Response,
  providerLabel: string
): Promise<T> {
  const rawText = await response.text();
  const text = rawText.trim();

  if (!text) {
    throw new Error(`${providerLabel} 返回空响应（HTTP ${response.status}）`);
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(
      `${providerLabel} 返回了非 JSON 内容（HTTP ${response.status}，${describeUnexpectedPayload(
        text
      )}）`
    );
  }
}

function trimTrailingSlash(value: string): string {
  return value.trim().replace(/\/+$/, "");
}

function describeUnexpectedPayload(text: string): string {
  if (/^\s*</.test(text)) {
    return "疑似 HTML 页面";
  }
  const preview = text.replace(/\s+/g, " ").slice(0, 120);
  return `响应片段：${preview}`;
}
