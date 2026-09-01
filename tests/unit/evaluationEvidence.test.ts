import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createDefinitionBasedRubric } from "../../src/lib/evaluationRubric";
import type { EvaluateInputItem } from "../../src/services/evaluateService";

const mocks = vi.hoisted(() => ({
  chatWithModel: vi.fn(),
}));

vi.mock("@/services/llmClient", () => ({
  chatWithModel: mocks.chatWithModel,
}));

import { evaluateOneInput } from "../../src/services/evaluateService";
import { runEvaluation } from "../../src/services/evaluateClient";
import { formatEvaluationEvidenceCell } from "../../src/services/excel";

const rubric = {
  ...createDefinitionBasedRubric("准确性", "输出必须与任务要求一致"),
  weight: 100,
};

const baseItem: EvaluateInputItem = {
  inputId: "input-1",
  prompt: "客户申请退款",
  targets: [
    {
      targetId: "target-a",
      targetName: "模型 A",
      outputText: "请提供订单号后处理退款",
      outputImageCount: 0,
    },
  ],
};

function judgeResponse(evidence: unknown[]) {
  return {
    outputText: JSON.stringify({
      scores: [
        {
          targetId: "target-a",
          dimensionScores: [
            {
              dimension: "准确性",
              score: 8,
              comment: "证据充分",
              evidence,
            },
          ],
        },
      ],
      summary: "总体可用",
      recommendation: "模型 A",
    }),
    outputImages: [],
  };
}

