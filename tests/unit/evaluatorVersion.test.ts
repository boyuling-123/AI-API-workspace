import { describe, expect, it } from "vitest";
import type { EvaluatorDefinitionDraft } from "../../src/lib/evaluatorVersion";
import {
  cloneEvaluatorVersionDraft,
  createEvaluatorVersion,
  evaluatorVersionMatchesDraft,
  isEvaluatorVersionIntact,
} from "../../src/lib/evaluatorVersion";
import { createDefinitionBasedRubric } from "../../src/lib/evaluationRubric";

function definition(prompt = "逐项核对证据后评分"): EvaluatorDefinitionDraft {
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

describe("Evaluator versions", () => {
  it("creates a canonical v1 snapshot without retaining mutable draft references", () => {
    const draft = definition();
    const version = createEvaluatorVersion({
      ...draft,
      existingVersions: [],
      id: "version-1",
      evaluatorId: undefined,
      name: " 客服上线评价器 ",
      createTime: 100,
      createdBy: " Lu ",
      applicableTaskId: "task-a",
    });

    expect(version).toMatchObject({
      id: "version-1",
      version: 1,
      name: "客服上线评价器",
      createTime: 100,
      createdBy: "Lu",
      applicableTaskId: "task-a",
      expectedAnswerColumn: "gold_answer",
    });
    expect(version.evaluatorId).toBeTruthy();
    expect(version.definitionFingerprint.length).toBeLessThan(32);
    expect(version.integrityFingerprint.length).toBeLessThan(32);
    expect(isEvaluatorVersionIntact(version)).toBe(true);

    draft.dimensions[0].name = "被外部修改";
    draft.dimensions[0].scoreLevels![0].criteria = "被外部修改";
    expect(version.dimensions[0].name).toBe("答案正确性");
    expect(version.dimensions[0].scoreLevels![0].criteria).not.toBe(
      "被外部修改"
    );
  });

  it("appends v2 in one family and leaves v1 unchanged", () => {
    const v1 = createEvaluatorVersion({
      ...definition("第一版 Prompt"),
      existingVersions: [],
      id: "version-1",
      name: "客服上线评价器",
      createTime: 100,
      createdBy: "Lu",
      applicableTaskId: "task-a",
    });
    const v1Snapshot = JSON.stringify(v1);
    const v2 = createEvaluatorVersion({
      ...definition("第二版 Prompt，增加格式复核"),
      existingVersions: [v1, { ...v1, id: "tampered", version: 999 }],
      evaluatorId: v1.evaluatorId,
      id: "version-2",
      name: "客服上线评价器",
      createTime: 200,
      createdBy: "Reviewer",
      changeNote: "增加格式复核",
      applicableTaskId: "task-b",
    });

    expect(v2).toMatchObject({
      evaluatorId: v1.evaluatorId,
      version: 2,
      createdBy: "Reviewer",
      changeNote: "增加格式复核",
      applicableTaskId: "task-b",
    });
    expect(JSON.stringify(v1)).toBe(v1Snapshot);
  });

  it("detects manual Prompt edits and returns isolated reusable drafts", () => {
    const version = createEvaluatorVersion({
      ...definition(),
      existingVersions: [],
      id: "version-1",
      name: "客服上线评价器",
      createTime: 100,
      createdBy: "Lu",
      applicableTaskId: "task-a",
    });
    const loaded = cloneEvaluatorVersionDraft(version);

    expect(evaluatorVersionMatchesDraft(version, loaded)).toBe(true);
    loaded.evalPrompt += "\n人工补充规则";
    loaded.dimensions[0].name = "草稿维度";
    expect(evaluatorVersionMatchesDraft(version, loaded)).toBe(false);
    expect(version.evalPrompt).toBe("逐项核对证据后评分");
    expect(version.dimensions[0].name).toBe("答案正确性");
  });

  it("rejects invalid metadata, missing families, and tampered snapshots", () => {
    expect(() =>
      createEvaluatorVersion({
        ...definition(),
        existingVersions: [],
        id: "version-1",
        name: "",
        createdBy: "Lu",
        applicableTaskId: "task-a",
      })
    ).toThrow("Evaluator 名称不能为空");

    expect(() =>
      createEvaluatorVersion({
        ...definition(),
        existingVersions: [],
        evaluatorId: "missing-family",
        id: "version-2",
        name: "客服上线评价器",
        createdBy: "Lu",
        applicableTaskId: "task-a",
      })
    ).toThrow("要追加版本的 Evaluator 不存在");

    const version = createEvaluatorVersion({
      ...definition(),
      existingVersions: [],
      id: "version-1",
      name: "客服上线评价器",
      createdBy: "Lu",
      applicableTaskId: "task-a",
    });
    const tampered = { ...version, evalPrompt: "被篡改" };
    expect(isEvaluatorVersionIntact(tampered)).toBe(false);
    expect(() => cloneEvaluatorVersionDraft(tampered)).toThrow(
      "Evaluator 版本完整性校验失败"
    );
    expect(
      isEvaluatorVersionIntact({ ...version, createdBy: "篡改者" })
    ).toBe(false);
  });

  it("redacts secrets before an Evaluator version enters project storage", () => {
    const version = createEvaluatorVersion({
      ...definition("检查 api_key=real-secret-value 后评分"),
      existingVersions: [],
      id: "version-safe",
      name: "安全评价器 token=private-token-value",
      createdBy: "Lu",
      changeNote: "authorization=private-auth-value",
      applicableTaskId: "task-a",
    });

    const serialized = JSON.stringify(version);
    expect(serialized).toContain("[REDACTED]");
    expect(serialized).not.toContain("real-secret-value");
    expect(serialized).not.toContain("private-token-value");
    expect(serialized).not.toContain("private-auth-value");
    expect(isEvaluatorVersionIntact(version)).toBe(true);
  });
});
