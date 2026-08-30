import { describe, expect, it } from "vitest";
import type {
  JudgeArbitrationStrategy,
  JudgeCalibrationCaseResult,
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
  isMultiJudgeCalibrationEvidenceIntact,
  normalizeJudgeArbitrationStrategy,
  normalizeJudgeModels,
} from "@/lib/multiJudgeCalibration";

const judges: JudgeCalibrationModelSnapshot[] = [
  { id: "judge-a", name: "Judge A" },
  { id: "judge-b", name: "Judge B" },
  { id: "judge-c", name: "Judge C" },
];

describe("multi Judge calibration", () => {
  it("uses a deterministic majority and keeps every original vote", () => {
    const votes = [vote("judge-a", "Judge A", "pass"), vote("judge-b", "Judge B", "pass"), vote("judge-c", "Judge C", "fail")];
    const result = arbitrateJudgeVotes({
      caseId: "case-1",
      humanLabel: "pass",
      votes,
      strategy: "majority_conservative",
    });

    expect(result).toMatchObject({
      status: "success",
      judgeLabel: "pass",
      confidence: 2 / 3,
    });
    expect(result.reason).toContain("pass 2 / fail 1");
    expect(result.votes).toEqual(votes);
    expect(result.votes).not.toBe(votes);
    expect(hasJudgeDisagreement(votes)).toBe(true);
  });

  it("resolves a majority tie as fail and supports unanimous-pass policy", () => {
    const tieVotes = [
      vote("judge-a", "Judge A", "pass"),
      vote("judge-b", "Judge B", "fail"),
    ];
    expect(
      arbitrateJudgeVotes({
        caseId: "case-tie",
        humanLabel: "fail",
        votes: tieVotes,
        strategy: "majority_conservative",
      })
    ).toMatchObject({ judgeLabel: "fail", confidence: 0.5 });
    expect(
      arbitrateJudgeVotes({
        caseId: "case-unanimous",
        humanLabel: "fail",
        votes: [
          vote("judge-a", "Judge A", "pass"),
          vote("judge-b", "Judge B", "pass"),
          vote("judge-c", "Judge C", "fail"),
        ],
        strategy: "unanimous_pass",
      })
    ).toMatchObject({ judgeLabel: "fail", confidence: 1 / 3 });
  });

  it("turns any missing or failed Judge vote into a Case error", () => {
    const result = arbitrateJudgeVotes({
      caseId: "case-error",
      humanLabel: "pass",
      votes: [
        vote("judge-a", "Judge A", "pass"),
        {
          judgeModelId: "judge-b",
          judgeModelName: "Judge B",
          status: "error",
          error: "timeout",
        },
      ],
      strategy: "majority_conservative",
    });

    expect(result.status).toBe("error");
    expect(result.error).toBe("多 Judge 未完整返回：Judge B");
    expect(result.judgeLabel).toBeUndefined();
  });

  it("normalizes selection and creates an order-independent fingerprint", () => {
    expect(
      buildMultiJudgeSelectionId(judges, "majority_conservative")
    ).toBe(
      buildMultiJudgeSelectionId(
        [judges[2], judges[0], judges[1]],
        "majority_conservative"
      )
    );
    expect(
      buildMultiJudgeSelectionId(judges, "majority_conservative")
    ).not.toBe(buildMultiJudgeSelectionId(judges, "unanimous_pass"));
    expect(() =>
      normalizeJudgeModels([judges[0], { ...judges[0] }])
    ).toThrow("Judge 不能重复选择");
    expect(() => normalizeJudgeModels([judges[0]])).toThrow("必须选择 2-5");
    expect(() =>
      normalizeJudgeArbitrationStrategy(
        "silent_fallback" as JudgeArbitrationStrategy
      )
    ).toThrow("不支持的多 Judge 仲裁策略");
  });

  it("recomputes final arbitration and per-Judge metrics before trusting evidence", () => {
    const results = [
      arbitrationResult("case-pass", "pass", ["pass", "pass", "fail"]),
      arbitrationResult("case-fail", "fail", ["fail", "fail", "fail"]),
    ];
    const run = multiJudgeRun(results, "majority_conservative");

    expect(calculatePerJudgeMetrics(results, judges)).toEqual(
      run.perJudgeMetrics
    );
    expect(isMultiJudgeCalibrationEvidenceIntact(run)).toBe(true);

    const tamperedResult = structuredClone(run);
    tamperedResult.results[0].judgeLabel = "fail";
    tamperedResult.metrics = calculateJudgeCalibrationMetrics(
      tamperedResult.results
    );
    expect(isMultiJudgeCalibrationEvidenceIntact(tamperedResult)).toBe(false);

    const tamperedMetrics = structuredClone(run);
    tamperedMetrics.perJudgeMetrics![0].metrics.accuracy = 0;
    expect(isMultiJudgeCalibrationEvidenceIntact(tamperedMetrics)).toBe(false);

    const tamperedFinalMetrics = structuredClone(run);
    tamperedFinalMetrics.metrics.accuracy = 0;
    expect(isMultiJudgeCalibrationEvidenceIntact(tamperedFinalMetrics)).toBe(
      false
    );

    const tamperedVote = structuredClone(run);
    tamperedVote.results[0].votes![0].judgeModelName = "Other Judge";
    expect(isMultiJudgeCalibrationEvidenceIntact(tamperedVote)).toBe(false);

    const partialMultiEvidence = structuredClone(run);
    delete partialMultiEvidence.judgeModels;
    expect(isMultiJudgeCalibrationEvidenceIntact(partialMultiEvidence)).toBe(
      false
    );
  });
});

function vote(
  judgeModelId: string,
  judgeModelName: string,
  judgeLabel: "pass" | "fail"
): JudgeCalibrationVote {
  return {
    judgeModelId,
    judgeModelName,
    status: "success",
    judgeLabel,
    confidence: 0.9,
    reason: `${judgeModelName} reason`,
  };
}

function arbitrationResult(
  caseId: string,
  humanLabel: "pass" | "fail",
  labels: Array<"pass" | "fail">
): JudgeCalibrationCaseResult {
  return arbitrateJudgeVotes({
    caseId,
    humanLabel,
    votes: judges.map((judge, index) =>
      vote(judge.id, judge.name, labels[index])
    ),
    strategy: "majority_conservative",
  });
}

function multiJudgeRun(
  results: JudgeCalibrationCaseResult[],
  strategy: JudgeArbitrationStrategy
): JudgeCalibrationRun {
  return {
    id: "multi-run",
    createTime: 100,
    finishTime: 200,
    goldenDatasetVersionId: "gold-v1",
    goldenDatasetName: "Golden",
    goldenDatasetVersion: 1,
    judgeModelId: buildMultiJudgeSelectionId(judges, strategy),
    judgeModelName: "3 Judges",
    judgeModels: judges,
    arbitrationStrategy: strategy,
    perJudgeMetrics: calculatePerJudgeMetrics(results, judges),
    disagreementCases: results.filter((result) =>
      hasJudgeDisagreement(result.votes ?? [])
    ).length,
    criteria: "严格判断",
    status: "done",
    results,
    metrics: calculateJudgeCalibrationMetrics(results),
  };
}
