import { describe, expect, it } from "vitest";
import {
  analyzeDimensionHumanFeedbackDraft,
  parseDimensionHumanFeedback,
  type DimensionHumanFeedbackTarget,
} from "../../src/lib/dimensionHumanFeedback";

const targets: DimensionHumanFeedbackTarget[] = [
  { targetId: "target-a", targetName: "Target A" },
  { targetId: "target-b", targetName: "Target B" },
];

describe("dimension human feedback", () => {
  it("requires complete bounded scores for every target", () => {
    expect(
      analyzeDimensionHumanFeedbackDraft(
        { mode: "scores", values: { "target-a": "8.5" }, note: "" },
        targets
      ).error
    ).toBe("Target B 尚未填写人工评分");
    expect(
      analyzeDimensionHumanFeedbackDraft(
        {
          mode: "scores",
          values: { "target-a": "10.1", "target-b": "6" },
          note: "",
        },
        targets
      ).error
    ).toContain("0–10");

    expect(
      analyzeDimensionHumanFeedbackDraft(
        {
          mode: "scores",
          values: { "target-a": "8.5", "target-b": "6" },
          note: "人工依据 token=placeholder-value",
        },
        targets
      )
    ).toEqual({
      feedback: {
        mode: "scores",
        judgments: [
          { targetId: "target-a", score: 8.5 },
          { targetId: "target-b", score: 6 },
        ],
        note: "人工依据 token=[REDACTED]",
      },
      error: null,
    });
  });

  it("requires a complete unique ranking across at least two targets", () => {
    expect(
      analyzeDimensionHumanFeedbackDraft(
        { mode: "ranking", values: { "target-a": "1" }, note: "" },
        [targets[0]]
      ).error
    ).toBe("偏好排序至少需要 2 个目标输出");
    expect(
      analyzeDimensionHumanFeedbackDraft(
        {
          mode: "ranking",
          values: { "target-a": "1", "target-b": "1" },
          note: "",
        },
        targets
      ).error
    ).toContain("偏好名次不能重复");
    expect(
      analyzeDimensionHumanFeedbackDraft(
        {
          mode: "ranking",
          values: { "target-a": "2", "target-b": "1" },
          note: "B 更贴近人工偏好",
        },
        targets
      )
    ).toEqual({
      feedback: {
        mode: "ranking",
        judgments: [
          { targetId: "target-a", rank: 2 },
          { targetId: "target-b", rank: 1 },
        ],
        note: "B 更贴近人工偏好",
      },
      error: null,
    });
  });

  it("rejects incomplete, duplicate, and unknown target ids from public requests", () => {
    expect(
      parseDimensionHumanFeedback(
        {
          mode: "scores",
          judgments: [{ targetId: "target-a", score: 9 }],
        },
        targets
      ).error
    ).toBe("人工反馈必须覆盖当前样本的全部目标输出");
    expect(
      parseDimensionHumanFeedback(
        {
          mode: "scores",
          judgments: [
            { targetId: "target-a", score: 9 },
            { targetId: "target-a", score: 8 },
          ],
        },
        targets
      ).error
    ).toBe("人工反馈的目标 id 不能重复");
    expect(
      parseDimensionHumanFeedback(
        {
          mode: "ranking",
          judgments: [
            { targetId: "target-a", rank: 1 },
            { targetId: "unknown", rank: 2 },
          ],
        },
        targets
      ).error
    ).toBe("人工反馈必须覆盖当前样本的全部目标输出");
  });

  it("canonicalizes public ranking requests in output order", () => {
    expect(
      parseDimensionHumanFeedback(
        {
          mode: "ranking",
          judgments: [
            { targetId: "target-b", rank: 1 },
            { targetId: "target-a", rank: 2 },
          ],
          note: "偏好 B",
        },
        targets
      )
    ).toEqual({
      feedback: {
        mode: "ranking",
        judgments: [
          { targetId: "target-a", rank: 2 },
          { targetId: "target-b", rank: 1 },
        ],
        note: "偏好 B",
      },
      error: null,
    });
  });
});
