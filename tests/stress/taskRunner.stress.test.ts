import { describe, expect, it } from "vitest";

import { runWithPool } from "../../src/lib/taskRunner";

const delay = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

describe("runWithPool stress", () => {
  it("finishes 2,000 tasks without exceeding the worker limit or leaking work", async () => {
    const totalTasks = 2_000;
    const concurrency = 10;
    let active = 0;
    let peakActive = 0;
    let completed = 0;

    const outcomes = await runWithPool({
      items: Array.from({ length: totalTasks }, (_, index) => index),
      concurrency,
      runOne: async (item) => {
        active += 1;
        peakActive = Math.max(peakActive, active);
        await delay(1);
        active -= 1;
        completed += 1;
        return item;
      },
    });

    expect(peakActive).toBe(concurrency);
    expect(active).toBe(0);
    expect(completed).toBe(totalTasks);
    expect(outcomes).toHaveLength(totalTasks);
    expect(outcomes.every((outcome) => outcome.status === "fulfilled")).toBe(true);
  });

  it("keeps completed results while rejecting active and skipping queued work", async () => {
    const totalTasks = 1_000;
    const controller = new AbortController();

    const poolPromise = runWithPool({
      items: Array.from({ length: totalTasks }, (_, index) => index),
      concurrency: 10,
      signal: controller.signal,
      runOne: async (item, signal) => {
        await delay(3);
        if (signal.aborted) {
          throw new Error("aborted-by-signal");
        }
        return item;
      },
    });

    await delay(12);
    controller.abort();
    const outcomes = await poolPromise;
    const statuses = outcomes.map((outcome) => outcome.status);

    expect(statuses).not.toContain(undefined);
    expect(statuses).toContain("fulfilled");
    expect(statuses).toContain("rejected");
    expect(statuses).toContain("skipped");
    expect(statuses).toHaveLength(totalTasks);
  });
});
