import { describe, expect, it } from "vitest";
import type {
  EvalDimension,
  EvaluatorVersion,
  JudgeCalibrationRun,
} from "@/types";
import { createEvaluatorVersion } from "@/lib/evaluatorVersion";
import { createDefinitionBasedRubric } from "@/lib/evaluationRubric";
import {
  buildEvaluatorCalibrationCriteria,
  buildEvaluatorPromptFingerprint,
  buildJudgeCalibrationRerunPlan,
} from "@/lib/judgeCalibrationRerun";

describe("Judge calibration rerun planning", () => {
  it("creates an initial plan without making up a baseline", () => {
    const evaluator = evaluatorVersion();
    const criteria = buildEvaluatorCalibrationCriteria(evaluator);
    const plan = buildJudgeCalibrationRerunPlan({
      datasetVersionId: "gold-v1",
      judgeModelId: "judge-a",
      criteria,
      criteriaSource: "evaluator",
      evaluatorVersion: evaluator,
      runs: [],
    });

    expect(plan).toEqual({ trigger: "initial", changeKinds: [] });
    expect(criteria).toContain("Evaluator Prompt");
    expect(criteria).toContain("第一版 Prompt");
  });

  it("detects Judge, dimension, and Prompt changes against the latest run", () => {
    const v1 = evaluatorVersion();
    const v2 = evaluatorVersion({
      previous: v1,
      prompt: "第二版 Prompt，增加格式核验",
      dimensionName: "格式与事实正确性",
    });
    const baseline = calibrationRun(v1, {
      criteria: buildEvaluatorCalibrationCriteria(v1),
    });
    const plan = buildJudgeCalibrationRerunPlan({
      datasetVersionId: "gold-v1",
      judgeModelId: "judge-b",
      criteria: buildEvaluatorCalibrationCriteria(v2),
      criteriaSource: "evaluator",
      evaluatorVersion: v2,
      runs: [baseline],
    });

    expect(plan.trigger).toBe("configuration_change");
    expect(plan.baselineRun?.id).toBe("run-v1");
    expect(plan.changeKinds).toEqual(["judge", "dimensions", "prompt"]);
    expect(plan.changeKinds).not.toContain("criteria");
  });

  it("reuses an exact execution definition instead of demanding a paid rerun", () => {
    const v1 = evaluatorVersion();
    const baseline = calibrationRun(v1, {
      criteria: buildEvaluatorCalibrationCriteria(v1),
    });
    const plan = buildJudgeCalibrationRerunPlan({
      datasetVersionId: "gold-v1",
      judgeModelId: "judge-a",
      criteria: baseline.criteria,
      criteriaSource: "evaluator",
      evaluatorVersion: v1,
      runs: [baseline],
    });

    expect(plan.trigger).toBe("manual_repeat");
    expect(plan.matchingRun?.id).toBe("run-v1");
    expect(plan.changeKinds).toEqual([]);
  });

  it("reuses calibration when only immutable version metadata changes", () => {
    const v1 = evaluatorVersion();
    const v2 = evaluatorVersion({ previous: v1 });
    const baseline = calibrationRun(v1, {
      criteria: buildEvaluatorCalibrationCriteria(v1),
    });
    const plan = buildJudgeCalibrationRerunPlan({
      datasetVersionId: "gold-v1",
      judgeModelId: "judge-a",
      criteria: buildEvaluatorCalibrationCriteria(v2),
      criteriaSource: "evaluator",
      evaluatorVersion: v2,
      runs: [baseline],
    });

    expect(v2.definitionFingerprint).toBe(v1.definitionFingerprint);
    expect(plan.trigger).toBe("manual_repeat");
    expect(plan.matchingRun?.id).toBe("run-v1");
  });

  it("does not compare runs from another golden dataset version", () => {
    const v1 = evaluatorVersion();
    const baseline = calibrationRun(v1, {
      criteria: buildEvaluatorCalibrationCriteria(v1),
    });
    const plan = buildJudgeCalibrationRerunPlan({
      datasetVersionId: "gold-v2",
      judgeModelId: "judge-a",
      criteria: baseline.criteria,
      criteriaSource: "evaluator",
      evaluatorVersion: v1,
      runs: [baseline],
    });

    expect(plan).toEqual({ trigger: "initial", changeKinds: [] });
  });
});

function evaluatorVersion(options?: {
  previous?: EvaluatorVersion;
  prompt?: string;
  dimensionName?: string;
}): EvaluatorVersion {
  const dimensions: EvalDimension[] = [
    {
      ...createDefinitionBasedRubric(
        options?.dimensionName ?? "答案正确性",
        "回复必须满足可核验事实"
      ),
      weight: 100,
      vetoThreshold: 5,
    },
  ];
  const previous = options?.previous;
  return createEvaluatorVersion({
    existingVersions: previous ? [previous] : [],
    evaluatorId: previous?.evaluatorId,
    id: previous ? "evaluator-v2" : "evaluator-v1",
    name: "客服上线评价器",
    createTime: previous ? 200 : 100,
    createdBy: "Lu",
    applicableTaskId: "task-a",
    evalModelId: "judge-a",
    userRequirement: "判断回复能否上线",
    dimensions,
    evalPrompt: options?.prompt ?? "第一版 Prompt",
    evaluationMode: "reference",
    expectedAnswerColumn: "gold_answer",
  });
}

function calibrationRun(
  evaluator: EvaluatorVersion,
  options: { criteria: string }
): JudgeCalibrationRun {
  return {
    id: "run-v1",
    createTime: 100,
    finishTime: 200,
    goldenDatasetVersionId: "gold-v1",
    goldenDatasetName: "客服黄金集",
    goldenDatasetVersion: 1,
    judgeModelId: "judge-a",
    judgeModelName: "Judge A",
    criteria: options.criteria,
    criteriaSource: "evaluator",
    evaluatorVersionId: evaluator.id,
    evaluatorId: evaluator.evaluatorId,
    evaluatorVersionName: evaluator.name,
    evaluatorVersion: evaluator.version,
    evaluatorDefinitionFingerprint: evaluator.definitionFingerprint,
    evaluatorPolicyFingerprint: evaluator.policyFingerprint,
    evaluatorPromptFingerprint: buildEvaluatorPromptFingerprint(evaluator),
    status: "done",
    results: [],
    metrics: {
      totalCases: 0,
      completedCases: 0,
      errorCases: 0,
      matchingCases: 0,
      accuracy: null,
      cohenKappa: null,
      badCaseMissRate: null,
      falseRejectRate: null,
      confusion: {
        humanPassJudgePass: 0,
        humanPassJudgeFail: 0,
        humanFailJudgePass: 0,
        humanFailJudgeFail: 0,
      },
    },
  };
}
