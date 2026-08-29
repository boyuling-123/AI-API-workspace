import { beforeEach, describe, expect, it, vi } from "vitest";
import { createDefinitionBasedRubric } from "../../src/lib/evaluationRubric";

const mocks = vi.hoisted(() => ({
  generateEvalPrompt: vi.fn(),
  evaluateOneInput: vi.fn(),
}));

vi.mock("@/services/evalPromptService", () => ({
  generateEvalPrompt: mocks.generateEvalPrompt,
}));
vi.mock("@/services/evaluateService", () => ({
  evaluateOneInput: mocks.evaluateOneInput,
}));

import { POST as generatePrompt } from "../../src/app/api/gen-eval-prompt/route";
import { POST as evaluate } from "../../src/app/api/evaluate/route";

const rubric = createDefinitionBasedRubric("准确性", "内容必须正确");

beforeEach(() => {
  mocks.generateEvalPrompt.mockReset();
  mocks.evaluateOneInput.mockReset();
});

describe("structured Rubric route boundaries", () => {
  it("blocks incomplete Rubrics before Prompt or Judge model calls", async () => {
    const legacyDimensions = [{ name: "准确性", desc: "内容必须正确" }];
    const promptResponse = await generatePrompt(
      request("/api/gen-eval-prompt", {
        scenario: "客服评测",
        modelId: "judge",
        dimensions: legacyDimensions,
      })
    );
    expect(promptResponse.status).toBe(400);
    await expect(promptResponse.json()).resolves.toEqual({
      error:
        "评价维度第 1 条：评分分级必须完整包含 0、5、10 三个锚点",
    });
    expect(mocks.generateEvalPrompt).not.toHaveBeenCalled();

    const evaluateResponse = await evaluate(
      request("/api/evaluate", {
        item: validItem(),
        evalPrompt: "严格评价",
        modelId: "judge",
        dimensions: legacyDimensions,
      })
    );
    expect(evaluateResponse.status).toBe(400);
    expect(mocks.evaluateOneInput).not.toHaveBeenCalled();
  });

  it("passes only canonical complete Rubrics to model services", async () => {
    mocks.generateEvalPrompt.mockResolvedValue("完整 Judge Prompt");
    mocks.evaluateOneInput.mockResolvedValue({
      inputId: "input-a",
      scores: [],
      summary: "完成",
      recommendation: "Target A",
    });

    const promptResponse = await generatePrompt(
      request("/api/gen-eval-prompt", {
        scenario: "客服评测",
        modelId: "judge",
        dimensions: [rubric],
        targetNames: ["Target A"],
      })
    );
    expect(promptResponse.status).toBe(200);
    expect(mocks.generateEvalPrompt).toHaveBeenCalledWith(
      "客服评测",
      "judge",
      [rubric],
      ["Target A"]
    );

    const evaluateResponse = await evaluate(
      request("/api/evaluate", {
        item: validItem(),
        evalPrompt: "严格评价",
        modelId: "judge",
        dimensions: [rubric],
        evaluationMode: "comparison",
      })
    );
    expect(evaluateResponse.status).toBe(200);
    expect(mocks.evaluateOneInput).toHaveBeenCalledWith(
      validItem(),
      "严格评价",
      "judge",
      [rubric],
      "comparison"
    );
  });
});

function request(path: string, body: unknown): Request {
  return new Request(`http://localhost:3000${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function validItem() {
  return {
    inputId: "input-a",
    prompt: "我要退款",
    targets: [
      {
        targetId: "target-a",
        targetName: "Target A",
        outputText: "请提供订单号",
        outputImageCount: 0,
      },
    ],
  };
}