beforeEach(() => {
  mocks.chatWithModel.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("evaluation Judge evidence", () => {
  it("stores server-derived offsets for exact comparison quotes", async () => {
    mocks.chatWithModel.mockResolvedValue(
      judgeResponse([
        {
          kind: "text_quote",
          source: "input_prompt",
          quote: "申请退款",
        },
        {
          kind: "text_quote",
          source: "target_output",
          targetId: "target-a",
          quote: "订单号",
          start: 999,
          end: 1002,
        },
      ])
    );

    const result = await evaluateOneInput(
      baseItem,
      "严格判断",
      "judge",
      [rubric],
      "comparison"
    );

    expect(result.scores[0].dimensionScores[0].evidence).toEqual([
      {
        kind: "text_quote",
        source: "input_prompt",
        quote: "申请退款",
        start: 2,
        end: 6,
      },
      {
        kind: "text_quote",
        source: "target_output",
        targetId: "target-a",
        quote: "订单号",
        start: 3,
        end: 6,
      },
    ]);
    const prompt = mocks.chatWithModel.mock.calls[0][0].prompt as string;
    expect(prompt).toContain("平台会核验原文并自行计算位置");
    expect(prompt).toContain('targetId="target-a"');
  });

  it("requires both current output and expected-answer evidence in reference mode", async () => {
    const item = {
      ...baseItem,
      expectedOutput: "退款状态：待审核",
      expectedOutputKey: "gold_answer",
    };
    mocks.chatWithModel.mockResolvedValue(
      judgeResponse([
        {
          kind: "text_quote",
          source: "target_output",
          targetId: "target-a",
          quote: "处理退款",
        },
        {
          kind: "text_quote",
          source: "expected_answer",
          quote: "待审核",
        },
      ])
    );

    const result = await evaluateOneInput(
      item,
      "按标准答案判断",
      "judge",
      [rubric],
      "reference"
    );

    expect(result.scores[0].dimensionScores[0].evidence).toEqual([
      expect.objectContaining({ source: "target_output", start: 7, end: 11 }),
      expect.objectContaining({ source: "expected_answer", start: 5, end: 8 }),
    ]);
    expect(mocks.chatWithModel.mock.calls[0][0].prompt).toContain(
      "标准答案模式下，每个维度还必须至少引用一条 expected_answer 原文"
    );
  });

  it("validates image indexes and sends images in documented attachment order", async () => {
    const item: EvaluateInputItem = {
      ...baseItem,
      images: [
        { id: "input-image", name: "输入图", source: "url", value: "input-url" },
      ],
      targets: [
        {
          targetId: "target-a",
          targetName: "模型 A",
          outputImageCount: 1,
          outputImages: [
            {
              id: "target-image",
              name: "输出图",
              source: "url",
              value: "target-url",
            },
          ],
        },
      ],
    };
    mocks.chatWithModel.mockResolvedValue(
      judgeResponse([
        {
          kind: "image_observation",
          source: "input_image",
          imageIndex: 1,
          observation: "商品位于画面中央",
        },
        {
          kind: "image_observation",
          source: "target_image",
          targetId: "target-a",
          imageIndex: 1,
          observation: "背景已替换为纯白色",
        },
      ])
    );

    const result = await evaluateOneInput(
      item,
      "检查图片",
      "judge",
      [rubric]
    );

    expect(result.scores[0].dimensionScores[0].evidence).toHaveLength(2);
    expect(mocks.chatWithModel.mock.calls[0][0].images).toEqual([
      item.images?.[0],
      item.targets[0].outputImages?.[0],
    ]);
    const prompt = mocks.chatWithModel.mock.calls[0][0].prompt as string;
    expect(prompt).toContain("input_image imageIndex=1 对应请求附件 1");
    expect(prompt).toContain(
      'target_image targetId="target-a" imageIndex=1 对应请求附件 2'
    );
  });

  it.each([
    ["missing evidence", []],
    [
      "non-exact quote",
      [
        {
          kind: "text_quote",
          source: "target_output",
          targetId: "target-a",
          quote: "原文中不存在",
        },
      ],
    ],
    [
      "unknown target",
      [
        {
          kind: "text_quote",
          source: "target_output",
          targetId: "forged-target",
          quote: "伪造",
        },
      ],
    ],
    [
      "missing own output",
      [
        {
          kind: "text_quote",
          source: "input_prompt",
          quote: "申请退款",
        },
      ],
    ],
    [
      "expected answer in comparison mode",
      [
        {
          kind: "text_quote",
          source: "target_output",
          targetId: "target-a",
          quote: "订单号",
        },
        {
          kind: "text_quote",
          source: "expected_answer",
          quote: "答案",
        },
      ],
    ],
  ])("rejects %s", async (_name, evidence) => {
    mocks.chatWithModel.mockResolvedValue(judgeResponse(evidence));
    const item =
      _name === "expected answer in comparison mode"
        ? { ...baseItem, expectedOutput: "答案" }
        : baseItem;

    await expect(
      evaluateOneInput(item, "严格判断", "judge", [rubric], "comparison")
    ).rejects.toThrow();
  });

  it("rejects missing reference data and duplicate target IDs before a model call", async () => {
    await expect(
      evaluateOneInput(baseItem, "严格判断", "judge", [rubric], "reference")
    ).rejects.toThrow("缺少可引用的标准答案");

    await expect(
      evaluateOneInput(
        { ...baseItem, targets: [baseItem.targets[0], baseItem.targets[0]] },
        "严格判断",
        "judge",
        [rubric]
      )
    ).rejects.toThrow("重复的目标 ID");
    expect(mocks.chatWithModel).not.toHaveBeenCalled();
  });

  it("rejects scores for unknown targets", async () => {
    const response = judgeResponse([
      {
        kind: "text_quote",
        source: "target_output",
        targetId: "target-a",
        quote: "订单号",
      },
    ]);
    response.outputText = response.outputText.replace(
      '"targetId":"target-a"',
      '"targetId":"forged-target"'
    );
    mocks.chatWithModel.mockResolvedValue(response);

    await expect(
      evaluateOneInput(baseItem, "严格判断", "judge", [rubric])
    ).rejects.toThrow("未知目标");
  });

  it("formats traceable evidence for Excel and labels legacy records honestly", () => {
    const targetNames = new Map([["target-a", "模型 A"]]);
    expect(
      formatEvaluationEvidenceCell(
        [
          {
            kind: "text_quote",
            source: "target_output",
            targetId: "target-a",
            quote: "订单号",
            start: 3,
            end: 6,
          },
          {
            kind: "image_observation",
            source: "input_image",
            imageIndex: 1,
            observation: "商品位于画面中央",
          },
        ],
        targetNames
      )
    ).toBe(
      "模型 A 输出[3, 6)：「订单号」\n输入图片 #1：商品位于画面中央"
    );
    expect(formatEvaluationEvidenceCell(undefined, targetNames)).toBe(
      "未保存结构化证据"
    );
  });

  it("adds input and target output images to the client Judge payload", async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as {
        item: EvaluateInputItem;
      };
      return new Response(
        JSON.stringify({
          inputId: body.item.inputId,
          scores: [],
          summary: "Mock",
          recommendation: "Mock",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    await runEvaluation({
      inputs: [
        {
          id: "input-1",
          prompt: "看图回答",
          images: [
            {
              id: "input-image",
              name: "输入图",
              source: "url",
              value: "https://example.com/input.png",
            },
          ],
        },
      ],
      results: [
        {
          inputId: "input-1",
          items: [
            {
              targetId: "target-a",
              targetName: "模型 A",
              status: "success",
              outputImages: ["https://example.com/output.png"],
            },
          ],
        },
      ],
      evalPrompt: "检查图像",
      modelId: "judge",
      dimensions: [rubric],
      concurrency: 1,
    });

    const request = fetchMock.mock.calls[0][1] as RequestInit;
    const body = JSON.parse(String(request.body)) as {
      item: EvaluateInputItem;
    };
    expect(body.item.images?.map((image) => image.value)).toEqual([
      "https://example.com/input.png",
    ]);
    expect(body.item.targets[0]).toMatchObject({
      outputImageCount: 1,
      outputImages: [
        {
          source: "url",
          value: "https://example.com/output.png",
        },
      ],
    });
  });
});
