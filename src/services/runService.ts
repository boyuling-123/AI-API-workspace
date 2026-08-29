import type {
  ContentKind,
  NormalizedLlmOutput,
  ResultItem,
  ResultRow,
  RunPolicy,
  TargetConfig,
  TaskInput,
  TaskRunPair,
} from "@/types";
import { runWithPool } from "@/lib/taskRunner";
import {
  createCheckpointRows,
  isCompletedResultItem,
  replaceCheckpointItem,
} from "@/lib/batchCheckpoint";
import { RUNTIME_CONFIG } from "@/config/runtime";
import { createStartRateLimiter, waitForDelay, type StartRateLimiter } from "@/lib/rateLimiter";
import {
  createHttpRunError,
  isRunErrorType,
  normalizeRunError,
  RunError,
} from "@/lib/runError";
import { normalizeRunPolicy } from "@/lib/runPolicy";

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
  runPolicy?: Partial<RunPolicy>;
  /** 所有目标配置（含预置 + 用户接入）；按 targetId 匹配。 */
  targetConfigs?: TargetConfig[];
  /** 已持久化的检查点；成功或失败项不会重复调用。 */
  existingResults?: ResultRow[];
  /** 定向重跑的精确 Case x target 组合；缺省时运行完整矩阵。 */
  runPairs?: TaskRunPair[];
  signal?: AbortSignal;
  onItemUpdate?: (inputId: string, item: ResultItem) => void;
  /** 仅供确定性测试覆盖退避等待；产品运行使用 runtime 默认值。 */
  retryBaseDelayMs?: number;
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
    runPairs,
    signal,
    onItemUpdate,
    retryBaseDelayMs = RUNTIME_CONFIG.retryBaseDelayMs,
  } = params;
  const policy = normalizeRunPolicy(params.runPolicy);
  const rateLimiter = createStartRateLimiter(policy.qps);

  const targetById = new Map<string, TargetConfig>(
    (targetConfigs ?? []).map((config) => [config.id, config])
  );

  const executionTargetIds = runPairs
    ? Array.from(new Set(runPairs.map((pair) => pair.targetId)))
    : targetIds;
  for (const targetId of executionTargetIds) {
    if (!targetById.has(targetId)) {
      throw new Error(`未知目标，未在已配置的目标中找到：${targetId}`);
    }
  }

  validateRunPairs(runPairs, inputs, targetIds);

  let currentRows = createCheckpointRows(
    inputs,
    targetIds,
    targetConfigs ?? [],
    existingResults,
    runPairs
  );
  const inputById = new Map(inputs.map((input) => [input.id, input]));
  const runPairKeys = runPairs
    ? new Set(
        runPairs.map((pair) => `${pair.inputId}\u0000${pair.targetId}`)
      )
    : null;

  const units: CallUnit[] = [];
  for (const row of currentRows) {
    const input = inputById.get(row.inputId)!;
    for (const checkpointItem of row.items) {
      if (
        runPairKeys &&
        !runPairKeys.has(`${row.inputId}\u0000${checkpointItem.targetId}`)
      ) {
        continue;
      }
      if (isCompletedResultItem(checkpointItem)) {
        continue;
      }
      const targetId = checkpointItem.targetId;
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
      const item = await callTarget(
        unit,
        runSignal,
        policy,
        rateLimiter,
        retryBaseDelayMs
      );
      currentRows = replaceCheckpointItem(currentRows, unit.inputId, item);
      onItemUpdate?.(unit.inputId, item);
      return item;
    },
  });

  return currentRows;
}

function validateRunPairs(
  runPairs: TaskRunPair[] | undefined,
  inputs: TaskInput[],
  targetIds: string[]
): void {
  if (!runPairs) return;
  const inputIdSet = new Set(inputs.map((input) => input.id));
  const targetIdSet = new Set(targetIds);
  for (const pair of runPairs) {
    if (!inputIdSet.has(pair.inputId) || !targetIdSet.has(pair.targetId)) {
      throw new Error("定向重跑计划包含不属于当前任务的 Case 或目标");
    }
  }
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
  signal: AbortSignal,
  policy: RunPolicy,
  rateLimiter: StartRateLimiter,
  retryBaseDelayMs: number
): Promise<ResultItem> {
  const startTime = Date.now();
  const target = unit.target;
  const paramValues: Record<string, unknown> = {
    ...(unit.input.extraFields ?? {}),
  };
  const hasPromptParam = target.inputParams.some(
    (def) => def.name === "prompt"
  );
  if (hasPromptParam && paramValues.prompt === undefined) {
    paramValues.prompt = unit.prompt;
  }

  let attemptCount = 0;
  while (attemptCount <= policy.retryLimit) {
    const canStart = await rateLimiter.wait(signal);
    if (!canStart || signal.aborted) {
      return interruptedResult(unit, startTime, attemptCount);
    }

    attemptCount += 1;
    try {
      const output = await callTargetOnce(
        unit,
        paramValues,
        signal,
        policy.timeoutMs
      );
      return {
        targetId: unit.targetId,
        targetName: unit.targetName,
        contentKind: unit.contentKind,
        status: "success",
        outputText: output.outputText,
        outputImages: output.outputImages,
        latencyMs: Date.now() - startTime,
        attemptCount,
      };
    } catch (error) {
      if (signal.aborted) {
        return interruptedResult(unit, startTime, attemptCount);
      }

      const runError = normalizeRunError(error);
      const hasRetry = attemptCount <= policy.retryLimit;
      if (!runError.retryable || !hasRetry) {
        return {
          targetId: unit.targetId,
          targetName: unit.targetName,
          contentKind: unit.contentKind,
          status: "error",
          latencyMs: Date.now() - startTime,
          error: runError.message,
          errorType: runError.type,
          attemptCount,
          httpStatus: runError.httpStatus,
        };
      }

      const backoffMs = Math.max(0, retryBaseDelayMs) * 2 ** (attemptCount - 1);
      const shouldContinue = await waitForDelay(backoffMs, signal);
      if (!shouldContinue) {
        return interruptedResult(unit, startTime, attemptCount);
      }
    }
  }

  return interruptedResult(unit, startTime, attemptCount);
}

