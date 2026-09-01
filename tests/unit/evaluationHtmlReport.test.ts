import { describe, expect, it } from "vitest";
import type {
  EvaluationRecord,
  EvaluationReviewEvent,
  Task,
} from "../../src/types";
import { createDefinitionBasedRubric } from "../../src/lib/evaluationRubric";
import { createEvaluationReviewEvent } from "../../src/lib/evaluationReview";
import { createEvaluatorVersion } from "../../src/lib/evaluatorVersion";
import {
  EVALUATION_HTML_REPORT_SCHEMA,
  fingerprintEvaluationHtmlReportSnapshot,
  generateEvaluationHtmlReport,
} from "../../src/services/evaluationHtmlReport";

const generatedAt = Date.UTC(2026, 8, 1, 6, 30, 0);
const rubric = {
  ...createDefinitionBasedRubric("事实准确性", "结论必须与输入事实一致"),
  weight: 100,
  vetoThreshold: 5,
};

function fixture() {
  const task: Task = {
    id: "task-1",
    createTime: 100,
    finishTime: 200,
    contentMode: "text",
    runMode: "batch",
    inputs: [
      {
        id: "case-1",
        prompt: "客户申请退款",
        images: [
          {
            id: "input-image",
            name: "退款凭证.png",
            source: "base64",
            value: "data:image/png;base64,AAAA",
          },
        ],
        extraFields: { gold_answer: "24 小时内原路退回" },
      },
    ],
    targetIds: ["model-a"],
    concurrency: 2,
    runPolicy: { qps: 4, timeoutMs: 20_000, retryLimit: 1 },
    paramSnapshot: [],
    results: [
      {
        inputId: "case-1",
        items: [
          {
            targetId: "model-a",
            targetName: "客服模型 A",
            status: "success",
            outputText: "将在 24 小时内退款",
            outputImages: [
              "data:image/png;base64,BBBB",
              "https://assets.example.com/refund.png?size=large",
            ],
            latencyMs: 321,
          },
        ],
      },
    ],
    status: "done",
  };
  const version = createEvaluatorVersion({
    existingVersions: [],
    id: "evaluator-version-1",
    name: "客服上线评价器",
    createTime: 150,
    createdBy: "Lu",
    changeNote: "建立首版可复核口径",
    applicableTaskId: task.id,
    evalModelId: "judge-a",
    userRequirement: "核验退款承诺",
    dimensions: [rubric],
    evalPrompt: "逐项核验证据后评分",
    evaluationMode: "reference",
    expectedAnswerColumn: "gold_answer",
  });
  const record: EvaluationRecord = {
    id: "evaluation-1",
    sourceTaskId: task.id,
    createTime: 300,
    evalModelId: "judge-a",
    userRequirement: "核验退款承诺",
    dimensions: [rubric],
    evalPrompt: "逐项核验证据后评分",
    scope: "all",
    count: 1,
    status: "done",
    evaluationMode: "reference",
    expectedAnswerColumn: "gold_answer",
    evaluatorVersionId: version.id,
    results: [
      {
        inputId: "case-1",
        scores: [
          {
            targetId: "model-a",
            targetName: "客服模型 A",
            dimensionScores: [
              {
                dimension: "事实准确性",
                score: 8.5,
                comment: "输入与退款承诺可回查",
                evidence: [
                  {
                    kind: "text_quote",
                    source: "input_prompt",
                    quote: "客户申请退款",
                    start: 0,
                    end: 6,
                  },
                  {
                    kind: "text_quote",
                    source: "target_output",
                    targetId: "model-a",
                    quote: "24 小时内退款",
                    start: 3,
                    end: 11,
                  },
                ],
              },
            ],
            weightedScore: 8.5,
            vetoed: false,
            vetoReasons: [],
            overallComment: "承诺清楚且有证据",
          },
        ],
        summary: "整体可用",
        recommendation: "进入人工抽检",
      },
    ],
  };
  const review = createEvaluationReviewEvent({
    record,
    inputId: "case-1",
    targetId: "model-a",
    existingEvents: [],
    actor: "Reviewer",
    note: "人工确认退款时效可信",
    isBadCase: true,
    dimensionScores: [{ dimension: "事实准确性", score: 9 }],
    id: "review-1",
    createTime: 400,
  });
  return { task, version, record, review };
}

