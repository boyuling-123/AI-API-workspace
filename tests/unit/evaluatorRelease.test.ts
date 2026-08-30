import { describe, expect, it } from "vitest";
import type {
  EvaluatorVersion,
  JudgeCalibrationCaseResult,
  JudgeCalibrationRun,
} from "@/types";
import { createEvaluatorVersion } from "@/lib/evaluatorVersion";
import { createDefinitionBasedRubric } from "@/lib/evaluationRubric";
import { calculateJudgeCalibrationMetrics } from "@/lib/judgeCalibration";
import {
  buildEvaluatorCalibrationCriteria,
  buildEvaluatorPromptFingerprint,
} from "@/lib/judgeCalibrationRerun";
import {
  createEvaluatorRelease,
  evaluateEvaluatorCalibrationGate,
  getActiveEvaluatorRelease,
  isEvaluatorReleaseIntact,
} from "@/lib/evaluatorRelease";

describe("Evaluator calibration release gate", () => {
  it("publishes a fully calibrated version as an immutable Active release", () => {
    const evaluator = evaluatorVersion();
    const run = calibrationRun(evaluator);
    const release = createEvaluatorRelease({
      existingReleases: [],
      evaluatorVersion: evaluator,
      calibrationRun: run,
      releasedBy: " Lu ",
      id: "release-v1",
      releaseTime: 300,
    });

    expect(evaluateEvaluatorCalibrationGate(evaluator, run).passed).toBe(true);
    expect(release).toMatchObject({
      id: "release-v1",
      evaluatorVersionId: "evaluator-v1",
      evaluatorVersion: 1,
      calibrationRunId: "run-v1",
      releasedBy: "Lu",
    });
    expect(isEvaluatorReleaseIntact(release)).toBe(true);
    expect(getActiveEvaluatorRelease([release], evaluator.evaluatorId)?.id).toBe(
      "release-v1"
    );
  });

  it("blocks release when miss rate, sample size, status, or criteria binding fails", () => {
    const evaluator = evaluatorVersion();
    const run = calibrationRun(evaluator, smallFailingResults());
    run.status = "partial";
    run.criteriaSource = "custom";
    const gate = evaluateEvaluatorCalibrationGate(evaluator, run);

    expect(gate.passed).toBe(false);
    expect(
      gate.checks.filter((check) => !check.passed).map((check) => check.key)
    ).toEqual([
      "criteria_binding",
      "run_complete",
      "sample_size",
      "bad_case_miss_rate",
    ]);
    expect(() =>
      createEvaluatorRelease({
        existingReleases: [],
        evaluatorVersion: evaluator,
        calibrationRun: run,
        releasedBy: "Lu",
      })
    ).toThrow("Evaluator 未通过发布门禁");
  });

  it("requires the same family, exact criteria, and metrics derived from Case results", () => {
    const evaluator = evaluatorVersion();
    const run = calibrationRun(evaluator);
    run.evaluatorId = "another-family";
    run.criteria = `${run.criteria}\n绕过标准`;
    run.metrics = { ...run.metrics, accuracy: null };
    const gate = evaluateEvaluatorCalibrationGate(evaluator, run);

    expect(gate.passed).toBe(false);
    expect(
      gate.checks.filter((check) => !check.passed).map((check) => check.key)
    ).toEqual([
      "evaluator_binding",
      "criteria_binding",
      "metrics_integrity",
    ]);
  });

  it("rejects duplicate Case evidence even when stored metrics are recomputed", () => {
    const evaluator = evaluatorVersion();
    const run = calibrationRun(evaluator);
    run.results[1] = { ...run.results[0] };
    run.metrics = calculateJudgeCalibrationMetrics(run.results);
    const gate = evaluateEvaluatorCalibrationGate(evaluator, run);

    expect(gate.passed).toBe(false);
    expect(
      gate.checks.filter((check) => !check.passed).map((check) => check.key)
    ).toEqual(["result_integrity", "metrics_integrity"]);
  });

  it("appends releases, preserves history, and ignores tampered Active records", () => {
    const v1 = evaluatorVersion();
    const first = createEvaluatorRelease({
      existingReleases: [],
      evaluatorVersion: v1,
      calibrationRun: calibrationRun(v1),
      releasedBy: "Lu",
      id: "release-v1",
      releaseTime: 300,
    });
    const v2 = evaluatorVersion(v1);
    const second = createEvaluatorRelease({
      existingReleases: [first],
      evaluatorVersion: v2,
      calibrationRun: calibrationRun(v2, passingResults(), "run-v2"),
      releasedBy: "Reviewer",
      id: "release-v2",
      releaseTime: 400,
    });

    expect(second.previousReleaseId).toBe("release-v1");
    expect(getActiveEvaluatorRelease([first, second], v1.evaluatorId)?.id).toBe(
      "release-v2"
    );
    const tampered = { ...second, evaluatorVersion: 99 };
    expect(isEvaluatorReleaseIntact(tampered)).toBe(false);
    expect(getActiveEvaluatorRelease([first, tampered], v1.evaluatorId)?.id).toBe(
      "release-v1"
    );
    expect(isEvaluatorReleaseIntact(first)).toBe(true);
  });

  it("redacts publisher secrets and rejects duplicate release ids", () => {
    const evaluator = evaluatorVersion();
    const run = calibrationRun(evaluator);
    const release = createEvaluatorRelease({
      existingReleases: [],
      evaluatorVersion: evaluator,
      calibrationRun: run,
      releasedBy: "owner token=private-release-token",
      id: "release-safe",
    });
    expect(release.releasedBy).toContain("[REDACTED]");
    expect(JSON.stringify(release)).not.toContain("private-release-token");
    expect(() =>
      createEvaluatorRelease({
        existingReleases: [release],
        evaluatorVersion: evaluator,
        calibrationRun: run,
        releasedBy: "Lu",
        id: "release-safe",
      })
    ).toThrow("Evaluator 发布记录 id 已存在");
  });
});

