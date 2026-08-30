import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  chatWithModel: vi.fn(),
}));

vi.mock("@/services/llmClient", () => ({
  chatWithModel: mocks.chatWithModel,
}));

import { POST } from "@/app/api/judge-calibration/route";

beforeEach(() => {
  mocks.chatWithModel.mockReset();
});

describe("Judge calibration route", () => {
  it("returns 400 for invalid JSON or missing fields without calling Judge", async () => {
    const invalidJson = await POST(
      new Request("http://localhost:3000/api/judge-calibration", {
        method: "POST",
        body: "{broken",
      })
    );
    expect(invalidJson.status).toBe(400);

    const missing = await POST(
      request({ item: { caseId: "gold-001" }, modelId: "judge" })
    );
    expect(missing.status).toBe(400);
    await expect(missing.json()).resolves.toEqual({ error: "输入不能为空" });
    expect(mocks.chatWithModel).not.toHaveBeenCalled();
  });

  it("runs one sanitized Case and returns a strict binary judgment", async () => {
    mocks.chatWithModel.mockResolvedValue({
      outputText: JSON.stringify({
        label: "fail",
        confidence: 0.96,
        reason: "关键结论错误",
      }),
      outputImages: [],
    });

    const response = await POST(
      request({
        item: {
          caseId: "gold-001",
          prompt: "问题",
          candidateOutput: "错误答案",
          humanLabel: "pass",
          reviewerNote: "manual-truth-secret-99",
        },
        modelId: "judge-model",
        criteria: "事实错误必须判 fail",
      })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      caseId: "gold-001",
      judgeLabel: "fail",
      confidence: 0.96,
      reason: "关键结论错误",
    });
    const prompt = mocks.chatWithModel.mock.calls[0][0].prompt as string;
    expect(prompt).not.toContain("manual-truth-secret-99");
  });

  it("reports malformed Judge output as a server error", async () => {
    mocks.chatWithModel.mockResolvedValue({
      outputText: "not-json",
      outputImages: [],
    });

    const response = await POST(
      request({
        item: {
          caseId: "gold-001",
          prompt: "问题",
          candidateOutput: "答案",
        },
        modelId: "judge-model",
        criteria: "严格判断",
      })
    );
    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({
      error: expect.stringContaining("无法解析为 JSON"),
    });
  });
});

function request(body: unknown): Request {
  return new Request("http://localhost:3000/api/judge-calibration", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
