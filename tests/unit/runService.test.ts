import { afterEach, describe, expect, it, vi } from "vitest";
import type { ResultRow, TargetConfig, TaskInput } from "../../src/types";
import { runTargets } from "../../src/services/runService";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("runTargets checkpoint resume", () => {
  it("does not call terminal Case x target pairs again", async () => {
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
        contentKind: "text",
        source: "manual",
        status: "tested_ok",
        inputParams: [],
      },
    ];
    const checkpoint: ResultRow[] = [
      {
        inputId: "input-a",
        items: [
          {
            targetId: "target-a",
            targetName: "Target A",
            status: "success",
            outputText: "from checkpoint",
          },
          {
            targetId: "target-b",
            targetName: "Target B",
            status: "error",
            error: "kept error",
          },
        ],
      },
    ];
    const calls: Array<{ prompt: string; targetId: string }> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body)) as {
          prompt: string;
          target: { id: string };
        };
        calls.push({ prompt: body.prompt, targetId: body.target.id });
        return new Response(
          JSON.stringify({
            outputText: `${body.prompt}:${body.target.id}`,
            outputImages: [],
            latencyMs: 1,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      })
    );

    const results = await runTargets({
      inputs,
      targetIds: ["target-a", "target-b"],
      targetConfigs: targets,
      concurrency: 2,
      existingResults: checkpoint,
    });

    expect(calls).toHaveLength(2);
    expect(calls).not.toContainEqual({ prompt: "A", targetId: "target-a" });
    expect(calls).not.toContainEqual({ prompt: "A", targetId: "target-b" });
    expect(results[0].items[0].outputText).toBe("from checkpoint");
    expect(results[0].items[1].error).toBe("kept error");
    expect(results[1].items.every((item) => item.status === "success")).toBe(true);
  });
});