function evaluatorVersion(previous?: EvaluatorVersion): EvaluatorVersion {
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
    dimensions: [
      {
        ...createDefinitionBasedRubric("答案正确性", "回复必须符合事实"),
        weight: 100,
      },
    ],
    evalPrompt: previous ? "第二版 Prompt" : "第一版 Prompt",
    evaluationMode: "comparison",
  });
}

function passingResults(): JudgeCalibrationCaseResult[] {
  return Array.from({ length: 20 }, (_, index) => {
    const label = index < 10 ? "pass" : "fail";
    return {
      caseId: `case-${String(index + 1).padStart(3, "0")}`,
      humanLabel: label,
      status: "success",
      judgeLabel: label,
      confidence: 0.98,
      reason: "与人工标准一致",
    };
  });
}

function smallFailingResults(): JudgeCalibrationCaseResult[] {
  return Array.from({ length: 10 }, (_, index) => {
    const humanLabel = index < 5 ? "pass" : "fail";
    return {
      caseId: `small-${String(index + 1).padStart(3, "0")}`,
      humanLabel,
      status: "success",
      judgeLabel: index === 5 ? "pass" : humanLabel,
      confidence: 0.9,
      reason: index === 5 ? "漏判" : "一致",
    };
  });
}

function calibrationRun(
  evaluator: EvaluatorVersion,
  results: JudgeCalibrationCaseResult[] = passingResults(),
  id = "run-v1"
): JudgeCalibrationRun {
  const metrics = calculateJudgeCalibrationMetrics(results);
  return {
    id,
    createTime: 100,
    finishTime: 200,
    goldenDatasetVersionId: "gold-v1",
    goldenDatasetName: "客服黄金集",
    goldenDatasetVersion: 1,
    judgeModelId: "judge-a",
    judgeModelName: "Judge A",
    criteria: buildEvaluatorCalibrationCriteria(evaluator),
    criteriaSource: "evaluator",
    evaluatorVersionId: evaluator.id,
    evaluatorId: evaluator.evaluatorId,
    evaluatorVersionName: evaluator.name,
    evaluatorVersion: evaluator.version,
    evaluatorDefinitionFingerprint: evaluator.definitionFingerprint,
    evaluatorPolicyFingerprint: evaluator.policyFingerprint,
    evaluatorPromptFingerprint: buildEvaluatorPromptFingerprint(evaluator),
    status: "done",
    results,
    metrics,
  };
}