describe("evaluation HTML report", () => {
  it("freezes results, configuration, version, review, leaderboard and evidence", () => {
    const { task, version, record, review } = fixture();
    const before = JSON.stringify({ task, version, record, review });
    const report = generateEvaluationHtmlReport({
      projectName: "客服回归评测",
      task,
      record,
      evaluatorVersions: [version],
      reviewEvents: [review],
      generatedAt,
    });

    expect(report.snapshot).toMatchObject({
      schemaVersion: EVALUATION_HTML_REPORT_SCHEMA,
      projectName: "客服回归评测",
      evaluatorVersion: {
        status: "verified",
        requestedId: version.id,
        snapshot: { name: "客服上线评价器", version: 1 },
      },
      humanReview: { rejectedEventCount: 0 },
      leaderboard: {
        totalCases: 1,
        eligibleTargets: 1,
        entries: [{ targetId: "model-a", rank: 1, score: 8.5 }],
      },
    });
    expect(report.snapshot.humanReview.events).toHaveLength(1);
    expect(report.html).toContain("AI 原始分排行榜");
    expect(report.html).toContain("逐项核验证据后评分");
    expect(report.html).toContain("24 小时内退款");
    expect(report.html).toContain("人工复核覆盖");
    expect(report.html).toContain("Bad Case");
    expect(report.html).toContain("data:image/png;base64,AAAA");
    expect(report.html).toContain("远程图片未嵌入");
    expect(report.html).not.toContain(
      '<img src="https://assets.example.com/refund.png'
    );
    expect(report.fileName).toMatch(
      /^客服回归评测_AI评价报告_20260901_063000\.html$/
    );
    expect(JSON.stringify({ task, version, record, review })).toBe(before);
  });

  it("embeds a machine-readable snapshot whose fingerprint can be reproduced", () => {
    const { task, version, record } = fixture();
    const report = generateEvaluationHtmlReport({
      projectName: "指纹测试",
      task,
      record,
      evaluatorVersions: [version],
      reviewEvents: [],
      generatedAt,
    });
    const encoded = report.html.match(
      /<script id="report-snapshot" type="application\/json">([\s\S]*?)<\/script>/
    )?.[1];
    expect(encoded).toBeTruthy();
    const envelope = JSON.parse(encoded!) as {
      fingerprint: string;
      payload: typeof report.snapshot;
    };

    expect(envelope.payload).toEqual(report.snapshot);
    expect(envelope.fingerprint).toBe(report.fingerprint);
    expect(fingerprintEvaluationHtmlReportSnapshot(envelope.payload)).toBe(
      report.fingerprint
    );
    expect(report.html).toContain("完整性校验：待校验");
    expect(report.html).toContain("完整性校验：通过");
  });

  it("redacts credential-shaped values and escapes report markup", () => {
    const { task, version, record } = fixture();
    const fakeToken = `sk-${"a".repeat(24)}`;
    task.inputs[0].prompt = `</script><img src=x onerror=alert(1)> api_key=${fakeToken}`;
    task.inputs[0].extraFields = {
      api_token: fakeToken,
      nested: { password: "report-password" },
    };
    record.results[0].summary = `<script>window.injected=true</script> ${fakeToken}`;

    const report = generateEvaluationHtmlReport({
      projectName: "<危险项目>",
      task,
      record,
      evaluatorVersions: [version],
      reviewEvents: [],
      generatedAt,
    });
    const serialized = JSON.stringify(report.snapshot);

    expect(serialized).not.toContain(fakeToken);
    expect(serialized).not.toContain("report-password");
    expect(serialized).toContain("[REDACTED]");
    expect(report.html).not.toContain(fakeToken);
    expect(report.html).not.toContain("<危险项目>");
    expect(report.html).toContain("&lt;危险项目&gt;");
    expect(report.html.match(/<script/g)).toHaveLength(2);
    expect(report.html).not.toMatch(/<script[^>]+src=/i);
    expect(report.html).not.toMatch(/<link[^>]+stylesheet/i);
  });

  it("isolates corrupt reviews and never fabricates a damaged evaluator version", () => {
    const { task, version, record, review } = fixture();
    const tamperedReview: EvaluationReviewEvent = {
      ...review,
      note: "被修改的理由",
    };
    const report = generateEvaluationHtmlReport({
      projectName: "损坏隔离",
      task,
      record,
      evaluatorVersions: [{ ...version, name: "被篡改的版本" }],
      reviewEvents: [review, tamperedReview],
      generatedAt,
    });

    expect(report.snapshot.evaluatorVersion).toEqual({
      status: "corrupt",
      requestedId: version.id,
    });
    expect(report.snapshot.humanReview.events).toHaveLength(1);
    expect(report.snapshot.humanReview.rejectedEventCount).toBe(1);
    expect(report.html).toContain("绑定版本完整性校验失败");
    expect(report.html).not.toContain("被篡改的版本");
    expect(report.html).not.toContain("被修改的理由");
  });

  it("states unbound and missing version boundaries explicitly", () => {
    const { task, record } = fixture();
    const missing = generateEvaluationHtmlReport({
      projectName: "缺失版本",
      task,
      record,
      evaluatorVersions: [],
      reviewEvents: [],
      generatedAt,
    });
    const unbound = generateEvaluationHtmlReport({
      projectName: "未绑定版本",
      task,
      record: { ...record, evaluatorVersionId: undefined },
      evaluatorVersions: [],
      reviewEvents: [],
      generatedAt,
    });

    expect(missing.snapshot.evaluatorVersion.status).toBe("missing");
    expect(missing.html).toContain("绑定版本已删除");
    expect(unbound.snapshot.evaluatorVersion.status).toBe("unbound");
    expect(unbound.html).toContain("未绑定 Evaluator 版本");
  });

  it("rejects mismatched source tasks, invalid clocks, and cyclic unknown fields", () => {
    const { task, version, record } = fixture();
    expect(() =>
      generateEvaluationHtmlReport({
        projectName: "不匹配",
        task: { ...task, id: "another-task" },
        record,
        evaluatorVersions: [version],
        reviewEvents: [],
        generatedAt,
      })
    ).toThrow("评价记录与来源批次不匹配");
    expect(() =>
      generateEvaluationHtmlReport({
        projectName: "错误时间",
        task,
        record,
        evaluatorVersions: [version],
        reviewEvents: [],
        generatedAt: -1,
      })
    ).toThrow("报告生成时间非法");
    expect(() =>
      generateEvaluationHtmlReport({
        projectName: "超出日期范围",
        task,
        record,
        evaluatorVersions: [version],
        reviewEvents: [],
        generatedAt: Number.MAX_SAFE_INTEGER,
      })
    ).toThrow("报告生成时间非法");

    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    task.inputs[0].extraFields = cyclic;
    expect(() =>
      generateEvaluationHtmlReport({
        projectName: "循环数据",
        task,
        record,
        evaluatorVersions: [version],
        reviewEvents: [],
        generatedAt,
      })
    ).toThrow("报告数据包含循环引用");
  });

  it("changes the report fingerprint when a saved score changes", () => {
    const left = fixture();
    const right = fixture();
    right.record.results[0].scores[0].dimensionScores[0].score = 7.5;

    const leftReport = generateEvaluationHtmlReport({
      projectName: "变更检测",
      task: left.task,
      record: left.record,
      evaluatorVersions: [left.version],
      reviewEvents: [],
      generatedAt,
    });
    const rightReport = generateEvaluationHtmlReport({
      projectName: "变更检测",
      task: right.task,
      record: right.record,
      evaluatorVersions: [right.version],
      reviewEvents: [],
      generatedAt,
    });

    expect(rightReport.fingerprint).not.toBe(leftReport.fingerprint);
  });
});
