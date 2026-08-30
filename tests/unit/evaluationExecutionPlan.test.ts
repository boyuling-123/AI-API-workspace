import { describe, expect, it } from "vitest";
import {
  buildEvaluationExecutionPlan,
  DEFAULT_TRIAL_EVALUATION_COUNT,
  MAX_TRIAL_EVALUATION_COUNT,
} from "@/lib/evaluationExecutionPlan";

describe("evaluation execution plan", () => {
  const inputIds = ["case-1", "case-2", "case-3", "case-4", "case-5", "case-6"];

  it("limits a trial to a deterministic small sample without writing history", () => {
    const plan = buildEvaluationExecutionPlan({
      intent: "trial",
      eligibleInputIds: inputIds,
      trialCount: 2,
    });

    expect(plan).toEqual({
      intent: "trial",
      inputIds: ["case-1", "case-2"],
      judgeCallCount: 2,
      reusedOutputCount: 2,
      testedTargetCallCount: 0,
      writesHistory: false,
    });
  });

  it("uses safe trial defaults and caps oversized requests", () => {
    expect(
      buildEvaluationExecutionPlan({
        intent: "trial",
        eligibleInputIds: inputIds,
      }).inputIds
    ).toHaveLength(DEFAULT_TRIAL_EVALUATION_COUNT);
    expect(
      buildEvaluationExecutionPlan({
        intent: "trial",
        eligibleInputIds: inputIds,
        trialCount: 99,
      }).inputIds
    ).toHaveLength(MAX_TRIAL_EVALUATION_COUNT);
    expect(
      buildEvaluationExecutionPlan({
        intent: "trial",
        eligibleInputIds: inputIds,
        trialCount: 0,
      }).inputIds
    ).toEqual(["case-1"]);
  });

  it("reuses all eligible outputs for formal evaluation and removes duplicate ids", () => {
    const plan = buildEvaluationExecutionPlan({
      intent: "formal",
      eligibleInputIds: ["case-1", "case-1", "", "case-2"],
      trialCount: 1,
    });

    expect(plan.inputIds).toEqual(["case-1", "case-2"]);
    expect(plan.judgeCallCount).toBe(2);
    expect(plan.testedTargetCallCount).toBe(0);
    expect(plan.writesHistory).toBe(true);
  });
});
