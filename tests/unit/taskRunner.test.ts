import { describe, expect, it } from "vitest";

import { runWithPool } from "../../src/lib/taskRunner";

const delay = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

describe("runWithPool", () => {
  it("enforces the configured concurrency limit and preserves result order", async () => {
    let active = 0;
    let peakActive = 0;
    const items = Array.from({ length: 20 }, (_, index) => index);

    const outcomes = await runWithPool({
      items,
      concurrency: 3,
      runOne: async (item) => {
        active += 1;
        peakActive = Math.max(peakActive, active);
        await delay(5);
        active -= 1;
        return item * 2;
      },
    });

    expect(peakActive).toBe(3);
    expect(outcomes.map((outcome) => outcome.status)).toEqual(
      Array(items.length).fill("fulfilled")
    );
    expect(outcomes.map((outcome) => outcome.result)).toEqual(
      items.map((item) => item * 2)
    );
  });

  it.each([0, -3, Number.NaN])(
    "normalizes invalid concurrency %s to a usable worker count",
    async (concurrency) => {
      const outcomes = await runWithPool({
        items: [1, 2, 3],
        concurrency,
        runOne: async (item) => item,
      });

      expect(outcomes).toEqual([
        { status: "fulfilled", result: 1 },
        { status: "fulfilled", result: 2 },
        { status: "fulfilled", result: 3 },
      ]);
    }
  );

  it("isolates a rejected task and continues the remaining work", async () => {
    const failure = new Error("expected failure");
    const outcomes = await runWithPool({
      items: [1, 2, 3],
      concurrency: 2,
      runOne: async (item) => {
        if (item === 2) {
          throw failure;
        }
        return item * 10;
      },
    });

    expect(outcomes[0]).toEqual({ status: "fulfilled", result: 10 });
    expect(outcomes[1]).toEqual({ status: "rejected", error: failure });
    expect(outcomes[2]).toEqual({ status: "fulfilled", result: 30 });
  });

  it("reports progress only for fulfilled tasks with the original index", async () => {
    const progress: Array<{ result: number; item: number; index: number }> = [];

    const outcomes = await runWithPool({
      items: [2, 4, 6],
      concurrency: 1,
      runOne: async (item) => {
        if (item === 4) {
          throw new Error("skip progress");
        }
        return item + 1;
      },
      onProgress: (result, item, index) => {
        progress.push({ result, item, index });
      },
    });

    expect(progress).toEqual([
      { result: 3, item: 2, index: 0 },
      { result: 7, item: 6, index: 2 },
    ]);
    expect(outcomes.map((outcome) => outcome.status)).toEqual([
      "fulfilled",
      "rejected",
      "fulfilled",
    ]);
  });

  it("rejects active work and skips queued items after cancellation", async () => {
    const controller = new AbortController();
    let started = 0;

    const poolPromise = runWithPool({
      items: Array.from({ length: 8 }, (_, index) => index),
      concurrency: 2,
      signal: controller.signal,
      runOne: (_item, signal) =>
        new Promise<number>((_resolve, reject) => {
          started += 1;
          signal.addEventListener(
            "abort",
            () => reject(new Error("aborted")),
            { once: true }
          );
        }),
    });

    while (started < 2) {
      await delay(1);
    }
    controller.abort();

    const outcomes = await poolPromise;
    expect(outcomes.slice(0, 2).map((outcome) => outcome.status)).toEqual([
      "rejected",
      "rejected",
    ]);
    expect(outcomes.slice(2).every((outcome) => outcome.status === "skipped")).toBe(
      true
    );
    expect(outcomes).not.toContain(undefined);
  });

  it("returns an empty result without invoking runOne for an empty list", async () => {
    let called = false;
    const outcomes = await runWithPool({
      items: [],
      concurrency: 3,
      runOne: async () => {
        called = true;
        return "unused";
      },
    });

    expect(outcomes).toEqual([]);
    expect(called).toBe(false);
  });
});
