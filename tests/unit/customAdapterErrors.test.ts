import { afterEach, describe, expect, it, vi } from "vitest";

import { runCustomTarget } from "../../src/adapters/customAdapter";
import type { TargetConfig } from "../../src/types";

afterEach(() => {
  vi.unstubAllGlobals();
});

const target: TargetConfig = {
  id: "http-target",
  name: "HTTP Target",
  type: "custom",
  contentKind: "text",
  source: "manual",
  status: "tested_ok",
  preset: true,
  inputParams: [],
  requestTemplate: {
    url: "https://example.test/run",
    method: "POST",
    headers: [],
    bodyTemplate: '{"prompt":"{{prompt}}"}',
    stream: false,
    outputTextPath: "result",
  },
};

describe("runCustomTarget failure normalization", () => {
  it("keeps an upstream HTTP category and retry decision", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ message: "slow down" }), { status: 429 })
      )
    );

    await expect(
      runCustomTarget({ target, prompt: "hello" })
    ).rejects.toMatchObject({
      type: "rate_limit",
      retryable: true,
      httpStatus: 429,
    });
  });

  it("marks malformed successful output as non-retryable parse failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("not-json", { status: 200 }))
    );

    await expect(
      runCustomTarget({ target, prompt: "hello" })
    ).rejects.toMatchObject({
      type: "parse",
      retryable: false,
      httpStatus: 200,
    });
  });
});
