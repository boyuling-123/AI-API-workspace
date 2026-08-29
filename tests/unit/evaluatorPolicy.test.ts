import { describe, expect, it } from "vitest";
import {
  analyzeEvaluatorPolicy,
  buildEvaluatorPolicyFingerprint,
  calculateEvaluatorPolicyOutcome,
  distributeEvenEvaluatorWeights,
  parseEvaluatorPolicy,
} from "../../src/lib/evaluatorPolicy";
import { createDefinitionBasedRubric } from "../../src/lib/evaluationRubric";

function rubric(name: string) {
  return createDefinitionBasedRubric(name, `${name}必须满足业务要求`);
}

describe("evaluator policy", () => {
  it("distributes an exact 100 percent in stable basis points", () => {
    const distributed = distributeEvenEvaluatorWeights([
      rubric("准确性"),
      rubric("完整性"),
      rubric("合规性"),
    ]);

    expect(distributed.map((item) => item.weight)).toEqual([
      33.34, 33.33, 33.33,
    ]);
    expect(
      distributed.reduce((total, item) => total + (item.weight ?? 0), 0)
    ).toBe(100);
  });

  it("requires numeric weights totaling 100 and bounded veto thresholds", () => {
    const analysis = analyzeEvaluatorPolicy([
      { ...rubric("准确性"), weight: 60.123 },
      { ...rubric("完整性"), weight: 30, vetoThreshold: 10.1 },
    ]);

    expect(analysis.issues.map((issue) => issue.field)).toEqual([
      "weight",
      "vetoThreshold",
    ]);
    expect(() =>
      parseEvaluatorPolicy([
        { ...rubric("准确性"), weight: 60 },
        { ...rubric("完整性"), weight: 30 },
      ])
    ).toThrow("权重合计必须为 100%，当前为 90%");
  });

  it("calculates weighted scores and vetoes without model arithmetic", () => {
    const policy = parseEvaluatorPolicy([
      { ...rubric("准确性"), weight: 70 },
      { ...rubric("合规性"), weight: 30, vetoThreshold: 5 },
    ]);

    expect(
      calculateEvaluatorPolicyOutcome(policy, [
        { dimension: "准确性", score: 8 },
        { dimension: "合规性", score: 4 },
      ])
    ).toEqual({
      weightedScore: 6.8,
      vetoed: true,
      vetoReasons: ["“合规性”得分 4.0，低于否决阈值 5"],
    });
  });

  it("changes the confirmation fingerprint after any policy edit", () => {
    const original = [
      { ...rubric("准确性"), weight: 50 },
      { ...rubric("完整性"), weight: 50 },
    ];
    const edited = [
      { ...original[0], weight: 60 },
      { ...original[1], weight: 40 },
    ];

    expect(buildEvaluatorPolicyFingerprint(original)).not.toBe(
      buildEvaluatorPolicyFingerprint(edited)
    );
  });
});
