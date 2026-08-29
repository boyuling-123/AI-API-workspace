import { describe, expect, it } from "vitest";
import type { ResultRow, TargetConfig, TaskInput } from "../../src/types";
import {
  createCheckpointRows,
  getRunProgress,
  replaceCheckpointItem,
} from "../../src/lib/batchCheckpoint";

const inputs: TaskInput[] = [
  { id: "input-a", prompt: "A", images: [] },
  { id: "input-b", prompt: "B", images: [] },
];

const targets: TargetConfig[] = [
  {
    id: "target-a",
    name: "Target A",
    type: "custom",
    contentKind: "text",
    source: "manual",
    status: "tested_ok",
    inputParams: [],
  },
  {
    id: "target-b",
    name: "Target B",
    type: "custom",
    contentKind: "multimodal",
    source: "manual",
    status: "tested_ok",
    inputParams: [],
  },
];

describe("batch checkpoint model", () => {
  it("creates a stable Case x target matrix", () => {
    const rows = createCheckpointRows(inputs, ["target-a", "target-b"], targets);

    expect(rows).toHaveLength(2);
    expect(rows[0].items.map((item) => item.targetId)).toEqual([
      "target-a",
      "target-b",
    ]);
    expect(rows.flatMap((row) => row.items).every((item) => item.status === "pending"))
      .toBe(true);
  });

  it("creates only the requested sparse Case x target pairs", () => {
    const rows = createCheckpointRows(
      inputs,
      ["target-a", "target-b"],
      targets,
      [],
      [
        { inputId: "input-a", targetId: "target-b" },
        { inputId: "input-b", targetId: "target-a" },
      ]
    );

    expect(rows).toEqual([
      {
        inputId: "input-a",
        items: [expect.objectContaining({ targetId: "target-b", status: "pending" })],
      },
      {
        inputId: "input-b",
        items: [expect.objectContaining({ targetId: "target-a", status: "pending" })],
      },
    ]);
    expect(getRunProgress(rows).totalCalls).toBe(2);
  });

  it("preserves a terminal sparse pair while leaving its unfinished pair pending", () => {
    const existing: ResultRow[] = [
      {
        inputId: "input-a",
        items: [
          {
            targetId: "target-b",
            targetName: "Target B",
            status: "success",
            outputText: "saved",
          },
        ],
      },
    ];
    const rows = createCheckpointRows(
      inputs,
      ["target-a", "target-b"],
      targets,
      existing,
      [
        { inputId: "input-a", targetId: "target-b" },
        { inputId: "input-b", targetId: "target-a" },
      ]
    );

    expect(rows[0].items[0]).toMatchObject({
      targetId: "target-b",
      status: "success",
      outputText: "saved",
    });
    expect(rows[1].items[0]).toMatchObject({
      targetId: "target-a",
      status: "pending",
    });
    expect(getRunProgress(rows)).toMatchObject({
      completedCalls: 1,
      totalCalls: 2,
      remainingCalls: 1,
    });
  });

  it("preserves terminal results and resets interrupted work to pending", () => {
    const existing: ResultRow[] = [
      {
        inputId: "input-a",
        items: [
          {
            targetId: "target-a",
            targetName: "Target A",
            status: "success",
            outputText: "kept",
          },
          {
            targetId: "target-b",
            targetName: "Target B",
            status: "interrupted",
          },
        ],
      },
    ];

    const rows = createCheckpointRows(
      inputs,
      ["target-a", "target-b"],
      targets,
      existing
    );

    expect(rows[0].items[0].outputText).toBe("kept");
    expect(rows[0].items[1].status).toBe("pending");
  });

  it("replaces one result without disturbing other rows", () => {
    const rows = createCheckpointRows(inputs, ["target-a", "target-b"], targets);
    const next = replaceCheckpointItem(rows, "input-b", {
      targetId: "target-a",
      targetName: "Target A",
      status: "error",
      error: "expected",
    });

    expect(next[0]).toEqual(rows[0]);
    expect(next[1].items[0].status).toBe("error");
    expect(next[1].items[1].status).toBe("pending");
  });

  it("counts only success and error as completed calls", () => {
    const rows = createCheckpointRows(inputs, ["target-a", "target-b"], targets);
    const withSuccess = replaceCheckpointItem(rows, "input-a", {
      targetId: "target-a",
      targetName: "Target A",
      status: "success",
    });
    const withInterrupted = replaceCheckpointItem(withSuccess, "input-a", {
      targetId: "target-b",
      targetName: "Target B",
      status: "interrupted",
    });

    expect(getRunProgress(withInterrupted)).toEqual({
      completedCalls: 1,
      totalCalls: 4,
      remainingCalls: 3,
      percent: 25,
    });
  });
});
