import { describe, expect, it } from "vitest";
import type {
  CalibrationReviewEvent,
  GoldenDatasetVersion,
  JudgeCalibrationCaseResult,
  JudgeCalibrationRun,
} from "@/types";
import { calculateJudgeCalibrationMetrics } from "@/lib/judgeCalibration";
import {
  buildCalibrationReviewQueue,
  createCalibrationReviewClaim,
  createCalibrationReviewCompletion,
  isCalibrationReviewEventIntact,
} from "@/lib/calibrationReview";

const version: GoldenDatasetVersion = {
  id: "gold-v1",
  datasetId: "gold-family",
  version: 1,
  name: "人工黄金集",
  createTime: 1,
  createdBy: "Lu",
  cases: [
    {
      caseId: "case-risk",
      prompt: "是否保证当天发货",
      candidateOutput: "保证当天发货",
      humanLabel: "fail",
    },
    {
      caseId: "case-error",
      prompt: "失败输入",
      candidateOutput: "失败输出",
      humanLabel: "pass",
    },
  ],
  contentFingerprint: "content",
  integrityFingerprint: "integrity",
};

describe("calibration review queue", () => {
  it("explains critical misses, Judge errors, disagreement and confidence risks", () => {
    const queue = buildCalibrationReviewQueue({
      runs: [
        run("run-risk", 100, [
          {
            caseId: "case-risk",
            humanLabel: "fail",
            status: "success",
            judgeLabel: "pass",
            confidence: 0.67,
            reason: "多数票通过",
            votes: [
              vote("judge-a", "pass"),
              vote("judge-b", "pass"),
              vote("judge-c", "fail"),
            ],
          },
          {
            caseId: "case-error",
            humanLabel: "pass",
            status: "error",
            error: "Judge B timeout",
          },
        ]),
      ],
      versions: [version],
      events: [],
    });

    expect(queue).toHaveLength(2);
    expect(queue.map((item) => item.result.caseId)).toEqual([
      "case-error",
      "case-risk",
    ]);
    expect(queue[0].risk).toMatchObject({ level: "critical", score: 100 });
    expect(queue[0].risk.signals[0].detail).toContain("Judge B timeout");
    expect(queue[1].risk.level).toBe("critical");
    expect(queue[1].risk.signals.map((signal) => signal.code)).toEqual([
      "bad_case_miss",
      "multi_judge_disagreement",
      "low_confidence",
    ]);
    expect(queue[1].datasetCase?.prompt).toBe("是否保证当天发货");
  });

  it("marks the same risky Case across runs as repeated and sorts newest first", () => {
    const result: JudgeCalibrationCaseResult = {
      caseId: "case-risk",
      humanLabel: "fail",
      status: "success",
      judgeLabel: "fail",
      confidence: 0.6,
      reason: "低置信度 fail",
    };
    const queue = buildCalibrationReviewQueue({
      runs: [run("run-old", 100, [result]), run("run-new", 200, [result])],
      versions: [version],
      events: [],
    });

    expect(queue.map((item) => item.run.id)).toEqual(["run-new", "run-old"]);
    expect(queue[0].risk).toMatchObject({
      level: "high",
      occurrenceCount: 2,
      score: 45,
    });
    expect(queue[0].risk.signals.at(-1)).toMatchObject({
      code: "repeated_risk",
      detail: expect.stringContaining("2 次校准运行"),
    });
  });

  it("creates an append-only claim and completion without replacing original labels", () => {
    const item = singleRiskItem();
    const claim = createCalibrationReviewClaim({
      item,
      existingEvents: [],
      actor: "Lu sk-abcdefgh123",
      id: "claim-1",
      createTime: 300,
    });
    expect(claim).toMatchObject({
      action: "claimed",
      actor: "Lu [REDACTED]",
      originalHumanLabel: "fail",
      originalJudgeLabel: "pass",
    });
    expect(isCalibrationReviewEventIntact(claim)).toBe(true);

    const completion = createCalibrationReviewCompletion({
      item,
      existingEvents: [claim],
      actor: "Lu [REDACTED]",
      decision: "override_fail",
      note: "确认过度承诺，token=secret-value-123",
      id: "complete-1",
      createTime: 400,
    });
    expect(completion).toMatchObject({
      action: "completed",
      claimEventId: "claim-1",
      decision: "override_fail",
      resolutionLabel: "fail",
      originalJudgeLabel: "pass",
      originalHumanLabel: "fail",
      note: "确认过度承诺，token=[REDACTED]",
    });
    expect(isCalibrationReviewEventIntact(completion)).toBe(true);

    const completedQueue = buildCalibrationReviewQueue({
      runs: [item.run],
      versions: [version],
      events: [claim, completion],
    });
    expect(completedQueue[0]).toMatchObject({
      status: "completed",
      claim: { id: "claim-1" },
      completion: { id: "complete-1" },
      result: { judgeLabel: "pass" },
    });
  });

  it("blocks duplicate claims, cross-reviewer completion and empty notes", () => {
    const item = singleRiskItem();
    const claim = createCalibrationReviewClaim({
      item,
      existingEvents: [],
      actor: "Lu",
      id: "claim-1",
      createTime: 300,
    });
    expect(() =>
      createCalibrationReviewClaim({
        item,
        existingEvents: [claim],
        actor: "Other",
      })
    ).toThrow("该 Case 已被领取");
    expect(() =>
      createCalibrationReviewCompletion({
        item,
        existingEvents: [claim],
        actor: "Other",
        decision: "override_fail",
        note: "不同人尝试提交",
      })
    ).toThrow("该 Case 已由 Lu 领取");
    expect(() =>
      createCalibrationReviewCompletion({
        item,
        existingEvents: [claim],
        actor: "Lu",
        decision: "override_fail",
        note: " ",
      })
    ).toThrow("复核说明不能为空");
  });

  it("does not allow confirming a Judge result that never completed", () => {
    const queue = buildCalibrationReviewQueue({
      runs: [
        run("run-error", 100, [
          {
            caseId: "case-error",
            humanLabel: "pass",
            status: "error",
            error: "timeout",
          },
        ]),
      ],
      versions: [version],
      events: [],
    });
    const claim = createCalibrationReviewClaim({
      item: queue[0],
      existingEvents: [],
      actor: "Lu",
      id: "claim-error",
    });
    expect(() =>
      createCalibrationReviewCompletion({
        item: queue[0],
        existingEvents: [claim],
        actor: "Lu",
        decision: "confirm_judge",
        note: "确认",
      })
    ).toThrow("失败 Case 没有可确认的 Judge 结论");
  });

  it("rejects tampered events and does not use them as queue state", () => {
    const item = singleRiskItem();
    const claim = createCalibrationReviewClaim({
      item,
      existingEvents: [],
      actor: "Lu",
      id: "claim-1",
    });
    const tampered: CalibrationReviewEvent = {
      ...claim,
      actor: "Other",
    };
    expect(isCalibrationReviewEventIntact(tampered)).toBe(false);
    expect(
      buildCalibrationReviewQueue({
        runs: [item.run],
        versions: [version],
        events: [tampered],
      })[0].status
    ).toBe("unclaimed");
  });
});

