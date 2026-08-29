import { describe, expect, it } from "vitest";
import type {
  EvalDimension,
  EvaluationRecord,
  ResultRow,
  TaskInput,
} from "../../src/types";
import {
  analyzeNewEvaluationDimensions,
  buildNewDimensionPreview,
  collectEvaluationLineageDimensions,
  getEvaluationRootId,
} from "../../src/lib/newDimensionEvaluation";
import { createDefinitionBasedRubric } from "../../src/lib/evaluationRubric";

describe("new dimension evaluation", () => {
  it("rejects normalized duplicates from the source lineage and current selection", () => {
    const result = analyzeNewEvaluationDimensions(
      [
        { name: "  Accuracy  " },
        { name: "Style quality", desc: "  Natural writing  " },
        { name: "style   QUALITY" },
      ],
      [{ name: "accuracy" }]
    );

    expect(result.dimensions).toEqual([
      { name: "Style quality", desc: "Natural writing" },
    ]);
    expect(result.duplicateNames).toEqual(["Accuracy", "style QUALITY"]);
  });

  it("collects unique dimensions across one root evaluation lineage", () => {
    const root = evaluationRecord("eval-root", undefined, [
      { name: "准确性" },
    ]);
    const child = evaluationRecord("eval-child", "eval-root", [
      { name: "风格自然度" },
    ]);
    const sibling = evaluationRecord("eval-sibling", "eval-root", [
      { name: "准确性" },
      { name: "格式合规" },
    ]);

    expect(getEvaluationRootId(child)).toBe("eval-root");
    expect(
      collectEvaluationLineageDimensions([root, child, sibling], child).map(
        (dimension) => dimension.name
      )
    ).toEqual(["准确性", "风格自然度", "格式合规"]);
  });

  it("keeps legacy records readable and preserves structured Rubrics", () => {
    const structured = createDefinitionBasedRubric("事实准确性", "事实必须正确");
    const dimensions = collectEvaluationLineageDimensions(
      [
        evaluationRecord("legacy", undefined, [
          { name: "旧维度", desc: "历史记录只有名称和说明" },
        ]),
        evaluationRecord("structured", "legacy", [structured]),
      ],
      evaluationRecord("structured", "legacy", [structured])
    );

    expect(dimensions).toEqual([
      { name: "旧维度", desc: "历史记录只有名称和说明" },
      structured,
    ]);
  });

  it("previews only source inputs with reusable outputs and required answers", () => {
    const inputs: TaskInput[] = [
      {
        id: "input-a",
        prompt: "A",
        images: [],
        extraFields: { expected_output: "gold A" },
      },
      { id: "input-b", prompt: "B", images: [] },
      {
        id: "input-c",
        prompt: "C",
        images: [],
        extraFields: { expected_output: "gold C" },
      },
      { id: "input-outside", prompt: "D", images: [] },
    ];
    const results: ResultRow[] = [
      {
        inputId: "input-a",
        items: [
          { targetId: "a", targetName: "A", status: "success" },
          { targetId: "b", targetName: "B", status: "success" },
        ],
      },
      {
        inputId: "input-b",
        items: [{ targetId: "a", targetName: "A", status: "success" }],
      },
      {
        inputId: "input-c",
        items: [{ targetId: "a", targetName: "A", status: "error" }],
      },
      {
        inputId: "input-outside",
        items: [{ targetId: "a", targetName: "A", status: "success" }],
      },
    ];

    expect(
      buildNewDimensionPreview({
        inputs,
        results,
        sourceInputIds: ["input-a", "input-b", "input-c"],
        evaluationMode: "reference",
        expectedAnswerKey: "expected_output",
      })
    ).toEqual({
      inputIds: ["input-a"],
      judgeCallCount: 1,
      reusedOutputCount: 2,
      skippedMissingExpectedCount: 1,
    });
  });
});

function evaluationRecord(
  id: string,
  sourceEvaluationId: string | undefined,
  dimensions: EvalDimension[]
): EvaluationRecord {
  return {
    id,
    sourceTaskId: "task-a",
    evaluationKind: sourceEvaluationId ? "new_dimensions" : "full",
    sourceEvaluationId,
    createTime: 1,
    evalModelId: "judge-a",
    userRequirement: "test",
    dimensions,
    evalPrompt: "judge",
    scope: "all",
    count: 1,
    status: "done",
    results: [],
  };
}
