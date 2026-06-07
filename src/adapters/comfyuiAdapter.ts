import type { NormalizedLlmOutput, TargetConfig } from "@/types";
import { RUNTIME_CONFIG } from "@/config/runtime";
import { buildComfyWorkflow } from "@/config/comfyTemplate";

/**
 * ComfyUI 适配器（收窄形态：LoRA + prompt + checkpoint）。
 *
 * 异步三步：
 *  1. 提交 /prompt（带 client_id）拿到 prompt_id；
 *  2. 轮询 /history/{prompt_id} 直到出图；
 *  3. /view 取图（二进制）转为可展示格式（data URL）。
 *
 * 输出归一化为 { outputText:'', outputImages[], latencyMs }。
 */

export interface ComfyuiAdapterParams {
  target: TargetConfig;
  prompt: string;
  signal?: AbortSignal;
}

interface ComfyHistoryResponse {
  [promptId: string]: {
    outputs?: Record<
      string,
      { images?: { filename: string; subfolder: string; type: string }[] }
    >;
  };
}

export async function runComfyuiTarget(
  params: ComfyuiAdapterParams
): Promise<NormalizedLlmOutput> {
  const { target, prompt, signal } = params;
  const config = target.comfyui;
  if (!config) {
    throw new Error(`ComfyUI 目标 ${target.name} 缺少 comfyui 配置`);
  }

  const startTime = Date.now();
  const clientId = `eval-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const serverUrl = config.serverUrl.replace(/\/$/, "");

  const workflow = buildComfyWorkflow({
    baseModel: config.baseModel,
    prompt,
    loraName: config.loraName,
    loraWeight: config.loraWeight,
  });

  const promptId = await submitPrompt(serverUrl, workflow, clientId, signal);
  const imageRefs = await pollHistory(serverUrl, promptId, signal);
  const outputImages = await fetchImages(serverUrl, imageRefs, signal);

  return {
    outputText: "",
    outputImages,
    latencyMs: Date.now() - startTime,
  };
}

async function submitPrompt(
  serverUrl: string,
  workflow: Record<string, unknown>,
  clientId: string,
  signal?: AbortSignal
): Promise<string> {
  const response = await fetch(`${serverUrl}/prompt`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt: workflow, client_id: clientId }),
    signal,
  });
  if (!response.ok) {
    throw new Error(`ComfyUI 提交失败：HTTP ${response.status}`);
  }
  const data = (await response.json()) as { prompt_id?: string };
  if (!data.prompt_id) {
    throw new Error("ComfyUI 未返回 prompt_id");
  }
  return data.prompt_id;
}

async function pollHistory(
  serverUrl: string,
  promptId: string,
  signal?: AbortSignal
): Promise<{ filename: string; subfolder: string; type: string }[]> {
  const deadline = Date.now() + RUNTIME_CONFIG.callTimeoutMs;
  while (Date.now() < deadline) {
    if (signal?.aborted) {
      throw new Error("已取消");
    }
    const response = await fetch(`${serverUrl}/history/${promptId}`, { signal });
    if (response.ok) {
      const history = (await response.json()) as ComfyHistoryResponse;
      const entry = history[promptId];
      if (entry?.outputs) {
        const images = Object.values(entry.outputs).flatMap(
          (output) => output.images ?? []
        );
        if (images.length > 0) {
          return images;
        }
      }
    }
    await delay(1000);
  }
  throw new Error("ComfyUI 出图超时");
}

async function fetchImages(
  serverUrl: string,
  imageRefs: { filename: string; subfolder: string; type: string }[],
  signal?: AbortSignal
): Promise<string[]> {
  const results: string[] = [];
  for (const ref of imageRefs) {
    const query = new URLSearchParams({
      filename: ref.filename,
      subfolder: ref.subfolder,
      type: ref.type,
    });
    const response = await fetch(`${serverUrl}/view?${query.toString()}`, {
      signal,
    });
    if (!response.ok) {
      continue;
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    const mime = response.headers.get("content-type") ?? "image/png";
    results.push(`data:${mime};base64,${buffer.toString("base64")}`);
  }
  return results;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
