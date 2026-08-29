import { describe, expect, it } from "vitest";
import type { TargetConfig, Task } from "../../src/types";
import {
  buildFailedRerunPlan,
  buildHistoricalResultSeed,
  buildNewTargetsRerunPlan,
  buildSelectedCasesRerunPlan,
  getCompatibleNewTargets,
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

  it("builds a stable sparse plan for selected new targets", () => {
    const preview = buildNewTargetsRerunPlan(
      sourceTask,
      ["input-c", "input-a", "unknown"],
      ["target-new-b", "target-new-a", "target-new-b"],
      ["target-new-a", "target-new-b"]
    );

    expect(preview.rerun).toEqual({
      sourceTaskId: "source-task",
      scope: "new_targets",
      pairs: [
        { inputId: "input-a", targetId: "target-new-b" },
        { inputId: "input-a", targetId: "target-new-a" },
        { inputId: "input-c", targetId: "target-new-b" },
        { inputId: "input-c", targetId: "target-new-a" },
      ],
      selectedInputIds: ["input-a", "input-c"],
    });
    expect(preview.targetIds).toEqual(["target-new-b", "target-new-a"]);
    expect(preview.reusedPairCount).toBe(2);
  });

  it("filters new targets by readiness, source membership, mode, and image input", () => {
    const targets: TargetConfig[] = [
      targetConfig("target-a", "text", "tested_ok"),
      targetConfig("new-text", "text", "tested_ok"),
      targetConfig("new-multimodal", "multimodal", "tested_ok"),
      targetConfig("new-image", "image", "tested_ok"),
      targetConfig("new-unverified", "multimodal", "unverified"),
    ];

    expect(getCompatibleNewTargets(sourceTask, targets).map((item) => item.id))
      .toEqual(["new-text", "new-multimodal"]);

    const taskWithImages: Task = {
      ...sourceTask,
      inputs: sourceTask.inputs.map((input, index) =>
        index === 0
          ? {
              ...input,
              images: [
                { id: "image-a", name: "a.png", source: "url", value: "https://example.com/a.png" },
              ],
            }
          : input
      ),
    };
    expect(
      getCompatibleNewTargets(taskWithImages, targets).map((item) => item.id)
    ).toEqual(["new-multimodal"]);
  });

  it("copies only terminal selected results and marks their source task", () => {
    const seed = buildHistoricalResultSeed(sourceTask, ["input-b"]);

    expect(seed).toHaveLength(1);
    expect(seed[0].inputId).toBe("input-b");
    expect(seed[0].items).toHaveLength(2);
    expect(
      seed[0].items.every((item) => item.reusedFromTaskId === "source-task")
    ).toBe(true);
  });
});

function targetConfig(
  id: string,
  contentKind: TargetConfig["contentKind"],
  status: TargetConfig["status"]
): TargetConfig {
  return {
    id,
    name: id,
    type: "custom",
    contentKind,
    source: "manual",
    status,
    inputParams: [],
  };
}
