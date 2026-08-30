import { describe, expect, it } from "vitest";
import { calculateJudgeCalibrationMetrics } from "@/lib/judgeCalibration";
import type { JudgeCalibrationCaseResult } from "@/types";

function result(
  caseId: string,
  humanLabel: "pass" | "fail",
  judgeLabel: "pass" | "fail"
): JudgeCalibrationCaseResult {
  return {
    caseId,
    humanLabel,
    judgeLabel,
    status: "success",
    confidence: 0.9,
    reason: "测试判定",
  };
}

describe("Judge calibration metrics", () => {
  it("reports perfect accuracy, kappa, and zero miss rate", () => {
    const metrics = calculateJudgeCalibrationMetrics([
      result("pass-1", "pass", "pass"),
      result("fail-1", "fail", "fail"),
    ]);

    expect(metrics).toEqual({
      totalCases: 2,
      completedCases: 2,
      errorCases: 0,
      matchingCases: 2,
      accuracy: 1,
      cohenKappa: 1,
      badCaseMissRate: 0,
      falseRejectRate: 0,
      confusion: {
        humanPassJudgePass: 1,
        humanPassJudgeFail: 0,
        humanFailJudgePass: 0,
        humanFailJudgeFail: 1,
      },
    });
  });

  it("calculates a balanced confusion matrix and bad-case miss rate", () => {
    const metrics = calculateJudgeCalibrationMetrics([
      result("pp", "pass", "pass"),
      result("pf", "pass", "fail"),
      result("fp", "fail", "pass"),
      result("ff", "fail", "fail"),
    ]);

    expect(metrics.accuracy).toBe(0.5);
    expect(metrics.cohenKappa).toBe(0);
    expect(metrics.badCaseMissRate).toBe(0.5);
    expect(metrics.falseRejectRate).toBe(0.5);
    expect(metrics.confusion).toEqual({
      humanPassJudgePass: 1,
      humanPassJudgeFail: 1,
      humanFailJudgePass: 1,
      humanFailJudgeFail: 1,
    });
  });

  it("excludes errors and returns null when a metric has no denominator", () => {
    const metrics = calculateJudgeCalibrationMetrics([
      result("pass-1", "pass", "pass"),
      {
        caseId: "error-1",
        humanLabel: "fail",
        status: "error",
        error: "Judge timeout",
      },
    ]);

    expect(metrics).toMatchObject({
      totalCases: 2,
      completedCases: 1,
      errorCases: 1,
      accuracy: 1,
      cohenKappa: null,
      badCaseMissRate: null,
      falseRejectRate: 0,
    });
  });

  it("does not invent percentages when no Case completed", () => {
    const metrics = calculateJudgeCalibrationMetrics([
      {
        caseId: "error-1",
        humanLabel: "fail",
        status: "error",
        error: "parse error",
      },
    ]);

    expect(metrics).toMatchObject({
      completedCases: 0,
      errorCases: 1,
      accuracy: null,
      cohenKappa: null,
      badCaseMissRate: null,
      falseRejectRate: null,
    });
  });
});
