import { describe, expect, it } from "vitest";
import type { ResultRow, TaskInput } from "../../src/types";
import {
  analyzeDimensionHardRules,
  buildCoverageOrder,
  buildDimensionGenerationSamples,
  DimensionGenerationValidationError,
  listDimensionSampleCandidates,
  parseDimensionGenerationRequest,
  resolveImportedBadCase,
  selectRepresentativeSampleIds,
  type DimensionGenerationRequest,
} from "../../src/lib/dimensionGeneration";
import { buildDimensionGenerationPrompt } from "../../src/services/genDimensionsService";

const inputs: TaskInput[] = [
  {
    id: "input-a",
    prompt: "Case A",
    images: [
      {
        id: "image-a",
        name: "secret.png",
        source: "base64",
        value: "data:image/png;base64,SECRET_IMAGE_BYTES",
      },
    ],
    extraFields: { expected_output: "Gold A" },
  },
  {
    id: "input-b",
    prompt: "Case B",
    images: [],
    extraFields: {
      is_bad_case: "yes",
      bad_case_reason: "人工复核发现承诺了不存在的退款时效",
    },
  },
  {
    id: "input-c",
    prompt: "Case C",
    images: [],
    extraFields: { expected_output: "Gold C" },
  },
  { id: "input-d", prompt: "Case D", images: [] },
  { id: "input-e", prompt: "Case E", images: [] },
];

const results: ResultRow[] = inputs.map((input, index) => ({
  inputId: input.id,
  items: [
    index === 3
      ? {
          targetId: "target-a",
          targetName: "Target A",
          status: "error" as const,
          errorType: "auth" as const,
          error: "Authorization: Bearer SECRET_RAW_ERROR",
        }
      : {
          targetId: "target-a",
          targetName: "Target A",
          status: "success" as const,
          outputText: index === 0 ? "x".repeat(3_100) : `Output ${index}`,
          outputImages: ["data:image/png;base64,SECRET_OUTPUT_IMAGE"],
        },
  ],
}));

