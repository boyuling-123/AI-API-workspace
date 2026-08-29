import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  generateDimensions: vi.fn(),
}));

vi.mock("@/services/genDimensionsService", () => ({
  generateDimensions: mocks.generateDimensions,
}));

import { POST } from "../../src/app/api/gen-dimensions/route";

function createRequest(body: unknown) {
  return new Request("http://localhost:3000/api/gen-dimensions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const validRequest = {
  objective: "判断回答是否准确",
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

beforeEach(() => {
  mocks.generateDimensions.mockReset();
});

describe("POST /api/gen-dimensions", () => {
  it("dispatches only a validated structured request", async () => {
    mocks.generateDimensions.mockResolvedValue([
      { name: "准确性", desc: "是否准确解决问题" },
    ]);

    const response = await POST(
      createRequest({ request: validRequest, modelId: " qwen3.6-plus " })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      dimensions: [{ name: "准确性", desc: "是否准确解决问题" }],
    });
    expect(mocks.generateDimensions).toHaveBeenCalledWith(
      validRequest,
      "qwen3.6-plus"
    );
  });

  it.each([
    { body: null, error: "请求体必须是对象" },
    { body: {}, error: "缺少生成模型 modelId" },
    {
      body: { modelId: "judge", request: { ...validRequest, samples: [] } },
      error: "请至少选择 1 条代表性样本",
    },
    {
      body: {
        modelId: "judge",
        request: { ...validRequest, businessScenario: "" },
      },
      error: "业务场景不能为空",
    },
  ])("rejects invalid input without a model call", async ({ body, error }) => {
    const response = await POST(createRequest(body));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error });
    expect(mocks.generateDimensions).not.toHaveBeenCalled();
  });
});
