import type { ImageItem, NormalizedLlmOutput } from "@/types";
import { RUNTIME_CONFIG } from "@/config/runtime";
import type { AdapterCallParams } from "./types";

interface AnthropicCompatibleOptions {
  baseUrl: string;
  apiKey: string;
  apiModelName: string;
}

/** Anthropic 兼容网关的文本块。 */
interface TextBlock {
  type: "text";
  text: string;
}

/** Anthropic 兼容网关的图片块：url 或 base64 两种 source。 */
interface ImageBlock {
  type: "image";
  source:
    | { type: "url"; url: string }
    | { type: "base64"; media_type: string; data: string };
}

type ContentBlock = TextBlock | ImageBlock;

/** 从 data URL（data:image/png;base64,xxx）里拆出 media_type 与纯 base64 数据。 */
function parseDataUrl(value: string): { mediaType: string; data: string } {
  const match = value.match(/^data:([^;]+);base64,([\s\S]*)$/);
  if (match) {
    return { mediaType: match[1], data: match[2] };
  }
  // 不是标准 data URL，按裸 base64 处理，默认 jpeg。
  return { mediaType: "image/jpeg", data: value };
}

/**
 * 把平台内部的 ImageItem 转成 Anthropic 网关的图片块。
 * source==='url' → url 块；source==='base64' → base64 块（兼容 data URL 与裸 base64）。
 */
function toImageBlock(image: ImageItem): ImageBlock {
  if (image.source === "url") {
    return { type: "image", source: { type: "url", url: image.value } };
  }
  const { mediaType, data } = parseDataUrl(image.value);
  return {
    type: "image",
    source: { type: "base64", media_type: mediaType, data },
  };
}

/**
 * 组装用户消息的 content：无图时直接发文本字符串；有图时拼成
 * [图片块..., 文本块] 的多模态数组（图在前、文本在后，符合多数视觉模型习惯）。
 */
function buildUserContent(
  prompt: string,
  images?: ImageItem[]
): string | ContentBlock[] {
  if (!images || images.length === 0) {
    return prompt;
  }
  const blocks: ContentBlock[] = images.map(toImageBlock);
  blocks.push({ type: "text", text: prompt });
  return blocks;
}

interface AnthropicMessageResponse {
  content?: { type: string; text?: string }[];
  error?: { message?: string };
  message?: string;
}

/**
 * 调用 DashScope（百炼）Anthropic 兼容网关 /v1/messages。
 * 文本结果在 content[] 中 type==='text' 的 text 字段，归一化为统一输出。
 */
export async function callAnthropicCompatible(
  options: AnthropicCompatibleOptions,
  params: AdapterCallParams
): Promise<NormalizedLlmOutput> {
  const { baseUrl, apiKey, apiModelName } = options;
  const { prompt, images, signal } = params;

  const timeoutController = new AbortController();
  const timeoutId = setTimeout(
    () => timeoutController.abort(),
    RUNTIME_CONFIG.callTimeoutMs
  );
  const mergedSignal = mergeAbortSignals(signal, timeoutController.signal);

  const startTime = Date.now();
  try {
    const response = await fetch(`${baseUrl}/v1/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: apiModelName,
        max_tokens: params.maxTokens ?? RUNTIME_CONFIG.maxTokens,
        messages: [
          { role: "user", content: buildUserContent(prompt, images) },
        ],
        thinking: { type: "disabled" },
      }),
      signal: mergedSignal,
    });

    const data = (await response.json()) as AnthropicMessageResponse;
    if (!response.ok) {
      const message =
        data.error?.message ?? data.message ?? `HTTP ${response.status}`;
      throw new Error(message);
    }

    const outputText = (data.content ?? [])
      .filter((block) => block.type === "text" && block.text)
      .map((block) => block.text)
      .join("");

    return {
      outputText,
      outputImages: [],
      latencyMs: Date.now() - startTime,
    };
  } finally {
    clearTimeout(timeoutId);
  }
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
