import { describe, expect, it } from "vitest";
import type { EvaluatorDefinitionDraft } from "../../src/lib/evaluatorVersion";
import {
  createEvaluatorVersion,
  isEvaluatorVersionIntact,
} from "../../src/lib/evaluatorVersion";
import {
  compareEvaluatorVersions,
  restoreEvaluatorVersion,
} from "../../src/lib/evaluatorVersionDiff";
import { createDefinitionBasedRubric } from "../../src/lib/evaluationRubric";

function definition(prompt: string): EvaluatorDefinitionDraft {
  return {
    evalModelId: "judge-a",
    userRequirement: "判断客服回复能否直接上线",
    dimensions: [
      {
        ...createDefinitionBasedRubric(
          "答案正确性",
          "回复必须与可核验事实一致"
        ),
        weight: 100,
        vetoThreshold: 5,
      },
    ],
    evalPrompt: prompt,
    evaluationMode: "reference",
    expectedAnswerColumn: "gold_answer",
  };
}

function createFamily() {
  const v1 = createEvaluatorVersion({
    ...definition("先核对事实\n再检查格式\n最后给分"),
    existingVersions: [],
    id: "version-1",
    name: "客服上线评价器",
    createTime: 100,
    createdBy: "Lu",
    applicableTaskId: "task-a",
  });
  const v2Draft = definition("先核对事实\n再检查安全规则\n最后给分");
  v2Draft.evalModelId = "judge-b";
  v2Draft.dimensions[0].weight = 80;
  v2Draft.dimensions.push({
    ...createDefinitionBasedRubric("格式合规性", "输出必须满足模板"),
    weight: 20,
  });
  const v2 = createEvaluatorVersion({
    ...v2Draft,
    existingVersions: [v1],
    evaluatorId: v1.evaluatorId,
    id: "version-2",
    name: "客服上线评价器",
    createTime: 200,
    createdBy: "Reviewer",
    changeNote: "增加安全和格式要求",
    applicableTaskId: "task-b",
  });
  return { v1, v2 };
}