async function callTargetOnce(
  unit: CallUnit,
  paramValues: Record<string, unknown>,
  parentSignal: AbortSignal,
  timeoutMs: number
): Promise<NormalizedLlmOutput> {
  const attempt = createAttemptSignal(parentSignal, timeoutMs);
  try {
    const response = await fetch("/api/run-custom", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        target: unit.target,
        prompt: unit.prompt,
        images: unit.input.images,
        paramValues,
        timeoutMs,
      }),
      signal: attempt.signal,
    });
    return await parseRunResponse(response);
  } catch (error) {
    if (!parentSignal.aborted && attempt.didTimeout()) {
      throw new RunError(`请求超过 ${formatDuration(timeoutMs)}，已自动终止`, {
        type: "timeout",
        cause: error,
      });
    }
    throw error;
  } finally {
    attempt.dispose();
  }
}

interface RunApiErrorPayload {
  error?: unknown;
  errorType?: unknown;
  retryable?: unknown;
  httpStatus?: unknown;
}

async function parseRunResponse(
  response: Response
): Promise<NormalizedLlmOutput> {
  const raw = await response.text();
  let data: unknown = {};
  if (raw.trim()) {
    try {
      data = JSON.parse(raw) as unknown;
    } catch (error) {
      if (!response.ok) {
        throw createHttpRunError(response.status, raw.slice(0, 300));
      }
      throw new RunError("接口返回内容不是合法 JSON", {
        type: "parse",
        httpStatus: response.status,
        cause: error,
      });
    }
  }

  if (!response.ok) {
    const payload = isRecord(data) ? (data as RunApiErrorPayload) : {};
    const message =
      typeof payload.error === "string"
        ? payload.error
        : `HTTP ${response.status}`;
    if (isRunErrorType(payload.errorType)) {
      throw new RunError(message, {
        type: payload.errorType,
        retryable:
          typeof payload.retryable === "boolean"
            ? payload.retryable
            : undefined,
        httpStatus:
          typeof payload.httpStatus === "number"
            ? payload.httpStatus
            : response.status,
      });
    }
    throw createHttpRunError(response.status, message);
  }

  if (!isRecord(data)) {
    throw new RunError("接口返回 JSON 结构无效", {
      type: "parse",
      httpStatus: response.status,
    });
  }
  return data as unknown as NormalizedLlmOutput;
}

function interruptedResult(
  unit: CallUnit,
  startTime: number,
  attemptCount: number
): ResultItem {
  return {
    targetId: unit.targetId,
    targetName: unit.targetName,
    contentKind: unit.contentKind,
    status: "interrupted",
    latencyMs: Date.now() - startTime,
    error: "已停止，继续任务时会重新执行",
    attemptCount,
  };
}

function createAttemptSignal(parent: AbortSignal, timeoutMs: number) {
  const controller = new AbortController();
  let timedOut = false;
  const onParentAbort = () => controller.abort(parent.reason);
  if (parent.aborted) {
    onParentAbort();
  } else {
    parent.addEventListener("abort", onParentAbort, { once: true });
  }
  const timeoutId = setTimeout(() => {
    timedOut = true;
    controller.abort(new DOMException("Request timeout", "AbortError"));
  }, timeoutMs);

  return {
    signal: controller.signal,
    didTimeout: () => timedOut,
    dispose: () => {
      clearTimeout(timeoutId);
      parent.removeEventListener("abort", onParentAbort);
    },
  };
}

function formatDuration(timeoutMs: number): string {
  return timeoutMs % 1_000 === 0
    ? `${timeoutMs / 1_000} 秒`
    : `${timeoutMs} 毫秒`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