describe("dimension generation context", () => {
  it("parses only newline-delimited bounded hard rules", () => {
    expect(
      analyzeDimensionHardRules(
        " 不得承诺未确认时效 \n不得承诺未确认时效\n涉及账户时必须核验身份"
      )
    ).toEqual({
      rules: ["不得承诺未确认时效", "涉及账户时必须核验身份"],
      error: null,
    });
    expect(
      analyzeDimensionHardRules(
        Array.from({ length: 21 }, (_, index) => `规则 ${index + 1}`).join("\n")
      ).error
    ).toContain("最多 20 条");
    expect(analyzeDimensionHardRules("x".repeat(501)).error).toContain(
      "不能超过 500 个字符"
    );
  });

  it("recognizes only explicit imported Bad Case fields", () => {
    expect(resolveImportedBadCase(inputs[1])).toEqual({
      marked: true,
      reason: "人工复核发现承诺了不存在的退款时效",
    });
    expect(
      resolveImportedBadCase({
        id: "unknown",
        prompt: "Bad Case 只是普通 prompt 文本",
        images: [],
        extraFields: { arbitrary_note: "这是一条坏例" },
      })
    ).toEqual({ marked: false, reason: "" });
    expect(
      resolveImportedBadCase({
        id: "camel-case",
        prompt: "Camel Case aliases",
        images: [],
        extraFields: {
          badCase: true,
          badCaseReason: "鉴权配置错误",
        },
      })
    ).toEqual({ marked: true, reason: "鉴权配置错误" });
  });

  it("redacts sensitive values before dimension context leaves the client or server boundary", () => {
    const clientRules = analyzeDimensionHardRules(
      "调用前确认 api_key=not-a-real-key"
    );
    expect(clientRules).toEqual({
      rules: ["调用前确认 api_key=[REDACTED]"],
      error: null,
    });

    const parsed = parseDimensionGenerationRequest({
      ...validRequest(),
      hardRules: ["调用前确认 api_key=not-a-real-key"],
      samples: [
        {
          ...validRequest().samples[0],
          badCaseReason: "错误日志 token=placeholder-value",
        },
      ],
    });
    expect(JSON.stringify(parsed)).not.toContain("not-a-real-key");
    expect(JSON.stringify(parsed)).not.toContain("placeholder-value");
    expect(parsed.hardRules[0]).toContain("[REDACTED]");
    expect(parsed.samples[0].badCaseReason).toContain("[REDACTED]");
  });

  it("selects deterministic coverage, failed, and expected-answer samples", () => {
    const candidates = listDimensionSampleCandidates(inputs, results);

    expect(buildCoverageOrder(5)).toEqual([0, 4, 2, 1, 3]);
    expect(selectRepresentativeSampleIds(candidates, "coverage", 3)).toEqual([
      "input-a",
      "input-e",
      "input-c",
    ]);
    expect(
      selectRepresentativeSampleIds(candidates, "failures_first", 3)
    ).toEqual(["input-d", "input-a", "input-e"]);
    expect(
      selectRepresentativeSampleIds(candidates, "expected_first", 3)
    ).toEqual(["input-a", "input-c", "input-e"]);
  });

  it("builds a bounded payload without raw images or full error text", () => {
    const samples = buildDimensionGenerationSamples({
      inputs,
      results,
      selectedInputIds: ["input-d", "input-a", "input-a"],
      badCaseReasons: {
        "input-d": "y".repeat(1_100),
      },
    });

    expect(samples.map((sample) => sample.inputId)).toEqual([
      "input-d",
      "input-a",
    ]);
    expect(samples[0].outputs[0]).toEqual({
      targetId: "target-a",
      targetName: "Target A",
      status: "error",
      outputText: undefined,
      outputImageCount: 0,
      errorType: "auth",
    });
    expect(samples[0].badCaseReason).toHaveLength(1_000);
    expect(samples[1]).toMatchObject({
      inputImageCount: 1,
      expectedAnswer: "Gold A",
      expectedAnswerKey: "expected_output",
    });
    expect(samples[1].outputs[0].outputText).toHaveLength(3_000);
    expect(samples[1].outputs[0].outputImageCount).toBe(1);

    const serialized = JSON.stringify(samples);
    expect(serialized).not.toContain("SECRET_IMAGE_BYTES");
    expect(serialized).not.toContain("SECRET_OUTPUT_IMAGE");
    expect(serialized).not.toContain("SECRET_RAW_ERROR");
  });

  it("validates and canonicalizes the public request contract", () => {
    const request = validRequest();
    expect(parseDimensionGenerationRequest(request)).toEqual(request);

    expect(() =>
      parseDimensionGenerationRequest({ ...request, taskType: "unknown" })
    ).toThrow("请选择有效的任务类型");
    expect(() =>
      parseDimensionGenerationRequest({ ...request, samples: [] })
    ).toThrow("请至少选择 1 条代表性样本");
    expect(() =>
      parseDimensionGenerationRequest({
        ...request,
        samples: Array.from({ length: 9 }, () => request.samples[0]),
      })
    ).toThrow("代表性样本最多 8 条");
    expect(() =>
      parseDimensionGenerationRequest({
        ...request,
        objective: "x".repeat(2_001),
      })
    ).toThrow("评测目标不能超过 2000 个字符");
    expect(() =>
      parseDimensionGenerationRequest({
        ...request,
        samples: [{ ...request.samples[0], outputs: [] }],
      })
    ).toThrow("缺少模型或算法输出");
    expect(() =>
      parseDimensionGenerationRequest({
        ...request,
        samples: [request.samples[0], request.samples[0]],
      })
    ).toThrow("代表性样本 inputId 不能重复");
    expect(() =>
      parseDimensionGenerationRequest({ ...request, hardRules: "任意文本" })
    ).toThrow("硬规则必须是字符串数组");
    expect(() =>
      parseDimensionGenerationRequest({
        ...request,
        hardRules: ["规则 A", " 规则   a "],
      })
    ).toThrow("硬规则不能重复");
    expect(() =>
      parseDimensionGenerationRequest({
        ...request,
        samples: [
          {
            ...request.samples[0],
            badCaseReason: " ",
          },
        ],
      })
    ).toThrow("Bad Case 原因不能为空");

    const canonical = parseDimensionGenerationRequest({
      ...request,
      samples: [
        {
          ...request.samples[0],
          outputs: [
            {
              ...request.samples[0].outputs[0],
              status: "error",
              outputText: "不得保留的完整错误",
              errorType: "auth",
            },
          ],
        },
      ],
    });
    expect(canonical.samples[0].outputs[0]).toMatchObject({
      status: "error",
      outputText: undefined,
      errorType: "auth",
    });
  });

  it("builds a prompt from all structured fields and sanitized samples", () => {
    const prompt = buildDimensionGenerationPrompt(validRequest());

    expect(prompt).toContain("评测目标：判断客服回答是否可上线");
    expect(prompt).toContain("业务场景：电商售后客服");
    expect(prompt).toContain("任务类型：文本生成（text_generation）");
    expect(prompt).toContain("=== 硬规则 ===");
    expect(prompt).toContain("1. 不得承诺未确认的退款时效");
    expect(prompt).toContain("输入：客户要求退款");
    expect(prompt).toContain("标准答案（expected_output）：先核验订单状态");
    expect(prompt).toContain("人工标记：Bad Case");
    expect(prompt).toContain("Bad Case 原因：错误承诺立即退款");
    expect(prompt).toContain("Target A [success]：请提供订单号");
  });
});

function validRequest(): DimensionGenerationRequest {
  return {
    objective: "判断客服回答是否可上线",
    businessScenario: "电商售后客服",
    taskType: "text_generation",
    hardRules: ["不得承诺未确认的退款时效"],
    samples: [
      {
        inputId: "input-a",
        prompt: "客户要求退款",
        inputImageCount: 0,
        expectedAnswer: "先核验订单状态",
        expectedAnswerKey: "expected_output",
        badCaseReason: "错误承诺立即退款",
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
