import { afterEach, describe, expect, it, vi } from "vitest";
import type { ResultRow, TargetConfig, TaskInput } from "../../src/types";
import { runTargets } from "../../src/services/runService";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

const input: TaskInput = { id: "input-a", prompt: "A", images: [] };
const target: TargetConfig = {
  id: "target-a",
  name: "Target A",
  type: "custom",
  contentKind: "text",
  source: "manual",
  status: "tested_ok",
  inputParams: [],
};

function runSingle(
  overrides: Partial<Parameters<typeof runTargets>[0]> = {}
) {
  return runTargets({
    inputs: [input],
    targetIds: [target.id],
    targetConfigs: [target],
    concurrency: 1,
    runPolicy: { qps: 0, timeoutMs: 1_000, retryLimit: 1 },
    retryBaseDelayMs: 0,
    ...overrides,
  });
}

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
      runPolicy: { qps: 0, timeoutMs: 1_000, retryLimit: 0 },
      existingResults: checkpoint,
    });

    expect(calls).toHaveLength(2);
    expect(calls).not.toContainEqual({ prompt: "A", targetId: "target-a" });
    expect(calls).not.toContainEqual({ prompt: "A", targetId: "target-b" });
    expect(results[0].items[0].outputText).toBe("from checkpoint");
    expect(results[0].items[1].error).toBe("kept error");
    expect(results[1].items.every((item) => item.status === "success")).toBe(true);
  });

  it("calls only the exact pairs in a sparse rerun plan", async () => {
    const inputs: TaskInput[] = [
      { id: "input-a", prompt: "A", images: [] },
      { id: "input-b", prompt: "B", images: [] },
    ];
    const targets: TargetConfig[] = [
      target,
      { ...target, id: "target-b", name: "Target B" },
    ];
    const calls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body)) as {
          prompt: string;
          target: { id: string };
        };
        calls.push(`${body.prompt}:${body.target.id}`);
        return new Response(JSON.stringify({ outputText: "ok" }), {
          status: 200,
        });
      })
    );

    const results = await runTargets({
      inputs,
      targetIds: ["target-a", "target-b"],
      targetConfigs: targets,
      concurrency: 2,
      runPolicy: { qps: 0, timeoutMs: 1_000, retryLimit: 0 },
      runPairs: [
        { inputId: "input-a", targetId: "target-b" },
        { inputId: "input-b", targetId: "target-a" },
      ],
    });

    expect(calls).toEqual(["A:target-b", "B:target-a"]);
    expect(results).toHaveLength(2);
    expect(results.flatMap((row) => row.items)).toHaveLength(2);
  });

  it("resumes only an unfinished pair from a sparse rerun checkpoint", async () => {
    const inputs: TaskInput[] = [
      { id: "input-a", prompt: "A", images: [] },
      { id: "input-b", prompt: "B", images: [] },
    ];
    const targets: TargetConfig[] = [
      target,
      { ...target, id: "target-b", name: "Target B" },
    ];
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ outputText: "resumed" }), { status: 200 })
    );
    vi.stubGlobal("fetch", fetchMock);

    const results = await runTargets({
      inputs,
      targetIds: ["target-a", "target-b"],
      targetConfigs: targets,
      concurrency: 2,
      runPolicy: { qps: 0, timeoutMs: 1_000, retryLimit: 0 },
      runPairs: [
        { inputId: "input-a", targetId: "target-b" },
        { inputId: "input-b", targetId: "target-a" },
      ],
      existingResults: [
        {
          inputId: "input-a",
          items: [
            {
              targetId: "target-b",
              targetName: "Target B",
              status: "success",
              outputText: "checkpoint",
            },
          ],
        },
      ],
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(results[0].items[0].outputText).toBe("checkpoint");
    expect(results[1].items[0].outputText).toBe("resumed");
  });

  it("rejects a sparse plan that references an unknown Case", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      runSingle({
        runPairs: [{ inputId: "unknown", targetId: "target-a" }],
      })
    ).rejects.toThrow("定向重跑计划包含不属于当前任务的 Case 或目标");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("runTargets policy and failure classification", () => {
  it("applies one global QPS schedule across concurrent Case x target calls", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const starts: number[] = [];
    const fetchMock = vi.fn(async () => {
      starts.push(Date.now());
      return new Response(
        JSON.stringify({ outputText: "ok", outputImages: [], latencyMs: 1 }),
        { status: 200 }
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const resultPromise = runSingle({
      inputs: [
        input,
        { ...input, id: "input-b", prompt: "B" },
        { ...input, id: "input-c", prompt: "C" },
      ],
      concurrency: 3,
      runPolicy: { qps: 2, timeoutMs: 1_000, retryLimit: 0 },
    });
    await vi.runAllTimersAsync();
    const results = await resultPromise;

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(starts).toEqual([0, 500, 1_000]);
    expect(results.flatMap((row) => row.items).every((item) => item.status === "success"))
      .toBe(true);
  });

  it("retries a rate-limited request and records the successful attempt count", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            error: "请求过快",
            errorType: "rate_limit",
            retryable: true,
            httpStatus: 429,
          }),
          { status: 429 }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ outputText: "ok", outputImages: [], latencyMs: 1 }),
          { status: 200 }
        )
      );
    vi.stubGlobal("fetch", fetchMock);

    const results = await runSingle();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(results[0].items[0]).toMatchObject({
      status: "success",
      outputText: "ok",
      attemptCount: 2,
    });
  });

  it("does not retry authentication failures", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          error: "Key 无效",
          errorType: "auth",
          retryable: false,
          httpStatus: 401,
        }),
        { status: 401 }
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    const results = await runSingle({
      runPolicy: { qps: 0, timeoutMs: 1_000, retryLimit: 3 },
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(results[0].items[0]).toMatchObject({
      status: "error",
      errorType: "auth",
      attemptCount: 1,
      httpStatus: 401,
    });
  });

  it("does not retry a malformed successful response", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response("not-json", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const results = await runSingle({
      runPolicy: { qps: 0, timeoutMs: 1_000, retryLimit: 3 },
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(results[0].items[0]).toMatchObject({
      status: "error",
      errorType: "parse",
      attemptCount: 1,
    });
  });

  it("stops after the finite retry limit for transient server failures", async () => {
    const fetchMock = vi
      .fn()
      .mockImplementation(async () =>
        new Response("service unavailable", { status: 503 })
      );
    vi.stubGlobal("fetch", fetchMock);

    const results = await runSingle({
      runPolicy: { qps: 0, timeoutMs: 1_000, retryLimit: 2 },
    });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(results[0].items[0]).toMatchObject({
      status: "error",
      errorType: "server",
      attemptCount: 3,
      httpStatus: 503,
    });
  });

  it("aborts each timed-out attempt and stops at the retry limit", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn(
      (_url: string, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          const signal = init?.signal;
          const rejectAbort = () =>
            reject(signal?.reason ?? new DOMException("Aborted", "AbortError"));
          if (signal?.aborted) {
            rejectAbort();
          } else {
            signal?.addEventListener("abort", rejectAbort, { once: true });
          }
        })
    );
    vi.stubGlobal("fetch", fetchMock);

    const resultPromise = runSingle();
    await vi.runAllTimersAsync();
    const results = await resultPromise;

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(results[0].items[0]).toMatchObject({
      status: "error",
      errorType: "timeout",
      attemptCount: 2,
    });
  });
});
