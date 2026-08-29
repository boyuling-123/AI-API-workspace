import { afterEach, describe, expect, it, vi } from "vitest";

import { createStartRateLimiter } from "../../src/lib/rateLimiter";

afterEach(() => {
  vi.useRealTimers();
});

describe("createStartRateLimiter", () => {
  it("spaces all concurrent reservations by the configured global QPS", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const limiter = createStartRateLimiter(2);

    await expect(limiter.wait()).resolves.toBe(true);
    let secondStarted = false;
    const second = limiter.wait().then((ready) => {
      secondStarted = ready;
      return ready;
    });

    await vi.advanceTimersByTimeAsync(499);
    expect(secondStarted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await expect(second).resolves.toBe(true);
  });

  it("allows unlimited starts when QPS is zero", async () => {
    const limiter = createStartRateLimiter(0);
    await expect(
      Promise.all(Array.from({ length: 20 }, () => limiter.wait()))
    ).resolves.toEqual(Array(20).fill(true));
  });

  it("cancels a queued reservation without waiting for its timer", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const limiter = createStartRateLimiter(1);
    const controller = new AbortController();

    await expect(limiter.wait(controller.signal)).resolves.toBe(true);
    const queued = limiter.wait(controller.signal);
    await Promise.resolve();
    controller.abort();

    await expect(queued).resolves.toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });
});
