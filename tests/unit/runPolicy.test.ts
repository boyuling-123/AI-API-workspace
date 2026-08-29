import { describe, expect, it } from "vitest";

import { RUNTIME_CONFIG } from "../../src/config/runtime";
import {
  DEFAULT_RUN_POLICY,
  normalizeRunPolicy,
} from "../../src/lib/runPolicy";

describe("normalizeRunPolicy", () => {
  it("supplies safe defaults for old tasks without a policy", () => {
    expect(normalizeRunPolicy()).toEqual(DEFAULT_RUN_POLICY);
  });

  it("keeps zero as unlimited QPS and clamps unsafe imported values", () => {
    expect(
      normalizeRunPolicy({ qps: 0, timeoutMs: 1, retryLimit: 999 })
    ).toEqual({
      qps: 0,
      timeoutMs: RUNTIME_CONFIG.minRunTimeoutMs,
      retryLimit: RUNTIME_CONFIG.maxRunRetryLimit,
    });
    expect(
      normalizeRunPolicy({
        qps: 999,
        timeoutMs: Number.POSITIVE_INFINITY,
        retryLimit: -5,
      })
    ).toEqual({
      qps: RUNTIME_CONFIG.maxQps,
      timeoutMs: DEFAULT_RUN_POLICY.timeoutMs,
      retryLimit: 0,
    });
  });
});
