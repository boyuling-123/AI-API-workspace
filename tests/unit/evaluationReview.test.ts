import { describe, expect, it } from "vitest";
import type { EvaluationRecord, EvaluationReviewEvent } from "@/types";
import {
  buildLatestEvaluationReviewMap,
  createEvaluationReviewEvent,
  evaluationReviewKey,
  getEvaluationReviewHistory,
  isEvaluationReviewEventIntact,
} from "@/lib/evaluationReview";

describe("evaluation human review", () => {
  it("creates an immutable override while preserving the original AI scores", () => {
    const record = evaluationRecord();
    const before = JSON.stringify(record);
    const event = createEvaluationReviewEvent({
      record,
      inputId: "case-1",
      targetId: "model-a",
      existingEvents: [],
      actor: "Lu",
      note: "人工复核后确认可提升准确性评分",
      isBadCase: true,
      dimensionScores: [
        { dimension: "准确性", score: 9 },
        { dimension: "清晰度", score: 7 },
      ],
      id: "review-1",
      createTime: 100,
    });

    expect(event).toMatchObject({
      reviewKey: "evaluation-1:case-1:model-a",
      originalDimensionScores: [
        { dimension: "准确性", score: 4 },
        { dimension: "清晰度", score: 8 },
      ],
      originalWeightedScore: 5.2,
      originalVetoed: true,
      humanDimensionScores: [
        { dimension: "准确性", score: 9 },
        { dimension: "清晰度", score: 7 },
      ],
      humanWeightedScore: 8.4,
      humanVetoed: false,
      isBadCase: true,
    });
    expect(isEvaluationReviewEventIntact(event)).toBe(true);
    expect(JSON.stringify(record)).toBe(before);
  });

  it("appends a new version, links the previous event, and resolves the latest one", () => {
    const record = evaluationRecord();
    const first = review(record, [], "review-1", 100, 8, true);
    const second = review(record, [first], "review-2", 200, 7, false);

    expect(second.previousEventId).toBe("review-1");
    expect(
      getEvaluationReviewHistory(
        [second, first],
        record.id,
        "case-1",
        "model-a"
      ).map((event) => event.id)
    ).toEqual(["review-2", "review-1"]);
    expect(
      buildLatestEvaluationReviewMap([first, second], record.id).get(
        evaluationReviewKey(record.id, "case-1", "model-a")
      )?.id
    ).toBe("review-2");
  });

  it("keeps event time monotonic when two versions request the same timestamp", () => {
    const record = evaluationRecord();
    const first = review(record, [], "review-1", 100, 8, true);
    const second = review(record, [first], "review-2", 100, 7, false);

    expect(second.createTime).toBe(101);
    expect(
      getEvaluationReviewHistory(
        [second, first],
        record.id,
        "case-1",
        "model-a"
      ).map((event) => event.id)
    ).toEqual(["review-2", "review-1"]);
  });

  it("recomputes vetoes from human scores and the original policy", () => {
    const record = evaluationRecord();
    const event = createEvaluationReviewEvent({
      record,
      inputId: "case-1",
      targetId: "model-a",
      existingEvents: [],
      actor: "Lu",
      note: "人工确认准确性仍不达标",
      isBadCase: false,
      dimensionScores: [
        { dimension: "准确性", score: 5.5 },
        { dimension: "清晰度", score: 10 },
      ],
    });

    expect(event.humanWeightedScore).toBe(6.85);
    expect(event.humanVetoed).toBe(true);
    expect(event.humanVetoReasons[0]).toContain("低于否决阈值 6");
  });

  it("redacts stored actor and note text", () => {
    const event = createEvaluationReviewEvent({
      record: evaluationRecord(),
      inputId: "case-1",
      targetId: "model-a",
      existingEvents: [],
      actor: "Lu sk-abcdefgh123",
      note: "核验 token=secret-value-123 后补充说明",
      isBadCase: false,
      dimensionScores: [
        { dimension: "准确性", score: 4 },
        { dimension: "清晰度", score: 8 },
      ],
    });

    expect(event.actor).toBe("Lu [REDACTED]");
    expect(event.note).toBe("核验 token=[REDACTED] 后补充说明");
    expect(isEvaluationReviewEventIntact(event)).toBe(true);
  });

  it("rejects empty reasons, incomplete dimensions, invalid scores, and unknown targets", () => {
    const record = evaluationRecord();
    const base = {
      record,
      inputId: "case-1",
      targetId: "model-a",
      existingEvents: [] as EvaluationReviewEvent[],
      actor: "Lu",
      note: "有明确理由",
      isBadCase: false,
    };

    expect(() =>
      createEvaluationReviewEvent({
        ...base,
        note: " ",
        dimensionScores: [
          { dimension: "准确性", score: 4 },
          { dimension: "清晰度", score: 8 },
        ],
      })
    ).toThrow("修改理由不能为空");
    expect(() =>
      createEvaluationReviewEvent({
        ...base,
        dimensionScores: [{ dimension: "准确性", score: 4 }],
      })
    ).toThrow("完整覆盖全部原始维度");
    expect(() =>
      createEvaluationReviewEvent({
        ...base,
        dimensionScores: [
          { dimension: "准确性", score: 4.25 },
          { dimension: "清晰度", score: 8 },
        ],
      })
    ).toThrow("最多 1 位小数");
    expect(() =>
      createEvaluationReviewEvent({
        ...base,
        targetId: "unknown",
        dimensionScores: [
          { dimension: "准确性", score: 4 },
          { dimension: "清晰度", score: 8 },
        ],
      })
    ).toThrow("未找到待复核的目标评分");
  });

  it("excludes tampered events from current state", () => {
    const record = evaluationRecord();
    const event = review(record, [], "review-1", 100, 8, true);
    const tampered: EvaluationReviewEvent = {
      ...event,
      humanWeightedScore: 10,
    };

    expect(isEvaluationReviewEventIntact(tampered)).toBe(false);
    expect(buildLatestEvaluationReviewMap([tampered], record.id).size).toBe(0);
  });

  it("keeps valid legacy AI precision while enforcing one decimal for human scores", () => {
    const record = evaluationRecord();
    record.results[0].scores[0].dimensionScores[0].score = 4.25;
    const event = createEvaluationReviewEvent({
      record,
      inputId: "case-1",
      targetId: "model-a",
      existingEvents: [],
      actor: "Lu",
      note: "旧评分精度兼容检查",
      isBadCase: false,
      dimensionScores: [
        { dimension: "准确性", score: 4.3 },
        { dimension: "清晰度", score: 8 },
      ],
    });

    expect(event.originalDimensionScores[0].score).toBe(4.25);
    expect(isEvaluationReviewEventIntact(event)).toBe(true);
  });
});