describe("Evaluator version Diff and restore", () => {
  it("builds deterministic structural, line, and impact differences", () => {
    const { v1, v2 } = createFamily();
    const diff = compareEvaluatorVersions(v1, v2);

    expect(diff.fieldChanges.map((change) => change.label)).toEqual([
      "裁判模型",
      "适用任务",
    ]);
    expect(diff.dimensionChanges).toEqual([
      {
        kind: "modified",
        name: "答案正确性",
        changedFields: ["权重"],
      },
      { kind: "added", name: "格式合规性", changedFields: [] },
    ]);
    expect(
      diff.prompt.lines.filter((line) => line.kind !== "unchanged")
    ).toEqual([
      { kind: "removed", value: "再检查格式", oldLine: 2 },
      { kind: "added", value: "再检查安全规则", newLine: 2 },
    ]);
    expect(diff.prompt).toMatchObject({
      changed: true,
      addedLineCount: 1,
      removedLineCount: 1,
    });
    expect(diff.impactScopes).toEqual([
      "judge_model",
      "task_scope",
      "scoring",
      "prompt",
    ]);
    expect(diff.hasChanges).toBe(true);
  });

  it("uses a bounded replacement Diff for very large prompts", () => {
    const before = Array.from({ length: 600 }, (_, index) => `规则 ${index}`);
    const after = [...before];
    after[300] = "替换后的规则";
    const v1 = createEvaluatorVersion({
      ...definition(before.join("\n")),
      existingVersions: [],
      id: "large-1",
      name: "大 Prompt 评价器",
      createdBy: "Lu",
      applicableTaskId: "task-a",
    });
    const v2 = createEvaluatorVersion({
      ...definition(after.join("\n")),
      existingVersions: [v1],
      evaluatorId: v1.evaluatorId,
      id: "large-2",
      name: "大 Prompt 评价器",
      createdBy: "Lu",
      applicableTaskId: "task-a",
    });

    const diff = compareEvaluatorVersions(v1, v2);
    expect(diff.prompt.addedLineCount).toBe(1);
    expect(diff.prompt.removedLineCount).toBe(1);
    expect(diff.prompt.lines).toHaveLength(601);
  });

  it("reports display-name changes for the same normalized dimension", () => {
    const originalDefinition = definition("保持 Prompt");
    originalDefinition.dimensions[0].name = "Answer Quality";
    const v1 = createEvaluatorVersion({
      ...originalDefinition,
      existingVersions: [],
      id: "name-1",
      name: "维度名称评价器",
      createdBy: "Lu",
      applicableTaskId: "task-a",
    });
    const renamedDefinition = definition("保持 Prompt");
    renamedDefinition.dimensions[0].name = "answer quality";
    const v2 = createEvaluatorVersion({
      ...renamedDefinition,
      existingVersions: [v1],
      evaluatorId: v1.evaluatorId,
      id: "name-2",
      name: "维度名称评价器",
      createdBy: "Lu",
      applicableTaskId: "task-a",
    });

    expect(compareEvaluatorVersions(v1, v2).dimensionChanges).toEqual([
      {
        kind: "modified",
        name: "answer quality",
        changedFields: ["维度名称"],
      },
    ]);
  });

  it("rejects damaged and cross-family comparisons", () => {
    const { v1, v2 } = createFamily();
    const other = createEvaluatorVersion({
      ...definition("另一个 Prompt"),
      existingVersions: [],
      id: "other-1",
      name: "其他评价器",
      createdBy: "Lu",
      applicableTaskId: "task-a",
    });

    expect(() => compareEvaluatorVersions(v1, other)).toThrow(
      "只能比较同一 Evaluator 家族"
    );
    expect(() =>
      compareEvaluatorVersions(v1, { ...v2, evalPrompt: "被篡改" })
    ).toThrow("完整性校验失败");
  });

  it("restores a historical snapshot as v3 without mutating v1 or v2", () => {
    const { v1, v2 } = createFamily();
    const oldSnapshots = [JSON.stringify(v1), JSON.stringify(v2)];
    const v3 = restoreEvaluatorVersion({
      sourceVersion: v1,
      existingVersions: [v1, v2],
      id: "version-3",
      createTime: 300,
      createdBy: "Release owner",
      changeNote: "线上口径回退",
      applicableTaskId: "task-c",
    });

    expect(v3).toMatchObject({
      id: "version-3",
      evaluatorId: v1.evaluatorId,
      version: 3,
      evalPrompt: v1.evalPrompt,
      evalModelId: v1.evalModelId,
      createdBy: "Release owner",
      changeNote: "从 v1 恢复：线上口径回退",
      applicableTaskId: "task-c",
    });
    expect(isEvaluatorVersionIntact(v3)).toBe(true);
    expect([JSON.stringify(v1), JSON.stringify(v2)]).toEqual(oldSnapshots);
  });

  it("does not restore the latest, missing, or damaged source", () => {
    const { v1, v2 } = createFamily();
    expect(() =>
      restoreEvaluatorVersion({
        sourceVersion: v2,
        existingVersions: [v1, v2],
        createdBy: "Lu",
        applicableTaskId: "task-c",
      })
    ).toThrow("当前版本已是最新版");
    expect(() =>
      restoreEvaluatorVersion({
        sourceVersion: v1,
        existingVersions: [v2],
        createdBy: "Lu",
        applicableTaskId: "task-c",
      })
    ).toThrow("恢复来源版本不存在");
    expect(() =>
      restoreEvaluatorVersion({
        sourceVersion: { ...v1, evalPrompt: "被篡改" },
        existingVersions: [v1, v2],
        createdBy: "Lu",
        applicableTaskId: "task-c",
      })
    ).toThrow("恢复来源版本不存在或完整性校验失败");
  });
});
