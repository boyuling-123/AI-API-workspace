import { RUNTIME_CONFIG } from "@/config/runtime";
import type { RunPolicy } from "@/types";

export const DEFAULT_RUN_POLICY: RunPolicy = {
  qps: RUNTIME_CONFIG.defaultQps,
  timeoutMs: RUNTIME_CONFIG.defaultRunTimeoutMs,
  retryLimit: RUNTIME_CONFIG.defaultRunRetryLimit,
};

/** Normalizes UI values, imported projects, and old tasks into a safe policy. */
export function normalizeRunPolicy(
  policy?: Partial<RunPolicy> | null
): RunPolicy {
  const rawQps = Number(policy?.qps ?? DEFAULT_RUN_POLICY.qps);
  const qps = !Number.isFinite(rawQps)
    ? DEFAULT_RUN_POLICY.qps
    : rawQps <= 0
      ? 0
      : clamp(rawQps, 1, RUNTIME_CONFIG.maxQps);

  const rawTimeout = Number(
    policy?.timeoutMs ?? DEFAULT_RUN_POLICY.timeoutMs
  );
  const timeoutMs = Number.isFinite(rawTimeout)
    ? clamp(
        Math.floor(rawTimeout),
        RUNTIME_CONFIG.minRunTimeoutMs,
        RUNTIME_CONFIG.maxRunTimeoutMs
      )
    : DEFAULT_RUN_POLICY.timeoutMs;

  const rawRetryLimit = Number(
    policy?.retryLimit ?? DEFAULT_RUN_POLICY.retryLimit
  );
  const retryLimit = Number.isFinite(rawRetryLimit)
    ? clamp(
        Math.floor(rawRetryLimit),
        0,
        RUNTIME_CONFIG.maxRunRetryLimit
      )
    : DEFAULT_RUN_POLICY.retryLimit;

  return { qps, timeoutMs, retryLimit };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
