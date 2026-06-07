import type { ImageItem, NormalizedLlmOutput } from "@/types";
import { RUNTIME_CONFIG } from "@/config/runtime";
import type { AdapterCallParams } from "./types";
import {
  buildOpenAIChatCompletionsUrl,
  parseJsonResponse,
} from "./baseModelProtocol";

interface OpenAICompatibleOptions {
  baseUrl: string;
  apiKey: string;
  apiModelName: string;
}

interface OpenAITextPart {
  type: "text";
  text: string;
}

interface OpenAIImagePart {
  type: "image_url";
  image_url: {
    url: string;
  };
}

type OpenAIContentPart = OpenAITextPart | OpenAIImagePart;

interface OpenAIChatResponse {
  choices?: {
    message?: {
      content?: string | Array<{ type?: string; text?: string }>;
    };
  }[];
  error?: { message?: string };
  message?: string;
}

function toImageUrl(image: ImageItem): string {
  if (image.source === "url") {
    return image.value;
  }
  if (image.value.startsWith("data:")) {
    return image.value;
  }
  return `data:image/jpeg;base64,${image.value}`;
}

function buildUserContent(
  prompt: string,
  images?: ImageItem[]
): string | OpenAIContentPart[] {
  if (!images || images.length === 0) {
    return prompt;
  }

  return [
    ...images.map<OpenAIImagePart>((image) => ({
      type: "image_url",
      image_url: { url: toImageUrl(image) },
    })),
    { type: "text", text: prompt },
  ];
}

export async function callOpenAICompatible(
  options: OpenAICompatibleOptions,
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
    const response = await fetch(buildOpenAIChatCompletionsUrl(baseUrl), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "x-api-key": apiKey,
      },
      body: JSON.stringify({
        model: apiModelName,
        max_tokens: RUNTIME_CONFIG.maxTokens,
        messages: [
          {
            role: "user",
            content: buildUserContent(prompt, images),
          },
        ],
      }),
      signal: mergedSignal,
    });

    const data = await parseJsonResponse<OpenAIChatResponse>(response, "OpenAI");
    if (!response.ok) {
      const message =
        data.error?.message ?? data.message ?? `HTTP ${response.status}`;
      throw new Error(message);
    }

    const outputText = extractMessageText(data);
    return {
      outputText,
      outputImages: [],
      latencyMs: Date.now() - startTime,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

function extractMessageText(data: OpenAIChatResponse): string {
  const content = data.choices?.[0]?.message?.content;
  if (typeof content === "string") {
    return content;
  }
  if (Array.isArray(content)) {
    return content
      .filter((part) => part.type === "text" && typeof part.text === "string")
      .map((part) => part.text)
      .join("");
  }
  return "";
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
