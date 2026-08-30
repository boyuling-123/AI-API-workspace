import type {
  EvaluatorVersion,
  GoldenDatasetCase,
  GoldenDatasetVersion,
  JudgeArbitrationStrategy,
  JudgeCalibrationCriteriaSource,
  JudgeCalibrationModelSnapshot,
  JudgeCalibrationRun,
  JudgeCalibrationVote,
} from "@/types";
import { calculateJudgeCalibrationMetrics } from "@/lib/judgeCalibration";
import {
  arbitrateJudgeVotes,
  buildMultiJudgeSelectionId,
  calculatePerJudgeMetrics,
  hasJudgeDisagreement,
  normalizeJudgeArbitrationStrategy,
  normalizeJudgeModels,
} from "@/lib/multiJudgeCalibration";
import {
  buildEvaluatorPromptFingerprint,
  MAX_CALIBRATION_CRITERIA_LENGTH,
  type JudgeCalibrationRerunPlan,
} from "@/lib/judgeCalibrationRerun";
import { generateId } from "@/lib/id";
import { redactSensitiveText } from "@/lib/redactSensitive";
import { runWithPool } from "@/lib/taskRunner";
import { requestJudgeCalibration } from "@/services/judgeCalibrationClient";

export interface RunMultiJudgeCalibrationParams {
  datasetVersion: GoldenDatasetVersion;
  judges: JudgeCalibrationModelSnapshot[];
  arbitrationStrategy: JudgeArbitrationStrategy;
  criteria: string;
  criteriaSource?: JudgeCalibrationCriteriaSource;
  evaluatorVersion?: EvaluatorVersion;
  rerunPlan?: JudgeCalibrationRerunPlan;
  concurrency: number;
  signal?: AbortSignal;
  onProgress?: (completed: number, total: number) => void;
}

interface MultiJudgeWorkItem {
  caseItem: GoldenDatasetCase;
  judge: JudgeCalibrationModelSnapshot;
}

function errorMessage(error: unknown): string {
  return redactSensitiveText(
    error instanceof Error ? error.message : "Judge 校准失败"
  ).slice(0, 2_000);
}

export async function runMultiJudgeCalibration(
  params: RunMultiJudgeCalibrationParams
): Promise<JudgeCalibrationRun> {
  const judges = normalizeJudgeModels(params.judges);
  const arbitrationStrategy = normalizeJudgeArbitrationStrategy(
    params.arbitrationStrategy
  );
  const criteria = redactSensitiveText(params.criteria.trim());
  if (!criteria) throw new Error("校准判定标准不能为空");
  if (criteria.length > MAX_CALIBRATION_CRITERIA_LENGTH) {
    throw new Error(
      `校准判定标准不能超过 ${MAX_CALIBRATION_CRITERIA_LENGTH} 个字符`
    );
  }
  const workItems = params.datasetVersion.cases.flatMap((caseItem) =>
    judges.map((judge) => ({ caseItem, judge }))
  );
  const startedAt = Date.now();
  let completed = 0;
  const outcomes = await runWithPool<MultiJudgeWorkItem, JudgeCalibrationVote>({
    items: workItems,
    concurrency: Math.min(5, Math.max(1, Math.floor(params.concurrency))),
    signal: params.signal,
    runOne: async ({ caseItem, judge }, signal) => {
      let vote: JudgeCalibrationVote;
      try {
        const judgment = await requestJudgeCalibration(
          caseItem,
          judge.id,
          criteria,
          signal
        );
        vote = {
          judgeModelId: judge.id,
          judgeModelName: judge.name,
          status: "success",
          judgeLabel: judgment.judgeLabel,
          confidence: judgment.confidence,
          reason: redactSensitiveText(judgment.reason).slice(0, 2_000),
        };
      } catch (error) {
        vote = {
          judgeModelId: judge.id,
          judgeModelName: judge.name,
          status: "error",
          error: errorMessage(error),
        };
      }
      completed += 1;
      params.onProgress?.(completed, workItems.length);
      return vote;
    },
  });

  const votesByCase = new Map<string, JudgeCalibrationVote[]>();
  outcomes.forEach((outcome, index) => {
    const workItem = workItems[index];
    const vote =
      outcome.status === "fulfilled" && outcome.result
        ? outcome.result
        : {
            judgeModelId: workItem.judge.id,
            judgeModelName: workItem.judge.name,
            status: "error" as const,
            error:
              outcome.status === "skipped"
                ? "校准已取消，该 Judge 调用未启动"
                : errorMessage(outcome.error),
          };
    const votes = votesByCase.get(workItem.caseItem.caseId) ?? [];
    votes.push(vote);
    votesByCase.set(workItem.caseItem.caseId, votes);
  });

  const results = params.datasetVersion.cases.map((caseItem) =>
    arbitrateJudgeVotes({
      caseId: caseItem.caseId,
      humanLabel: caseItem.humanLabel,
      votes: votesByCase.get(caseItem.caseId) ?? [],
      strategy: arbitrationStrategy,
    })
  );
  const metrics = calculateJudgeCalibrationMetrics(results);
  const status =
    metrics.completedCases === metrics.totalCases
      ? "done"
      : metrics.completedCases > 0
        ? "partial"
        : "error";
  const judgeModelId = buildMultiJudgeSelectionId(
    judges,
    arbitrationStrategy
  );

  return {
    id: generateId(),
    createTime: startedAt,
    finishTime: Date.now(),
    goldenDatasetVersionId: params.datasetVersion.id,
    goldenDatasetName: params.datasetVersion.name,
    goldenDatasetVersion: params.datasetVersion.version,
    judgeModelId,
    judgeModelName: `${judges.length} Judges · ${judges.map((judge) => judge.name).join(" / ")}`.slice(0, 500),
    judgeModels: judges.map((judge) => ({ ...judge })),
    arbitrationStrategy,
    perJudgeMetrics: calculatePerJudgeMetrics(results, judges),
    disagreementCases: results.filter((result) =>
      hasJudgeDisagreement(result.votes ?? [])
    ).length,
    criteria,
    status,
    results,
    metrics,
    calibrationTaskId: generateId(),
    trigger: params.rerunPlan?.trigger ?? "initial",
    baselineRunId: params.rerunPlan?.baselineRun?.id,
    changeKinds: params.rerunPlan?.changeKinds
      ? [...params.rerunPlan.changeKinds]
      : [],
    criteriaSource: params.criteriaSource ?? "custom",
    ...(params.evaluatorVersion
      ? {
          evaluatorVersionId: params.evaluatorVersion.id,
          evaluatorId: params.evaluatorVersion.evaluatorId,
          evaluatorVersionName: params.evaluatorVersion.name,
          evaluatorVersion: params.evaluatorVersion.version,
          evaluatorDefinitionFingerprint:
            params.evaluatorVersion.definitionFingerprint,
          evaluatorPolicyFingerprint:
            params.evaluatorVersion.policyFingerprint,
          evaluatorPromptFingerprint: buildEvaluatorPromptFingerprint(
            params.evaluatorVersion
          ),
        }
      : {}),
  };
}
