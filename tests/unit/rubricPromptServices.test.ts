import { beforeEach, describe, expect, it, vi } from "vitest";
import { createDefinitionBasedRubric } from "../../src/lib/evaluationRubric";

const mocks = vi.hoisted(() => ({
  chatWithModel: vi.fn(),
}));

vi.mock("@/services/llmClient", () => ({
  chatWithModel: mocks.chatWithModel,
}));

import { generateEvalPrompt } from "../../src/services/evalPromptService";
import { evaluateOneInput } from "../../src/services/evaluateService";

const rubric = {
  ...createDefinitionBasedRubric("准确性", "内容必须正确"),
  weight: 100,
  vetoThreshold: 5,
};

beforeEach(() => {
  mocks.chatWithModel.mockReset();
});

describe("Rubric-aware Prompt services", () => {
  it("includes definitions, anchors, evidence, and instructions in Prompt generation", async () => {
    mocks.chatWithModel.mockResolvedValue({
      outputText: "生成后的 Judge Prompt",
      outputImages: [],
    });

    await expect(
      generateEvalPrompt("客服评测", "judge", [rubric], ["Target A"])
    ).resolves.toBe("生成后的 Judge Prompt");
    const prompt = mocks.chatWithModel.mock.calls[0][0].prompt as string;
    expect(prompt).toContain("定义：内容必须正确");
    expect(prompt).toContain("0 分：");
    expect(prompt).toContain("5 分：");
    expect(prompt).toContain("10 分：");
    expect(prompt).toContain("证据要求：");
    expect(prompt).toContain("判断规则：");
    expect(prompt).toContain("权重：100%");
    expect(prompt).toContain("得分低于 5 分时触发");
    expect(prompt).toContain("先引用证据再评分");
  });

  it("includes the complete Rubric in the final Judge call", async () => {
    mocks.chatWithModel.mockResolvedValue({
      outputText: JSON.stringify({
        scores: [
          {
            targetId: "target-a",
            dimensionScores: [
              { dimension: "准确性", score: 4, comment: "存在错误" },
            ],
          },
        ],
        summary: "通过",
        recommendation: "Target A",
      }),
      outputImages: [],
    });

    const result = await evaluateOneInput(
      {
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
      },
      "严格评价",
      "judge",
      [rubric],
      "comparison"
    );

    const prompt = mocks.chatWithModel.mock.calls[0][0].prompt as string;
    expect(prompt).toContain("定义：内容必须正确");
    expect(prompt).toContain("证据要求：");
    expect(prompt).toContain("判断规则：");
    expect(prompt).toContain("权重：100%");
    expect(result.scores[0]).toMatchObject({
      weightedScore: 4,
      vetoed: true,
      vetoReasons: ["“准确性”得分 4.0，低于否决阈值 5"],
    });
  });
});
