import type {
  GoldenDatasetCase,
  GoldenDatasetVersion,
  JudgeCalibrationCaseResult,
  JudgeCalibrationRun,
} from "@/types";
import { calculateJudgeCalibrationMetrics } from "@/lib/judgeCalibration";
import { generateId } from "@/lib/id";
import { redactSensitiveText } from "@/lib/redactSensitive";
import { runWithPool } from "@/lib/taskRunner";
import type { JudgeCalibrationJudgment } from "@/services/judgeCalibrationService";

export interface RunJudgeCalibrationParams {
  datasetVersion: GoldenDatasetVersion;
  judgeModelId: string;
  judgeModelName: string;
  criteria: string;
  concurrency: number;
  signal?: AbortSignal;
  onProgress?: (completed: number, total: number) => void;
}

function errorMessage(error: unknown): string {
  return redactSensitiveText(
    error instanceof Error ? error.message : "Judge 校准失败"
  ).slice(0, 2_000);
}

async function callJudgeCalibration(
  item: GoldenDatasetCase,
  modelId: string,
  criteria: string,
  signal: AbortSignal
): Promise<JudgeCalibrationJudgment> {
  const response = await fetch("/api/judge-calibration", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      item: {
        caseId: item.caseId,
        prompt: item.prompt,
        candidateOutput: item.candidateOutput,
        expectedAnswer: item.expectedAnswer,
      },
      modelId,
      criteria,
    }),
    signal,
  });
  const data = (await response.json()) as Partial<JudgeCalibrationJudgment> & {
    error?: string;
  };
  if (!response.ok) {
    throw new Error(data.error ?? `Judge 校准失败（${response.status}）`);
  }
  if (
    data.caseId !== item.caseId ||
    (data.judgeLabel !== "pass" && data.judgeLabel !== "fail") ||
    typeof data.confidence !== "number" ||
    data.confidence < 0 ||
    data.confidence > 1 ||
    typeof data.reason !== "string" ||
    !data.reason.trim()
  ) {
    throw new Error("Judge 校准接口返回结构不完整");
  }
  return data as JudgeCalibrationJudgment;
}

/** 用户确认后才调用；返回顺序始终与黄金集 Case 顺序一致。 */
export async function runJudgeCalibration(
  params: RunJudgeCalibrationParams
): Promise<JudgeCalibrationRun> {
  const {
    datasetVersion,
    judgeModelId,
    judgeModelName,
    criteria,
    signal,
    onProgress,
  } = params;
  const startedAt = Date.now();
  let completed = 0;
  const outcomes = await runWithPool<
    GoldenDatasetCase,
    JudgeCalibrationCaseResult
  >({
    items: datasetVersion.cases,
    concurrency: Math.min(5, Math.max(1, Math.floor(params.concurrency))),
    signal,
    runOne: async (item, runSignal) => {
      let result: JudgeCalibrationCaseResult;
      try {
        const judgment = await callJudgeCalibration(
          item,
          judgeModelId,
          criteria,
          runSignal
        );
        result = {
          caseId: item.caseId,
          humanLabel: item.humanLabel,
          status: "success",
          judgeLabel: judgment.judgeLabel,
          confidence: judgment.confidence,
          reason: redactSensitiveText(judgment.reason).slice(0, 2_000),
        };
      } catch (error) {
        result = {
          caseId: item.caseId,
          humanLabel: item.humanLabel,
          status: "error",
          error: errorMessage(error),
        };
      }
      completed += 1;
      onProgress?.(completed, datasetVersion.cases.length);
      return result;
    },
  });

  const results = outcomes.map((outcome, index): JudgeCalibrationCaseResult => {
    if (outcome.status === "fulfilled" && outcome.result) return outcome.result;
    return {
      caseId: datasetVersion.cases[index].caseId,
      humanLabel: datasetVersion.cases[index].humanLabel,
      status: "error",
      error:
        outcome.status === "skipped"
          ? "校准已取消，该 Case 未启动"
          : errorMessage(outcome.error),
    };
  });
  const metrics = calculateJudgeCalibrationMetrics(results);
  const status =
    metrics.completedCases === metrics.totalCases
      ? "done"
      : metrics.completedCases > 0
        ? "partial"
        : "error";

  return {
    id: generateId(),
    createTime: startedAt,
    finishTime: Date.now(),
    goldenDatasetVersionId: datasetVersion.id,
    goldenDatasetName: datasetVersion.name,
    goldenDatasetVersion: datasetVersion.version,
    judgeModelId,
    judgeModelName: redactSensitiveText(judgeModelName).slice(0, 160),
    criteria: redactSensitiveText(criteria.trim()).slice(0, 4_000),
    status,
    results,
    metrics,
  };
}
