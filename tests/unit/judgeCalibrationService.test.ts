import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  chatWithModel: vi.fn(),
}));

vi.mock("@/services/llmClient", () => ({
  chatWithModel: mocks.chatWithModel,
}));

import {
  JudgeCalibrationValidationError,
  judgeGoldenCase,
  parseJudgeCalibrationInput,
} from "@/services/judgeCalibrationService";

beforeEach(() => {
  mocks.chatWithModel.mockReset();
});

describe("Judge calibration service", () => {
  it("whitelists Case fields and never sends human truth to Judge", async () => {
    mocks.chatWithModel.mockResolvedValue({
      outputText: "```json\n{\"label\":\"通过\",\"confidence\":0.8754,\"reason\":\"答案与标准一致\"}\n```",
      outputImages: [],
    });

    const judgment = await judgeGoldenCase(
      {
        caseId: "gold-001",
        prompt: "退款规则是什么",
        candidateOutput: "未拆封支持七天退款",
        expectedAnswer: "未拆封支持七天退款",
        humanLabel: "fail",
        reviewerNote: "manual-truth-secret-42",
      },
      "judge-model",
      "事实、关键字段和结论均正确才通过"
    );

    expect(judgment).toEqual({
      caseId: "gold-001",
      judgeLabel: "pass",
      confidence: 0.875,
      reason: "答案与标准一致",
    });
    const prompt = mocks.chatWithModel.mock.calls[0][0].prompt as string;
    expect(prompt).toContain("事实、关键字段和结论均正确才通过");
    expect(prompt).toContain("未拆封支持七天退款");
    expect(prompt).not.toContain("manual-truth-secret-42");
    expect(prompt).not.toContain("人工标签：fail");
  });

  it("redacts credentials before building the Judge prompt", async () => {
    mocks.chatWithModel.mockResolvedValue({
      outputText: JSON.stringify({
        label: "fail",
        confidence: 0.7,
        reason: "缺少依据",
      }),
      outputImages: [],
    });

    await judgeGoldenCase(
      {
        caseId: "gold-secret",
        prompt: "检查 api_key=real-secret-value",
        candidateOutput: "无法判断",
      },
      "judge-model",
      "依据规则判断"
    );
    const prompt = mocks.chatWithModel.mock.calls[0][0].prompt as string;
    expect(prompt).toContain("[REDACTED]");
    expect(prompt).not.toContain("real-secret-value");
  });

  it("rejects malformed Case input before any model call", async () => {
    expect(() =>
      parseJudgeCalibrationInput({
        caseId: "gold-001",
        prompt: "问题",
      })
    ).toThrow(JudgeCalibrationValidationError);
    await expect(
      judgeGoldenCase(
        { caseId: "gold-001", prompt: "问题" },
        "judge-model",
        "严格判断"
      )
    ).rejects.toThrow("候选输出不能为空");
    expect(mocks.chatWithModel).not.toHaveBeenCalled();
  });

  it("rejects invalid Judge labels and confidence", async () => {
    mocks.chatWithModel.mockResolvedValueOnce({
      outputText: JSON.stringify({
        label: "maybe",
        confidence: 0.5,
        reason: "不确定",
      }),
      outputImages: [],
    });
    await expect(
      judgeGoldenCase(validCase(), "judge-model", "严格判断")
    ).rejects.toThrow("label 必须是 pass 或 fail");

    mocks.chatWithModel.mockResolvedValueOnce({
      outputText: JSON.stringify({
        label: "pass",
        confidence: 1.2,
        reason: "超出范围",
      }),
      outputImages: [],
    });
    await expect(
      judgeGoldenCase(validCase(), "judge-model", "严格判断")
    ).rejects.toThrow("confidence 必须是 0 到 1 之间的数字");
  });
});

function validCase() {
  return {
    caseId: "gold-001",
    prompt: "问题",
    candidateOutput: "候选输出",
  };
}
