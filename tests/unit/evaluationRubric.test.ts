import { describe, expect, it } from "vitest";
import {
  analyzeEvaluationRubric,
  createDefinitionBasedRubric,
  createEmptyEvaluationRubric,
  formatEvaluationRubricForPrompt,
  parseEvaluationRubrics,
} from "../../src/lib/evaluationRubric";

describe("structured evaluation rubrics", () => {
  it("accepts and canonicalizes a complete 0/5/10 rubric", () => {
    const analysis = analyzeEvaluationRubric({
      name: "  答案   正确性 ",
      desc: " 是否与标准答案一致 ",
      scoreLevels: [
        { score: 10, criteria: " 完全一致 " },
        { score: 0, criteria: " 完全错误 " },
        { score: 5, criteria: " 部分正确 " },
      ],
      evidenceRequirements: ["引用关键字段", "说明缺失项"],
      judgeInstruction: "先比对字段，再判断语义",
    });

    expect(analysis.issues).toEqual([]);
    expect(analysis.dimension).toEqual({
      name: "答案 正确性",
      desc: "是否与标准答案一致",
      scoreLevels: [
        { score: 0, criteria: "完全错误" },
        { score: 5, criteria: "部分正确" },
        { score: 10, criteria: "完全一致" },
      ],
      evidenceRequirements: ["引用关键字段", "说明缺失项"],
      judgeInstruction: "先比对字段，再判断语义",
    });
  });

  it("rejects missing anchors, evidence, instructions, and duplicate names", () => {
    const empty = analyzeEvaluationRubric(createEmptyEvaluationRubric());
    expect(empty.issues.map((issue) => issue.field)).toEqual([
      "name",
      "definition",
      "scoreLevels",
      "scoreLevels",
      "scoreLevels",
      "scoreLevels",
      "evidenceRequirements",
      "judgeInstruction",
    ]);

    const rubric = createDefinitionBasedRubric("准确性", "内容必须正确");
    expect(() => parseEvaluationRubrics([rubric, rubric])).toThrow(
      "评价维度名称不能重复：准确性"
    );
  });

  it("redacts sensitive text and rejects unsupported scoring levels", () => {
    const rubric = createDefinitionBasedRubric("安全性", "不得泄漏 api_key=demo-value");
    const analysis = analyzeEvaluationRubric({
      ...rubric,
      scoreLevels: [
        { score: 0, criteria: "token=placeholder-value" },
        { score: 7, criteria: "错误锚点" },
        { score: 10, criteria: "完全满足" },
      ],
    });
    expect(analysis.issues.some((issue) => issue.message.includes("只允许"))).toBe(
      true
    );

    const sanitized = parseEvaluationRubrics([rubric])[0];
    expect(JSON.stringify(sanitized)).not.toContain("demo-value");
    expect(sanitized.desc).toContain("[REDACTED]");
  });

  it("formats every executable field for Judge prompts", () => {
    const rubric = createDefinitionBasedRubric("准确性", "内容必须正确");
    const block = formatEvaluationRubricForPrompt(rubric, 0);
    expect(block).toContain("1. 准确性");
    expect(block).toContain("定义：内容必须正确");
    expect(block).toContain("0 分：");
    expect(block).toContain("5 分：");
    expect(block).toContain("10 分：");
    expect(block).toContain("证据要求：");
    expect(block).toContain("判断规则：");
  });
});
