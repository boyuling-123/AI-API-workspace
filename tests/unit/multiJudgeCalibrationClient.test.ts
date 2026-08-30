import { afterEach, describe, expect, it, vi } from "vitest";
import { createGoldenDatasetVersion } from "@/lib/goldenDataset";
import { isMultiJudgeCalibrationEvidenceIntact } from "@/lib/multiJudgeCalibration";
import { runMultiJudgeCalibration } from "@/services/multiJudgeCalibrationClient";

afterEach(() => {
  vi.unstubAllGlobals();
});

const judges = [
  { id: "judge-a", name: "Judge A" },
  { id: "judge-b", name: "Judge B" },
  { id: "judge-c", name: "Judge C" },
];

describe("multi Judge calibration client", () => {
  it("runs the exact Case-by-Judge matrix and preserves independent metrics", async () => {
    const requests: Record<string, unknown>[] = [];
    let activeRequests = 0;
    let maxActiveRequests = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        activeRequests += 1;
        maxActiveRequests = Math.max(maxActiveRequests, activeRequests);
        const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
        requests.push(body);
        await new Promise((resolve) => setTimeout(resolve, 1));
        activeRequests -= 1;
        const item = body.item as { caseId: string };
        const modelId = String(body.modelId);
        const judgeLabel =
          item.caseId === "gold-pass"
            ? modelId === "judge-c"
              ? "fail"
              : "pass"
            : "fail";
        return new Response(
          JSON.stringify({
            caseId: item.caseId,
            judgeLabel,
            confidence: 0.9,
            reason: `${modelId} 独立判断`,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      })
    );
    const progress: string[] = [];

    const run = await runMultiJudgeCalibration({
      datasetVersion: dataset(),
      judges,
      arbitrationStrategy: "majority_conservative",
      criteria: "严格判断",
      concurrency: 3,
      onProgress: (completed, total) => progress.push(`${completed}/${total}`),
    });

    expect(requests).toHaveLength(6);
    expect(maxActiveRequests).toBe(3);
    expect(progress).toHaveLength(6);
    expect(progress.at(-1)).toBe("6/6");
    expect(
      requests.map((request) => [
        (request.item as { caseId: string }).caseId,
        request.modelId,
      ])
    ).toEqual([
      ["gold-pass", "judge-a"],
      ["gold-pass", "judge-b"],
      ["gold-pass", "judge-c"],
      ["gold-fail", "judge-a"],
      ["gold-fail", "judge-b"],
      ["gold-fail", "judge-c"],
    ]);
    for (const request of requests) {
      expect(request.item).toEqual(
        (request.item as { caseId: string }).caseId === "gold-pass"
          ? {
              caseId: "gold-pass",
              prompt: "问题 A",
              candidateOutput: "答案 A",
            }
          : {
              caseId: "gold-fail",
              prompt: "问题 B",
              candidateOutput: "答案 B",
            }
      );
    }
    expect(JSON.stringify(requests)).not.toContain("人工复核秘密");
    expect(run.status).toBe("done");
    expect(run.results.map((result) => result.judgeLabel)).toEqual([
      "pass",
      "fail",
    ]);
    expect(run.results[0].votes).toHaveLength(3);
    expect(run.disagreementCases).toBe(1);
    expect(run.metrics.accuracy).toBe(1);
    expect(run.perJudgeMetrics?.map((item) => item.metrics.accuracy)).toEqual([
      1,
      1,
      0.5,
    ]);
    expect(isMultiJudgeCalibrationEvidenceIntact(run)).toBe(true);
  });

  it("marks a Case as error when one Judge fails instead of using partial votes", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
        const item = body.item as { caseId: string };
        if (item.caseId === "gold-fail" && body.modelId === "judge-b") {
          return new Response(JSON.stringify({ error: "Judge timeout" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
        return new Response(
          JSON.stringify({
            caseId: item.caseId,
            judgeLabel: item.caseId === "gold-pass" ? "pass" : "fail",
            confidence: 0.9,
            reason: "独立判断",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      })
    );

    const run = await runMultiJudgeCalibration({
      datasetVersion: dataset(),
      judges,
      arbitrationStrategy: "majority_conservative",
      criteria: "严格判断",
      concurrency: 5,
    });

    expect(run.status).toBe("partial");
    expect(run.results[1]).toMatchObject({
      status: "error",
      error: "多 Judge 未完整返回：Judge B",
    });
    expect(run.results[1].judgeLabel).toBeUndefined();
    expect(run.metrics).toMatchObject({
      totalCases: 2,
      completedCases: 1,
      errorCases: 1,
    });
    expect(run.perJudgeMetrics?.[1].metrics.errorCases).toBe(1);
    expect(isMultiJudgeCalibrationEvidenceIntact(run)).toBe(true);
  });

  it("rejects duplicate Judge selections before making any request", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      runMultiJudgeCalibration({
        datasetVersion: dataset(),
        judges: [judges[0], { ...judges[0] }],
        arbitrationStrategy: "majority_conservative",
        criteria: "严格判断",
        concurrency: 2,
      })
    ).rejects.toThrow("Judge 不能重复选择");
    expect(fetchMock).not.toHaveBeenCalled();
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
