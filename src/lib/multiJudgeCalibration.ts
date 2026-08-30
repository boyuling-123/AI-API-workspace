import type {
  GoldenHumanLabel,
  JudgeArbitrationStrategy,
  JudgeCalibrationCaseResult,
  JudgeCalibrationMetrics,
  JudgeCalibrationModelSnapshot,
  JudgeCalibrationPerModelMetrics,
  JudgeCalibrationRun,
  JudgeCalibrationVote,
} from "@/types";
import { calculateJudgeCalibrationMetrics } from "@/lib/judgeCalibration";
import { redactSensitiveText } from "@/lib/redactSensitive";

export const MAX_MULTI_JUDGES = 5;

export function normalizeJudgeArbitrationStrategy(
  strategy: JudgeArbitrationStrategy
): JudgeArbitrationStrategy {
  if (
    strategy !== "majority_conservative" &&
    strategy !== "unanimous_pass"
  ) {
    throw new Error("不支持的多 Judge 仲裁策略");
  }
  return strategy;
}

function fingerprint(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash = Math.imul(hash ^ value.charCodeAt(index), 0x01000193);
  }
  return `multi-judge:v1:${(hash >>> 0).toString(16).padStart(8, "0")}:${value.length}`;
}

export function normalizeJudgeModels(
  judges: JudgeCalibrationModelSnapshot[],
  minimum = 2
): JudgeCalibrationModelSnapshot[] {
  if (judges.length < minimum || judges.length > MAX_MULTI_JUDGES) {
    throw new Error(
      `多 Judge 校准必须选择 ${minimum}-${MAX_MULTI_JUDGES} 个 Judge`
    );
  }
  const ids = new Set<string>();
  return judges.map((judge) => {
    const id = judge.id.trim();
    const name = redactSensitiveText(judge.name.trim()).slice(0, 160);
    if (!id || id.length > 160 || !name) {
      throw new Error("Judge id 和名称不能为空且不能超过 160 个字符");
    }
    if (ids.has(id)) throw new Error(`Judge 不能重复选择：${id}`);
    ids.add(id);
    return { id, name };
  });
}

export function buildMultiJudgeSelectionId(
  judges: JudgeCalibrationModelSnapshot[],
  strategy: JudgeArbitrationStrategy
): string {
  const normalized = normalizeJudgeModels(judges);
  const normalizedStrategy = normalizeJudgeArbitrationStrategy(strategy);
  const ids = normalized.map((judge) => judge.id).sort();
  return fingerprint(JSON.stringify({ ids, strategy: normalizedStrategy }));
}

function voteIsSuccess(vote: JudgeCalibrationVote): boolean {
  return (
    vote.status === "success" &&
    (vote.judgeLabel === "pass" || vote.judgeLabel === "fail") &&
    typeof vote.confidence === "number" &&
    Number.isFinite(vote.confidence) &&
    vote.confidence >= 0 &&
    vote.confidence <= 1 &&
    typeof vote.reason === "string" &&
    Boolean(vote.reason.trim())
  );
}

function voteIsIntact(vote: JudgeCalibrationVote): boolean {
  if (vote.status === "success") return voteIsSuccess(vote);
  return (
    vote.status === "error" &&
    typeof vote.error === "string" &&
    Boolean(vote.error.trim())
  );
}

export function hasJudgeDisagreement(votes: JudgeCalibrationVote[]): boolean {
  return new Set(
    votes.filter(voteIsSuccess).map((vote) => vote.judgeLabel)
  ).size > 1;
}

export function arbitrateJudgeVotes(input: {
  caseId: string;
  humanLabel: GoldenHumanLabel;
  votes: JudgeCalibrationVote[];
  strategy: JudgeArbitrationStrategy;
}): JudgeCalibrationCaseResult {
  const { caseId, humanLabel, votes } = input;
  const strategy = normalizeJudgeArbitrationStrategy(input.strategy);
  const failedVotes = votes.filter((vote) => !voteIsSuccess(vote));
  if (votes.length === 0 || failedVotes.length > 0) {
    const failedNames = failedVotes
      .map((vote) => vote.judgeModelName || vote.judgeModelId)
      .join("、");
    return {
      caseId,
      humanLabel,
      status: "error",
      error:
        votes.length === 0
          ? "多 Judge 仲裁缺少投票"
          : `多 Judge 未完整返回：${failedNames}`,
      votes: votes.map((vote) => ({ ...vote })),
    };
  }

  const passCount = votes.filter((vote) => vote.judgeLabel === "pass").length;
  const failCount = votes.length - passCount;
  const judgeLabel: GoldenHumanLabel =
    strategy === "unanimous_pass"
      ? failCount === 0
        ? "pass"
        : "fail"
      : passCount > failCount
        ? "pass"
        : "fail";
  const winningVotes = judgeLabel === "pass" ? passCount : failCount;
  const strategyText =
    strategy === "unanimous_pass" ? "全票通过" : "多数票（平票保守 fail）";
  return {
    caseId,
    humanLabel,
    status: "success",
    judgeLabel,
    confidence: winningVotes / votes.length,
    reason: `${strategyText}：pass ${passCount} / fail ${failCount}，仲裁为 ${judgeLabel}。`,
    votes: votes.map((vote) => ({ ...vote })),
  };
}

