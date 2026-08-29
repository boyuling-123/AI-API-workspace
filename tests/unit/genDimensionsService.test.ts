import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DimensionGenerationRequest } from "../../src/lib/dimensionGeneration";
import { createDefinitionBasedRubric } from "../../src/lib/evaluationRubric";

const mocks = vi.hoisted(() => ({
  chatWithModel: vi.fn(),
}));

vi.mock("@/services/llmClient", () => ({
  chatWithModel: mocks.chatWithModel,
}));

import { generateDimensions } from "../../src/services/genDimensionsService";

beforeEach(() => {
  mocks.chatWithModel.mockReset();
});

describe("structured Simple Rubrics generation", () => {
  it("accepts only complete structured Rubrics from the model", async () => {
    const rubrics = [
      createDefinitionBasedRubric("准确性", "内容与事实和标准答案一致"),
      createDefinitionBasedRubric("完整性", "关键要求没有缺失"),
      createDefinitionBasedRubric("清晰度", "表达清晰且结构可理解"),
      createDefinitionBasedRubric("合规性", "内容符合业务硬规则"),
    ];
    mocks.chatWithModel.mockResolvedValue({
      outputText: JSON.stringify(rubrics),
      outputImages: [],
    });

    await expect(generateDimensions(validRequest(), "mock-judge")).resolves.toEqual(
      rubrics
    );
    expect(mocks.chatWithModel).toHaveBeenCalledTimes(1);
    expect(mocks.chatWithModel.mock.calls[0][0].prompt).toContain(
      "生成模式：Simple Rubrics"
    );
  });

  it("rejects legacy name-only model output instead of inventing rubric fields", async () => {
    mocks.chatWithModel.mockResolvedValue({
      outputText: JSON.stringify(
        Array.from({ length: 4 }, (_, index) => ({
          name: `维度 ${index + 1}`,
          desc: "只有一句说明",
        }))
      ),
      outputImages: [],
    });

    await expect(generateDimensions(validRequest(), "mock-judge")).rejects.toThrow(
      "评分分级必须完整包含 0、5、10 三个锚点"
    );
    expect(mocks.chatWithModel).toHaveBeenCalledTimes(1);
  });

  it("redacts malformed model output before including a diagnostic snippet", async () => {
    mocks.chatWithModel.mockResolvedValue({
      outputText: 'not-json token=placeholder-value',
      outputImages: [],
    });

    let message = "";
    try {
      await generateDimensions(validRequest(), "mock-judge");
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }
    expect(message).toContain("not-json token=[REDACTED]");
    expect(message).not.toContain("placeholder-value");
    expect(mocks.chatWithModel).toHaveBeenCalledTimes(1);
  });
});

function validRequest(): DimensionGenerationRequest {
  return {
    objective: "判断客服回答是否可上线",
    businessScenario: "售后客服",
    taskType: "text_generation",
    hardRules: [],
    samples: [
      {
        inputId: "input-a",
        prompt: "我要退款",
        inputImageCount: 0,
        outputs: [
          {
            targetId: "target-a",
            targetName: "Target A",
            status: "success",
            outputText: "请提供订单号",
            outputImageCount: 0,
          },
        ],
      },
    ],
  };
}
