import { afterEach, describe, expect, it, vi } from "vitest";
import { runJudgeCalibration } from "@/services/judgeCalibrationClient";
import { createGoldenDatasetVersion } from "@/lib/goldenDataset";
import { createEvaluatorVersion } from "@/lib/evaluatorVersion";
import { createDefinitionBasedRubric } from "@/lib/evaluationRubric";
import {
  buildEvaluatorCalibrationCriteria,
  buildJudgeCalibrationRerunPlan,
} from "@/lib/judgeCalibrationRerun";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Judge calibration client", () => {
  it("sends only whitelisted Case fields and preserves partial failures", async () => {
    const requests: Record<string, unknown>[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
        requests.push(body);
        const item = body.item as { caseId: string };
        if (item.caseId === "gold-fail") {
          return new Response(JSON.stringify({ error: "Judge timeout" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
        return new Response(
          JSON.stringify({
            caseId: item.caseId,
            judgeLabel: "pass",
            confidence: 0.9,
            reason: "满足标准",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      })
    );
    const progress: string[] = [];

    const evaluator = evaluatorVersion();
    const criteria = buildEvaluatorCalibrationCriteria(evaluator);
    const rerunPlan = buildJudgeCalibrationRerunPlan({
      datasetVersionId: "gold-version-1",
      judgeModelId: "judge-model",
      criteria,
      criteriaSource: "evaluator",
      evaluatorVersion: evaluator,
      runs: [],
    });
    const run = await runJudgeCalibration({
      datasetVersion: dataset(),
      judgeModelId: "judge-model",
      judgeModelName: "Judge A",
      criteria,
      criteriaSource: "evaluator",
      evaluatorVersion: evaluator,
      rerunPlan,
      concurrency: 2,
      onProgress: (completed, total) => progress.push(`${completed}/${total}`),
    });

    expect(requests).toHaveLength(2);
    expect(requests[0].item).toEqual({
      caseId: "gold-pass",
      prompt: "问题 A",
      candidateOutput: "答案 A",
    });
    expect(JSON.stringify(requests)).not.toContain("人工复核秘密");
    expect(run.status).toBe("partial");
    expect(run.results.map((item) => item.status)).toEqual([
      "success",
      "error",
    ]);
    expect(run.metrics).toMatchObject({
      totalCases: 2,
      completedCases: 1,
      errorCases: 1,
      accuracy: 1,
    });
    expect(progress).toHaveLength(2);
    expect(run).toMatchObject({
      trigger: "initial",
      evaluatorVersionId: "evaluator-v1",
      evaluatorVersion: 1,
      criteriaSource: "evaluator",
      changeKinds: [],
    });
    expect(run.calibrationTaskId).toBeTruthy();
  });

  it("rejects malformed success payloads as Case errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ caseId: "gold-pass" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      )
    );

    const run = await runJudgeCalibration({
      datasetVersion: dataset(),
      judgeModelId: "judge-model",
      judgeModelName: "Judge A",
      criteria: "严格判断",
      concurrency: 20,
    });
    expect(run.status).toBe("error");
    expect(run.metrics.completedCases).toBe(0);
    expect(run.results[0].error).toBe("Judge 校准接口返回结构不完整");
  });
});

function dataset() {
  return createGoldenDatasetVersion({
    existingVersions: [],
    id: "gold-version-1",
    name: "客服黄金集",
    createdBy: "Lu",
    cases: [
      {
        caseId: "gold-pass",
        prompt: "问题 A",
        candidateOutput: "答案 A",
        humanLabel: "pass",
        reviewerNote: "人工复核秘密",
      },
      {
        caseId: "gold-fail",
        prompt: "问题 B",
        candidateOutput: "答案 B",
        humanLabel: "fail",
      },
    ],
  });
}

function evaluatorVersion() {
  return createEvaluatorVersion({
    existingVersions: [],
    id: "evaluator-v1",
    name: "客服评价器",
    createdBy: "Lu",
    applicableTaskId: "task-a",
    evalModelId: "judge-model",
    userRequirement: "判断客服回复能否上线",
    dimensions: [
      {
        ...createDefinitionBasedRubric("答案正确性", "回复必须符合事实"),
        weight: 100,
      },
    ],
    evalPrompt: "逐项核对后判分",
    evaluationMode: "comparison",
  });
}
