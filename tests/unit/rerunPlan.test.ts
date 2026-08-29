import { describe, expect, it } from "vitest";
import type { Task } from "../../src/types";
import {
  buildFailedRerunPlan,
  buildSelectedCasesRerunPlan,
  parseCaseNumberExpression,
} from "../../src/lib/rerunPlan";

const sourceTask: Task = {
  id: "source-task",
  createTime: 1,
  finishTime: 2,
  contentMode: "text",
  runMode: "batch",
  inputs: [
    { id: "input-a", prompt: "A", images: [] },
    { id: "input-b", prompt: "B", images: [] },
    { id: "input-c", prompt: "C", images: [] },
  ],
  targetIds: ["target-a", "target-b"],
  concurrency: 2,
  runPolicy: { qps: 3, timeoutMs: 2_000, retryLimit: 1 },
  paramSnapshot: [],
  results: [
    {
      inputId: "input-a",
      items: [
        { targetId: "target-a", targetName: "A", status: "error" },
        { targetId: "target-b", targetName: "B", status: "success" },
      ],
    },
    {
      inputId: "input-b",
      items: [
        { targetId: "target-a", targetName: "A", status: "success" },
        { targetId: "target-b", targetName: "B", status: "error" },
      ],
    },
  ],
  status: "partial",
};

describe("parseCaseNumberExpression", () => {
  it("parses, de-duplicates, and sorts single indexes and ranges", () => {
    expect(parseCaseNumberExpression("3, 1-2，2", 5)).toEqual({
      caseNumbers: [1, 2, 3],
      errors: [],
    });
  });

  it("reports malformed, reversed, and out-of-range selections", () => {
    const result = parseCaseNumberExpression("0,4-2,x,8", 5);

    expect(result.caseNumbers).toEqual([]);
    expect(result.errors).toHaveLength(4);
  });
});

describe("rerun plan builders", () => {
  it("keeps only failed pairs whose target still exists", () => {
    const preview = buildFailedRerunPlan(sourceTask, ["target-a"]);

    expect(preview.rerun).toEqual({
      sourceTaskId: "source-task",
      scope: "failed",
      pairs: [{ inputId: "input-a", targetId: "target-a" }],
      selectedInputIds: ["input-a"],
    });
    expect(preview.unavailableTargetIds).toEqual(["target-b"]);
    expect(preview.unavailablePairCount).toBe(1);
  });

  it("expands selected cases only across currently available source targets", () => {
    const preview = buildSelectedCasesRerunPlan(
      sourceTask,
      ["input-c", "input-a", "unknown"],
      ["target-a", "target-b"]
    );

    expect(preview.inputIds).toEqual(["input-a", "input-c"]);
    expect(preview.targetIds).toEqual(["target-a", "target-b"]);
    expect(preview.rerun.pairs).toEqual([
      { inputId: "input-a", targetId: "target-a" },
      { inputId: "input-a", targetId: "target-b" },
      { inputId: "input-c", targetId: "target-a" },
      { inputId: "input-c", targetId: "target-b" },
    ]);
  });
});
