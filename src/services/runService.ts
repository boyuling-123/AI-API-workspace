import type { ContentKind, ResultItem, ResultRow, TargetConfig, TaskInput } from "@/types";
import type { NormalizedLlmOutput } from "@/types";
import { runWithPool } from "@/lib/taskRunner";
import {
  createCheckpointRows,
  isCompletedResultItem,
  replaceCheckpointItem,
} from "@/lib/batchCheckpoint";

interface CallUnit {
  inputId: string;
  targetId: string;
  targetName: string;
  contentKind: ContentKind;
  prompt: string;
  input: TaskInput;
  target: TargetConfig;
}

export interface RunParams {
  inputs: TaskInput[];
  targetIds: string[];
  concurrency: number;
  /** 所有目标配置（含预置 + 用户接入）；按 targetId 匹配。 */
  targetConfigs?: TargetConfig[];
  /** 已持久化的检查点；成功或失败项不会重复调用。 */
  existingResults?: ResultRow[];
  signal?: AbortSignal;
  onItemUpdate?: (inputId: string, item: ResultItem) => void;
}

/**
 * 执行一次运行（v4 M2）：将 inputs × targetIds 展开为调用单元，
 * 统一发往 /api/run-custom（服务端经 runTarget 分发 custom/comfyui），
 * 经通用并发池调度，结果按 inputId 聚合为 ResultRow[]，实现异构目标并排对比。
 *
 * 上层不再按目标类型分两路 fetch，差异全收敛在服务端 runTarget。
 */
export async function runTargets(params: RunParams): Promise<ResultRow[]> {
  const {
    inputs,
    targetIds,
    concurrency,
    targetConfigs,
    existingResults,
    signal,
    onItemUpdate,
  } = params;

  const targetById = new Map<string, TargetConfig>(
    (targetConfigs ?? []).map((config) => [config.id, config])
  );

  for (const targetId of targetIds) {
    if (!targetById.has(targetId)) {
      throw new Error(`未知目标，未在已配置的目标中找到：${targetId}`);
    }
  }

  let currentRows = createCheckpointRows(
    inputs,
    targetIds,
    targetConfigs ?? [],
    existingResults
  );
  const checkpointByInput = new Map(
    currentRows.map((row) => [
      row.inputId,
      new Map(row.items.map((item) => [item.targetId, item])),
    ])
  );

  const units: CallUnit[] = [];
  for (const input of inputs) {
    for (const targetId of targetIds) {
      if (isCompletedResultItem(checkpointByInput.get(input.id)?.get(targetId))) {
        continue;
      }
      const target = targetById.get(targetId)!;
      units.push({
        inputId: input.id,
        targetId,
        targetName: target.name,
        contentKind: target.contentKind,
        prompt: input.prompt,
        input,
        target,
      });
    }
  }

  await runWithPool<CallUnit, ResultItem>({
    items: units,
    concurrency,
    signal,
    runOne: async (unit, runSignal) => {
      const item = await callTarget(unit, runSignal);
      currentRows = replaceCheckpointItem(currentRows, unit.inputId, item);
      onItemUpdate?.(unit.inputId, item);
      return item;
    },
  });

  return currentRows;
}

/**
 * 统一目标调用（v4 M2）：所有目标（预置大模型 / 用户算法 / comfyui）都发往
 * /api/run-custom，服务端 runTarget 内部分发。
 *
 * 参数组装：把整个 TargetConfig + prompt + images + paramValues 发过去。
 * paramValues 来源：input.extraFields 持有用户填写的额外入参；若 inputParams 含
 * 名为 'prompt' 的项且 extraFields 未覆盖，则回退用 input.prompt 填充，复用主输入框。
 */
async function callTarget(
  unit: CallUnit,
  signal: AbortSignal
): Promise<ResultItem> {
  const startTime = Date.now();
  const target = unit.target;
  try {
    const paramValues: Record<string, unknown> = {
      ...(unit.input.extraFields ?? {}),
    };
    const hasPromptParam = target.inputParams.some(
      (def) => def.name === "prompt"
    );
    if (hasPromptParam && paramValues.prompt === undefined) {
      paramValues.prompt = unit.prompt;
    }

    const response = await fetch("/api/run-custom", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        target,
        prompt: unit.prompt,
        images: unit.input.images,
        paramValues,
      }),
      signal,
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error ?? `HTTP ${response.status}`);
    }

    const output = data as NormalizedLlmOutput;
    return {
      targetId: unit.targetId,
      targetName: unit.targetName,
      contentKind: unit.contentKind,
      status: "success",
      outputText: output.outputText,
      outputImages: output.outputImages,
      latencyMs: output.latencyMs,
    };
  } catch (error) {
    const aborted = signal.aborted;
    return {
      targetId: unit.targetId,
      targetName: unit.targetName,
      contentKind: unit.contentKind,
      status: aborted ? "interrupted" : "error",
      latencyMs: Date.now() - startTime,
      error:
        error instanceof Error ? error.message : aborted ? "已取消" : "未知错误",
    };
  }
}
