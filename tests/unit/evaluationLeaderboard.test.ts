import { describe, expect, it } from "vitest";
import type { EvaluationRecord } from "@/types";
import { buildEvaluationLeaderboard } from "@/lib/evaluationLeaderboard";

describe("evaluation leaderboard", () => {
  it("normalizes selected weights and ranks complete targets deterministically", () => {
    const record = evaluationRecord({
      dimensions: [dimension("准确性", 60), dimension("清晰度", 40)],
      cases: [
        evaluationCase("case-1", [
          target("model-a", "Model A", [score("准确性", 9), score("清晰度", 6)]),
          target("model-b", "Model B", [score("准确性", 7), score("清晰度", 9)]),
        ]),
        evaluationCase("case-2", [
          target("model-a", "Model A", [score("准确性", 8), score("清晰度", 7)]),
          target("model-b", "Model B", [score("准确性", 8), score("清晰度", 9)]),
        ]),
      ],
    });

    const leaderboard = buildEvaluationLeaderboard(record);

    expect(leaderboard.selectedDimensions).toEqual([
      { name: "准确性", normalizedWeight: 0.6 },
      { name: "清晰度", normalizedWeight: 0.4 },
    ]);
    expect(leaderboard.entries.map((entry) => entry.targetId)).toEqual([
      "model-b",
      "model-a",
    ]);
    expect(leaderboard.entries[0]).toMatchObject({
      rank: 1,
      score: 8.1,
      evaluatedCases: 2,
      totalCases: 2,
      eligible: true,
    });
    expect(leaderboard.entries[1]).toMatchObject({ rank: 2, score: 7.7 });
  });

  it("switches to a single dimension without mutating the saved evaluation", () => {
    const record = evaluationRecord({
      dimensions: [dimension("准确性", 60), dimension("清晰度", 40)],
      cases: [
        evaluationCase("case-1", [
          target("model-a", "Model A", [score("准确性", 9), score("清晰度", 6)]),
          target("model-b", "Model B", [score("准确性", 7), score("清晰度", 9)]),
        ]),
        evaluationCase("case-2", [
          target("model-a", "Model A", [score("准确性", 8), score("清晰度", 7)]),
          target("model-b", "Model B", [score("准确性", 8), score("清晰度", 9)]),
        ]),
      ],
    });
    const before = JSON.stringify(record);

    const leaderboard = buildEvaluationLeaderboard(record, ["准确性"]);

    expect(leaderboard.selectedDimensions).toEqual([
      { name: "准确性", normalizedWeight: 1 },
    ]);
    expect(leaderboard.entries.map((entry) => [entry.targetId, entry.score])).toEqual([
      ["model-a", 8.5],
      ["model-b", 7.5],
    ]);
    expect(JSON.stringify(record)).toBe(before);
  });

  it("does not fill missing dimension scores with zero or rank partial coverage", () => {
    const record = evaluationRecord({
      dimensions: [dimension("准确性", 50), dimension("清晰度", 50)],
      cases: [
        evaluationCase("case-1", [
          target("complete", "Complete", [score("准确性", 8), score("清晰度", 8)]),
          target("partial", "Partial", [score("准确性", 10)]),
        ]),
        evaluationCase("case-2", [
          target("complete", "Complete", [score("准确性", 8), score("清晰度", 8)]),
          target("partial", "Partial", [score("准确性", 10), score("清晰度", 10)], true),
        ]),
      ],
    });

    const leaderboard = buildEvaluationLeaderboard(record, undefined, [
      { targetId: "no-score", targetName: "No Score" },
    ]);

    expect(leaderboard.eligibleTargets).toBe(1);
    expect(leaderboard.entries[0]).toMatchObject({
      targetId: "complete",
      rank: 1,
      score: 8,
    });
    expect(leaderboard.entries[1]).toMatchObject({
      targetId: "partial",
      rank: null,
      score: 10,
      evaluatedCases: 1,
      totalCases: 2,
      coverageRatio: 0.5,
      vetoedCases: 1,
      eligible: false,
    });
    expect(leaderboard.entries[2]).toMatchObject({
      targetId: "no-score",
      rank: null,
      score: null,
      evaluatedCases: 0,
      totalCases: 2,
      coverageRatio: 0,
      eligible: false,
    });
  });

  it("uses competition ranking for ties and a stable target id tie-breaker", () => {
    const record = evaluationRecord({
      dimensions: [dimension("质量", 100)],
      cases: [
        evaluationCase("case-1", [
          target("model-b", "B", [score("质量", 8)]),
          target("model-a", "A", [score("质量", 8)]),
          target("model-c", "C", [score("质量", 7)]),
        ]),
      ],
    });

    const leaderboard = buildEvaluationLeaderboard(record);

    expect(leaderboard.entries.map((entry) => [entry.targetId, entry.rank])).toEqual([
      ["model-a", 1],
      ["model-b", 1],
      ["model-c", 3],
    ]);
  });

  it("falls back to equal weights for legacy dimensions and ignores unknown selections", () => {
    const record = evaluationRecord({
      dimensions: [dimension("事实"), dimension("表达")],
      cases: [
        evaluationCase("case-1", [
          target("model-a", "A", [score("事实", 10), score("表达", 6)]),
        ]),
      ],
    });

    expect(buildEvaluationLeaderboard(record).entries[0].score).toBe(8);
    expect(buildEvaluationLeaderboard(record, ["不存在"])).toMatchObject({
      eligibleTargets: 0,
      selectedDimensions: [],
      entries: [],
    });
  });
});

function evaluationRecord({
  dimensions,
  cases,
}: {
  dimensions: EvaluationRecord["dimensions"];
  cases: EvaluationRecord["results"];
}): EvaluationRecord {
  return {
    id: "evaluation-1",
    sourceTaskId: "task-1",
    createTime: 1,
    evalModelId: "judge-1",
    userRequirement: "选择最佳模型",
    dimensions,
    evalPrompt: "固定测试 Prompt",
    scope: "all",
    count: cases.length,
    status: "done",
    results: cases,
  };
}

function dimension(name: string, weight?: number) {
  return { name, weight };
}

function evaluationCase(
  inputId: string,
  scores: EvaluationRecord["results"][number]["scores"]
) {
  return { inputId, scores, summary: "", recommendation: "" };
}

function target(
  targetId: string,
  targetName: string,
  dimensionScores: { dimension: string; score: number; comment: string }[],
  vetoed = false
) {
  return {
    targetId,
    targetName,
    dimensionScores,
    vetoed,
    vetoReasons: vetoed ? ["测试否决"] : [],
  };
}

function score(dimensionName: string, value: number) {
  return {
    dimension: dimensionName,
    score: value,
    comment: `${dimensionName} ${value}`,
  };
}
