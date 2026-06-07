import type { BaseModelConfig, EvalDimension, ResultRow, TaskInput } from "@/types";
import type {
  EvaluateInputItem,
  EvaluateResultPerInput,
} from "@/services/evaluateService";
import { runWithPool } from "@/lib/taskRunner";
import { compressImagesForJudge } from "@/lib/imageCompress";

/**
 * 前端逐条评价编排（M9）：
 * - 按 inputId 逐条构造评价单元，图片先压缩（仅传裁判副本，原图不动）。
 * - 复用通用 Task Runner 按 concurrency 并发，逐条调 /api/evaluate。
 * - 结果按 inputId 归属，实时回调更新。
 */

export interface EvaluateRunParams {
  inputs: TaskInput[];
  results: ResultRow[];
  /** 评价范围：仅评这些 inputId；为空/undefined 表示全量。 */
  scopeInputIds?: string[];
  evalPrompt: string;
  /** v4.8：前端选定的裁判模型完整配置。 */
  baseModel: BaseModelConfig;
  /** 本次选定维度（v4.5），裁判须逐项打分。 */
  dimensions: EvalDimension[];
  concurrency: number;
  signal?: AbortSignal;
  onItemDone?: (result: EvaluateResultPerInput) => void;
  onItemError?: (inputId: string, error: string) => void;
}

async function buildEvaluateItem(
  input: TaskInput,
  resultRow: ResultRow
): Promise<EvaluateInputItem> {
  const compressedImages =
    input.images.length > 0
      ? await compressImagesForJudge(input.images)
      : undefined;

  return {
    inputId: input.id,
    prompt: input.prompt,
    images: compressedImages,
    targets: resultRow.items
      .filter((item) => item.status === "success")
      .map((item) => ({
        targetId: item.targetId,
        targetName: item.targetName,
        outputText: item.outputText,
        outputImageCount: item.outputImages?.length ?? 0,
      })),
  };
}

async function callEvaluate(
  item: EvaluateInputItem,
  evalPrompt: string,
  baseModel: BaseModelConfig,
  dimensions: EvalDimension[],
  signal: AbortSignal
): Promise<EvaluateResultPerInput> {
  const response = await fetch("/api/evaluate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ item, evalPrompt, baseModel, dimensions }),
    signal,
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error ?? `评价失败（${response.status}）`);
  }
  return data as EvaluateResultPerInput;
}

export async function runEvaluation(
  params: EvaluateRunParams
): Promise<EvaluateResultPerInput[]> {
  const {
    inputs,
    results,
    scopeInputIds,
    evalPrompt,
    baseModel,
    dimensions,
    concurrency,
    signal,
    onItemDone,
    onItemError,
  } = params;

  const resultByInputId = new Map(results.map((row) => [row.inputId, row]));
  const scopeSet = scopeInputIds ? new Set(scopeInputIds) : null;

  const targetInputs = inputs.filter((input) => {
    if (scopeSet && !scopeSet.has(input.id)) return false;
    const row = resultByInputId.get(input.id);
    return Boolean(row && row.items.some((item) => item.status === "success"));
  });

  const collected: EvaluateResultPerInput[] = [];

  await runWithPool<TaskInput, EvaluateResultPerInput>({
    items: targetInputs,
    concurrency,
    signal,
    runOne: async (input, runSignal) => {
      const row = resultByInputId.get(input.id)!;
      const item = await buildEvaluateItem(input, row);
      try {
        const evaluated = await callEvaluate(
          item,
          evalPrompt,
          baseModel,
          dimensions,
          runSignal
        );
        collected.push(evaluated);
        onItemDone?.(evaluated);
        return evaluated;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "评价失败";
        onItemError?.(input.id, message);
        throw error;
      }
    },
  });

  return collected;
}
