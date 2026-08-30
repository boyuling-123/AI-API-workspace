import { describe, expect, it } from "vitest";
import type {
  EvaluationRecord,
  ResultItem,
  TargetDimensionScores,
  Task,
} from "@/types";
import {
  buildEvaluationCaseExportSelection,
  buildEvaluationCaseInsights,
  filterEvaluationCaseInsights,
} from "@/lib/evaluationCaseFilter";

describe("evaluation Case filters", () => {
  it("classifies low-score, disagreement, high-risk, and failed Cases with explicit rules", () => {
    const { record, task } = filterFixture();
    const insights = buildEvaluationCaseInsights(record, task);

    expect(
      insights.map((insight) => [insight.inputId, insight.signals])
    ).toEqual([
      ["case-low", ["low_score"]],
      ["case-disagreement", ["disagreement"]],
      ["case-risk", ["high_risk"]],
      ["case-failure", ["failure"]],
      ["case-combined", ["low_score", "disagreement", "high_risk"]],
    ]);
    expect(insights[0]).toMatchObject({
      lowestScore: 5.5,
      highestScore: 5.8,
      scoreSpread: 0.3,
    });
    expect(insights[1].details.disagreement[0]).toContain("分差 3.00");
    expect(insights[2].details.high_risk[0]).toContain("一票否决");
    expect(insights[3].details.failure).toEqual([
      "Model A 运行失败：上游 503",
    ]);
  });

  it("supports explicit any/all composition and treats an empty selection as clear", () => {
    const { record, task } = filterFixture();
    const insights = buildEvaluationCaseInsights(record, task);
    const signals = ["low_score", "disagreement"] as const;

    expect(
      filterEvaluationCaseInsights(insights, {
        signals,
        matchMode: "any",
      }).map((insight) => insight.inputId)
    ).toEqual(["case-low", "case-disagreement", "case-combined"]);
    expect(
      filterEvaluationCaseInsights(insights, {
        signals,
        matchMode: "all",
      }).map((insight) => insight.inputId)
    ).toEqual(["case-combined"]);
    expect(
      filterEvaluationCaseInsights(insights, {
        signals: [],
        matchMode: "all",
      })
    ).toEqual(insights);
  });

  it("applies configurable thresholds without changing veto and failure signals", () => {
    const { record, task } = filterFixture();
    const insights = buildEvaluationCaseInsights(record, task, {
      lowScore: 5,
      disagreement: 4,
    });

    expect(insights[0].signals).toEqual([]);
    expect(insights[1].signals).toEqual([]);
    expect(insights[2].signals).toEqual(["high_risk"]);
    expect(insights[3].signals).toEqual(["failure"]);
    expect(insights[4].signals).toEqual([
      "low_score",
      "disagreement",
      "high_risk",
    ]);
  });

  it("derives legacy weighted scores but never turns missing dimensions into zero", () => {
    const task = makeTask(
      ["legacy-complete", "legacy-missing"],
      ["model-a"],
      {
        "legacy-complete": [successItem("model-a", "Model A")],
        "legacy-missing": [successItem("model-a", "Model A")],
      }
    );
    const record = makeRecord(
      [
        { name: "准确性", weight: 60 },
        { name: "清晰度", weight: 40 },
      ],
      [
        evaluationCase("legacy-complete", [
          targetScore("model-a", "Model A", undefined, false, [
            dimensionScore("准确性", 5),
            dimensionScore("清晰度", 10),
          ]),
        ]),
        evaluationCase("legacy-missing", [
          targetScore("model-a", "Model A", undefined, false, [
            dimensionScore("准确性", 10),
          ]),
        ]),
      ]
    );

    const insights = buildEvaluationCaseInsights(record, task);

    expect(insights[0]).toMatchObject({
      lowestScore: 7,
      signals: [],
    });
    expect(insights[1]).toMatchObject({
      lowestScore: null,
      signals: ["failure"],
    });
    expect(insights[1].details.failure).toEqual([
      "Model A 评价分缺失或非法",
    ]);
  });

  it("builds an exact, stable export subset without mutating history", () => {
    const { record, task } = filterFixture();
    record.results.push(evaluationCase("case-without-source", []));
    task.inputs.push({
      id: "case-without-source",
      prompt: "缺少来源结果",
      images: [],
    });
    const before = JSON.stringify({ record, task });

    const selection = buildEvaluationCaseExportSelection(record, task, [
      "case-disagreement",
      "case-without-source",
    ]);

    expect(selection.evaluations.map((item) => item.inputId)).toEqual([
      "case-disagreement",
      "case-without-source",
    ]);
    expect(selection.inputs.map((item) => item.id)).toEqual([
      "case-disagreement",
      "case-without-source",
    ]);
    expect(selection.results).toEqual([
      task.results.find((item) => item.inputId === "case-disagreement"),
      { inputId: "case-without-source", items: [] },
    ]);
    expect(JSON.stringify({ record, task })).toBe(before);
  });
});

