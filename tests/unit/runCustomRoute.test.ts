import { beforeEach, describe, expect, it, vi } from "vitest";

import { RunError } from "../../src/lib/runError";

const mocks = vi.hoisted(() => ({
  runTarget: vi.fn(),
}));

vi.mock("@/adapters/registry", () => ({
  runTarget: mocks.runTarget,
}));

import { POST } from "../../src/app/api/run-custom/route";

const target = {
  id: "target-a",
  name: "Target A",
  type: "custom" as const,
  contentKind: "text" as const,
  source: "manual" as const,
  status: "tested_ok" as const,
  inputParams: [],
};

function createRequest(body: unknown) {
  return new Request("http://localhost:3000/api/run-custom", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  mocks.runTarget.mockReset();
});

describe("POST /api/run-custom", () => {
  it("returns a normalized success payload", async () => {
    mocks.runTarget.mockResolvedValue({
      outputText: "ok",
      outputImages: [],
      latencyMs: 12,
    });

    const response = await POST(
      createRequest({ target, prompt: "hello", timeoutMs: 1_000 })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      outputText: "ok",
      outputImages: [],
      latencyMs: 12,
    });
    expect(mocks.runTarget).toHaveBeenCalledWith(
      target,
      expect.objectContaining({ prompt: "hello", signal: expect.any(AbortSignal) })
    );
  });

  it("preserves a retryable upstream failure as structured API data", async () => {
    mocks.runTarget.mockRejectedValue(
      new RunError("请求过快", {
        type: "rate_limit",
        httpStatus: 429,
      })
    );

    const response = await POST(createRequest({ target, prompt: "hello" }));
    const body = await response.json();

    expect(response.status).toBe(429);
    expect(body).toEqual({
      error: "请求过快",
      errorType: "rate_limit",
      retryable: true,
      httpStatus: 429,
    });
  });

  it("classifies missing API key configuration as non-retryable auth", async () => {
    mocks.runTarget.mockRejectedValue(
      new Error("缺少环境变量 TEST_API_KEY，请配置 API Key")
    );

    const response = await POST(createRequest({ target, prompt: "hello" }));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toMatchObject({ errorType: "auth", retryable: false });
  });

  it("rejects invalid input without dispatching a target", async () => {
    const response = await POST(createRequest({ prompt: "hello" }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      errorType: "client",
      retryable: false,
    });
    expect(mocks.runTarget).not.toHaveBeenCalled();
  });
});
