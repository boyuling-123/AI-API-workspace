import type {
  EvaluatorVersion,
  JudgeCalibrationChangeKind,
  JudgeCalibrationCriteriaSource,
  JudgeCalibrationRun,
  JudgeCalibrationTrigger,
} from "@/types";
import { formatEvaluatorPolicyForPrompt } from "@/lib/evaluatorPolicy";

export const MAX_CALIBRATION_CRITERIA_LENGTH = 100_000;

export const JUDGE_CALIBRATION_CHANGE_LABELS: Record<
  JudgeCalibrationChangeKind,
  string
> = {
  judge: "Judge",
  dimensions: "评价维度",
  prompt: "Prompt",
  criteria: "自定义判定标准",
  evaluator: "Evaluator",
};

export interface JudgeCalibrationRerunPlan {
  trigger: JudgeCalibrationTrigger;
  baselineRun?: JudgeCalibrationRun;
  matchingRun?: JudgeCalibrationRun;
  changeKinds: JudgeCalibrationChangeKind[];
}

interface BuildJudgeCalibrationRerunPlanInput {
  datasetVersionId: string;
  judgeModelId: string;
  criteria: string;
  criteriaSource: JudgeCalibrationCriteriaSource;
  evaluatorVersion?: EvaluatorVersion;
  runs: JudgeCalibrationRun[];
}

function fingerprint(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash = Math.imul(hash ^ value.charCodeAt(index), 0x01000193);
  }
  return `fp1:${(hash >>> 0).toString(16).padStart(8, "0")}:${value.length}`;
}

function normalizedCriteria(value: string): string {
  return value.trim().replace(/\r\n/g, "\n");
}

export function buildEvaluatorPromptFingerprint(
  version: EvaluatorVersion
): string {
  return fingerprint(
    JSON.stringify({
      userRequirement: version.userRequirement,
      evalPrompt: version.evalPrompt,
      evaluationMode: version.evaluationMode,
      expectedAnswerColumn: version.expectedAnswerColumn,
    })
  );
}

/** 把不可变 Evaluator 定义转换为 Judge 实际可执行的校准标准。 */
export function buildEvaluatorCalibrationCriteria(
  version: EvaluatorVersion
): string {
  const dimensions = version.dimensions
    .map((dimension, index) => formatEvaluatorPolicyForPrompt(dimension, index))
    .join("\n\n");
  const criteria = `=== 评测目标 ===
${version.userRequirement}

=== 评价模式 ===
${version.evaluationMode === "reference" ? "按标准答案判分" : "横向对比"}

=== 评价维度与策略 ===
${dimensions}

=== Evaluator Prompt ===
${version.evalPrompt}`.trim();
  if (criteria.length > MAX_CALIBRATION_CRITERIA_LENGTH) {
    throw new Error(
      `Evaluator 校准标准不能超过 ${MAX_CALIBRATION_CRITERIA_LENGTH} 个字符`
    );
  }
  return criteria;
}

function evaluatorMatchesRun(
  run: JudgeCalibrationRun,
  version: EvaluatorVersion | undefined
): boolean {
  if (!version) {
    return !run.evaluatorVersionId && !run.evaluatorDefinitionFingerprint;
  }
  return run.evaluatorDefinitionFingerprint === version.definitionFingerprint;
}

/**
 * 优先复用同黄金集、同执行定义的已有结果；否则以最近运行生成变更重跑计划。
 * 该函数只规划，不调用 Judge，也不写入历史。
 */
export function buildJudgeCalibrationRerunPlan(
  input: BuildJudgeCalibrationRerunPlanInput
): JudgeCalibrationRerunPlan {
  const comparableRuns = input.runs
    .filter((run) => run.goldenDatasetVersionId === input.datasetVersionId)
    .sort((left, right) => right.finishTime - left.finishTime);
  const criteria = normalizedCriteria(input.criteria);
  const matchingRun = comparableRuns.find(
    (run) =>
      run.judgeModelId === input.judgeModelId &&
      normalizedCriteria(run.criteria) === criteria &&
      evaluatorMatchesRun(run, input.evaluatorVersion)
  );
  if (matchingRun) {
    return {
      trigger: "manual_repeat",
      baselineRun: matchingRun,
      matchingRun,
      changeKinds: [],
    };
  }

  const baselineRun = comparableRuns[0];
  if (!baselineRun) {
    return { trigger: "initial", changeKinds: [] };
  }

  const changeKinds: JudgeCalibrationChangeKind[] = [];
  if (baselineRun.judgeModelId !== input.judgeModelId) {
    changeKinds.push("judge");
  }

  const version = input.evaluatorVersion;
  if (!version) {
    if (baselineRun.evaluatorVersionId || baselineRun.evaluatorDefinitionFingerprint) {
      changeKinds.push("evaluator");
    }
  } else if (!baselineRun.evaluatorVersionId) {
    changeKinds.push("evaluator");
  } else {
    if (
      baselineRun.evaluatorId &&
      baselineRun.evaluatorId !== version.evaluatorId
    ) {
      changeKinds.push("evaluator");
    }
    if (baselineRun.evaluatorPolicyFingerprint !== version.policyFingerprint) {
      changeKinds.push("dimensions");
    }
    if (
      baselineRun.evaluatorPromptFingerprint !==
      buildEvaluatorPromptFingerprint(version)
    ) {
      changeKinds.push("prompt");
    }
  }

  const evaluatorDefinitionChanged = changeKinds.some((kind) =>
    ["evaluator", "dimensions", "prompt"].includes(kind)
  );
  const criteriaChanged = normalizedCriteria(baselineRun.criteria) !== criteria;
  const bothGeneratedFromEvaluator =
    baselineRun.criteriaSource === "evaluator" &&
    input.criteriaSource === "evaluator";
  if (
    criteriaChanged &&
    !(evaluatorDefinitionChanged && bothGeneratedFromEvaluator)
  ) {
    changeKinds.push("criteria");
  }

  return {
    trigger: changeKinds.length > 0 ? "configuration_change" : "manual_repeat",
    baselineRun,
    changeKinds,
  };
}