function voteAsCaseResult(
  result: JudgeCalibrationCaseResult,
  judge: JudgeCalibrationModelSnapshot
): JudgeCalibrationCaseResult {
  const vote = result.votes?.find((item) => item.judgeModelId === judge.id);
  if (!vote || !voteIsSuccess(vote)) {
    return {
      caseId: result.caseId,
      humanLabel: result.humanLabel,
      status: "error",
      error: vote?.error ?? "缺少 Judge 投票",
    };
  }
  return {
    caseId: result.caseId,
    humanLabel: result.humanLabel,
    status: "success",
    judgeLabel: vote.judgeLabel,
    confidence: vote.confidence,
    reason: vote.reason,
  };
}

export function calculatePerJudgeMetrics(
  results: JudgeCalibrationCaseResult[],
  judges: JudgeCalibrationModelSnapshot[]
): JudgeCalibrationPerModelMetrics[] {
  return judges.map((judge) => ({
    judgeModelId: judge.id,
    judgeModelName: judge.name,
    metrics: calculateJudgeCalibrationMetrics(
      results.map((result) => voteAsCaseResult(result, judge))
    ),
  }));
}

function metricsEqual(
  left: JudgeCalibrationMetrics,
  right: JudgeCalibrationMetrics
): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

/** 发布前验证多 Judge 快照、投票、仲裁与逐 Judge 指标可以完整复算。 */
export function isMultiJudgeCalibrationEvidenceIntact(
  run: JudgeCalibrationRun
): boolean {
  if (!run.judgeModels) {
    return (
      run.arbitrationStrategy === undefined &&
      run.perJudgeMetrics === undefined &&
      run.disagreementCases === undefined &&
      run.results.every((result) => result.votes === undefined)
    );
  }
  if (!run.arbitrationStrategy || !run.perJudgeMetrics) return false;
  let judges: JudgeCalibrationModelSnapshot[];
  try {
    judges = normalizeJudgeModels(run.judgeModels);
  } catch {
    return false;
  }
  if (
    run.judgeModelId !==
    buildMultiJudgeSelectionId(judges, run.arbitrationStrategy)
  ) {
    return false;
  }
  const judgeIds = judges.map((judge) => judge.id);
  for (const result of run.results) {
    const voteIds = result.votes?.map((vote) => vote.judgeModelId) ?? [];
    if (
      voteIds.length !== judgeIds.length ||
      new Set(voteIds).size !== voteIds.length ||
      judgeIds.some((id) => !voteIds.includes(id)) ||
      judges.some((judge) => {
        const vote = result.votes?.find(
          (item) => item.judgeModelId === judge.id
        );
        return !vote || vote.judgeModelName !== judge.name || !voteIsIntact(vote);
      })
    ) {
      return false;
    }
    const recalculated = arbitrateJudgeVotes({
      caseId: result.caseId,
      humanLabel: result.humanLabel,
      votes: result.votes ?? [],
      strategy: run.arbitrationStrategy,
    });
    if (JSON.stringify(recalculated) !== JSON.stringify(result)) return false;
  }
  const perJudgeMetrics = calculatePerJudgeMetrics(run.results, judges);
  if (
    perJudgeMetrics.length !== run.perJudgeMetrics.length ||
    perJudgeMetrics.some((calculated, index) => {
      const stored = run.perJudgeMetrics?.[index];
      return (
        !stored ||
        calculated.judgeModelId !== stored.judgeModelId ||
        calculated.judgeModelName !== stored.judgeModelName ||
        !metricsEqual(calculated.metrics, stored.metrics)
      );
    })
  ) {
    return false;
  }
  const finalMetrics = calculateJudgeCalibrationMetrics(run.results);
  const expectedStatus =
    finalMetrics.completedCases === finalMetrics.totalCases
      ? "done"
      : finalMetrics.completedCases > 0
        ? "partial"
        : "error";
  if (!metricsEqual(finalMetrics, run.metrics) || run.status !== expectedStatus) {
    return false;
  }
  return (
    run.disagreementCases ===
    run.results.filter((result) => hasJudgeDisagreement(result.votes ?? []))
      .length
  );
}