function singleRiskItem() {
  return buildCalibrationReviewQueue({
    runs: [
      run("run-risk", 100, [
        {
          caseId: "case-risk",
          humanLabel: "fail",
          status: "success",
          judgeLabel: "pass",
          confidence: 0.9,
          reason: "Judge 认为通过",
        },
      ]),
    ],
    versions: [version],
    events: [],
  })[0];
}

function vote(
  judgeModelId: string,
  judgeLabel: "pass" | "fail"
) {
  return {
    judgeModelId,
    judgeModelName: judgeModelId,
    status: "success" as const,
    judgeLabel,
    confidence: 0.9,
    reason: `${judgeModelId} ${judgeLabel}`,
  };
}

function run(
  id: string,
  finishTime: number,
  results: JudgeCalibrationCaseResult[]
): JudgeCalibrationRun {
  return {
    id,
    createTime: finishTime - 10,
    finishTime,
    goldenDatasetVersionId: version.id,
    goldenDatasetName: version.name,
    goldenDatasetVersion: version.version,
    judgeModelId: "judge",
    judgeModelName: "Judge",
    criteria: "严格判断",
    status: results.some((result) => result.status === "error")
      ? "partial"
      : "done",
    results,
    metrics: calculateJudgeCalibrationMetrics(results),
  };
}