function evaluationRecord(): EvaluationRecord {
  return {
    id: "evaluation-1",
    sourceTaskId: "task-1",
    createTime: 1,
    evalModelId: "judge-1",
    userRequirement: "复核评分",
    dimensions: [
      { name: "准确性", weight: 70, vetoThreshold: 6 },
      { name: "清晰度", weight: 30 },
    ],
    evalPrompt: "固定 Prompt",
    scope: "all",
    count: 1,
    status: "done",
    results: [
      {
        inputId: "case-1",
        scores: [
          {
            targetId: "model-a",
            targetName: "Model A",
            dimensionScores: [
              { dimension: "准确性", score: 4, comment: "存在事实错误" },
              { dimension: "清晰度", score: 8, comment: "表达清楚" },
            ],
            weightedScore: 5.2,
            vetoed: true,
            vetoReasons: ["准确性低于 6"],
          },
        ],
        summary: "AI 总结",
        recommendation: "AI 推荐",
      },
    ],
  };
}

function review(
  record: EvaluationRecord,
  existingEvents: EvaluationReviewEvent[],
  id: string,
  createTime: number,
  accuracy: number,
  isBadCase: boolean
) {
  return createEvaluationReviewEvent({
    record,
    inputId: "case-1",
    targetId: "model-a",
    existingEvents,
    actor: "Lu",
    note: `${id} 的人工理由`,
    isBadCase,
    dimensionScores: [
      { dimension: "准确性", score: accuracy },
      { dimension: "清晰度", score: 8 },
    ],
    id,
    createTime,
  });
}
