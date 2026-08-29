export interface StartRateLimiter {
  /** Returns false when cancellation happens before a request may start. */
  wait(signal?: AbortSignal): Promise<boolean>;
}

/**
 * Smooth global start-rate limiter. Concurrent workers share one reservation
 * queue, so retries and first attempts follow the same QPS ceiling.
 */
export function createStartRateLimiter(qps: number): StartRateLimiter {
  if (!Number.isFinite(qps) || qps <= 0) {
    return {
      wait: async (signal) => !signal?.aborted,
    };
  }

  const intervalMs = 1_000 / qps;
  let nextStartAt = 0;
  let queue = Promise.resolve();

  return {
    wait(signal) {
      const reservation = queue.then(async () => {
        if (signal?.aborted) return false;
        const ready = await waitForDelay(
          Math.max(0, nextStartAt - Date.now()),
          signal
        );
        if (!ready || signal?.aborted) return false;
        const startedAt = Date.now();
        nextStartAt = Math.max(startedAt, nextStartAt) + intervalMs;
        return true;
      });
      queue = reservation.then(
        () => undefined,
        () => undefined
      );
      return reservation;
    },
  };
}

/** Abort-aware delay used by both rate limiting and retry backoff. */
export function waitForDelay(
  delayMs: number,
  signal?: AbortSignal
): Promise<boolean> {
  if (signal?.aborted) return Promise.resolve(false);
  if (delayMs <= 0) return Promise.resolve(true);

  return new Promise((resolve) => {
    let settled = false;
    const finish = (ready: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      signal?.removeEventListener("abort", onAbort);
      resolve(ready);
    };
    const onAbort = () => finish(false);
    const timeoutId = setTimeout(() => finish(true), delayMs);
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}