function filterFixture(): { record: EvaluationRecord; task: Task } {
  const inputIds = [
    "case-low",
    "case-disagreement",
    "case-risk",
    "case-failure",
    "case-combined",
  ];
  const targetIds = ["model-a", "model-b"];
  const task = makeTask(inputIds, targetIds, {
    "case-low": [
      successItem("model-a", "Model A"),
      successItem("model-b", "Model B"),
    ],
    "case-disagreement": [
      successItem("model-a", "Model A"),
      successItem("model-b", "Model B"),
    ],
    "case-risk": [
      successItem("model-a", "Model A"),
      successItem("model-b", "Model B"),
    ],
    "case-failure": [
      {
        ...successItem("model-a", "Model A"),
        status: "error",
        error: "上游 503",
      },
      successItem("model-b", "Model B"),
    ],
    "case-combined": [
      successItem("model-a", "Model A"),
      successItem("model-b", "Model B"),
    ],
  });
  const record = makeRecord(
    [{ name: "质量", weight: 100 }],
    [
      evaluationCase("case-low", [
        targetScore("model-a", "Model A", 5.5),
        targetScore("model-b", "Model B", 5.8),
      ]),
      evaluationCase("case-disagreement", [
        targetScore("model-a", "Model A", 9),
        targetScore("model-b", "Model B", 6),
      ]),
      evaluationCase("case-risk", [
        targetScore("model-a", "Model A", 8, true),
        targetScore("model-b", "Model B", 8.5),
      ]),
      evaluationCase("case-failure", [
        targetScore("model-b", "Model B", 7),
      ]),
      evaluationCase("case-combined", [
        targetScore("model-a", "Model A", 2),
        targetScore("model-b", "Model B", 8),
      ]),
    ]
  );
  return { record, task };
}

function makeTask(
  inputIds: string[],
  targetIds: string[],
  itemsByInputId: Record<string, ResultItem[]>
): Task {
  return {
    id: "task-1",
    createTime: 1,
    contentMode: "text",
    runMode: "batch",
    inputs: inputIds.map((id) => ({ id, prompt: id, images: [] })),
    targetIds,
    concurrency: 2,
    paramSnapshot: [],
    results: inputIds.map((inputId) => ({
      inputId,
      items: itemsByInputId[inputId] ?? [],
    })),
    status: "done",
  };
}

function makeRecord(
  dimensions: EvaluationRecord["dimensions"],
  results: EvaluationRecord["results"]
): EvaluationRecord {
  return {
    id: "evaluation-1",
    sourceTaskId: "task-1",
    createTime: 2,
    evalModelId: "judge-1",
    userRequirement: "筛选风险 Case",
    dimensions,
    evalPrompt: "固定 Judge Prompt",
    scope: "all",
    count: results.length,
    status: "done",
    results,
  };
}

function evaluationCase(
  inputId: string,
  scores: TargetDimensionScores[]
): EvaluationRecord["results"][number] {
  return { inputId, scores, summary: "", recommendation: "" };
}

function targetScore(
  targetId: string,
  targetName: string,
  weightedScore?: number,
  vetoed = false,
  dimensionScores = [dimensionScore("质量", weightedScore ?? 0)]
): TargetDimensionScores {
  return {
    targetId,
    targetName,
    dimensionScores,
    weightedScore,
    vetoed,
    vetoReasons: vetoed ? ["命中上线硬规则"] : [],
  };
}

function dimensionScore(dimension: string, score: number) {
  return { dimension, score, comment: `${dimension} ${score}` };
}

function successItem(targetId: string, targetName: string): ResultItem {
  return {
    targetId,
    targetName,
    status: "success",
    outputText: `${targetName} 输出`,
  };
}
