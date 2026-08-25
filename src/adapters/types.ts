import type { ImageItem, NormalizedLlmOutput } from "@/types";

export interface AdapterCallParams {
  prompt: string;
  images?: ImageItem[];
  signal?: AbortSignal;
  maxTokens?: number;
}

export interface LlmAdapter {
  modelId: string;
  call(params: AdapterCallParams): Promise<NormalizedLlmOutput>;
}
