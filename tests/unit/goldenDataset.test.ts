import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import {
  cloneGoldenDatasetCases,
  createGoldenDatasetVersion,
  isGoldenDatasetVersionIntact,
} from "@/lib/goldenDataset";
import {
  parseGoldenDatasetJsonText,
  parseGoldenDatasetRows,
  parseGoldenDatasetWorkbook,
} from "@/services/goldenDatasetFile";

describe("golden dataset import", () => {
  it("maps bilingual columns and normalizes human labels without guessing unknown fields", () => {
    const result = parseGoldenDatasetRows([
      {
        case_id: "gold-001",
        prompt: "判断退款规则",
        model_output: "支持七天无理由退款",
        gold_answer: "未拆封商品支持七天无理由退款",
        human_label: "通过",
        human_score: 9,
        owner: "业务专家 A",
      },
      {
        case_id: "gold-002",
        prompt: "判断发货承诺",
        model_output: "一定当天发货",
        gold_answer: "以商品页承诺时效为准",
        human_label: 0,
        human_score: "2.5",
        owner: "业务专家 B",
      },
    ]);

    expect(result.issues).toEqual([]);
    expect(result.cases).toEqual([
      {
        caseId: "gold-001",
        prompt: "判断退款规则",
        candidateOutput: "支持七天无理由退款",
        expectedAnswer: "未拆封商品支持七天无理由退款",
        humanLabel: "pass",
        humanScore: 9,
        reviewerNote: undefined,
      },
      {
        caseId: "gold-002",
        prompt: "判断发货承诺",
        candidateOutput: "一定当天发货",
        expectedAnswer: "以商品页承诺时效为准",
        humanLabel: "fail",
        humanScore: 2.5,
        reviewerNote: undefined,
      },
    ]);
    expect(result.unmappedColumns).toEqual(["owner"]);
    expect(
      result.mappings.find((mapping) => mapping.field === "candidateOutput")
    ).toMatchObject({ sourceColumn: "model_output", required: true });
  });

  it("reports missing columns, duplicate ids, invalid labels, and out-of-range scores", () => {
    const missing = parseGoldenDatasetRows([
      { case_id: "gold-001", prompt: "问题", human_label: "pass" },
    ]);
    expect(missing.issues.map((issue) => issue.message)).toContain(
      "缺少必填列：候选输出"
    );

    const invalid = parseGoldenDatasetRows([
      {
        case_id: "same-id",
        prompt: "问题 A",
        candidate_output: "回答 A",
        human_label: "pass",
        human_score: 8,
      },
      {
        case_id: "same-id",
        prompt: "问题 B",
        candidate_output: "回答 B",
        human_label: "maybe",
        human_score: 11,
      },
    ]);
    expect(invalid.cases).toHaveLength(1);
    expect(invalid.issues.map((issue) => issue.message)).toEqual(
      expect.arrayContaining([
        "Case ID 重复：same-id",
        "无法识别人工标签“maybe”，仅支持 pass/fail、通过/不通过或 1/0",
        "人工分数必须在 0 到 10 之间",
      ])
    );
  });

  it("accepts only explicit JSON arrays or items/data containers", () => {
    const valid = parseGoldenDatasetJsonText(
      JSON.stringify({
        items: [
          {
            case_id: "gold-json",
            input: "输入",
            output: "输出",
            label: true,
          },
        ],
      })
    );
    expect(valid.cases[0]).toMatchObject({
      caseId: "gold-json",
      humanLabel: "pass",
    });

    const invalid = parseGoldenDatasetJsonText(
      JSON.stringify({ case_id: "not-an-array" })
    );
    expect(invalid.cases).toEqual([]);
    expect(invalid.issues[0].message).toContain("JSON 顶层必须是数组");
  });

  it("parses a real Excel workbook through the same strict field mapping", () => {
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.aoa_to_sheet([
        ["case_id", "prompt", "candidate_output", "human_label"],
        ["excel-001", "输入", "候选输出", "fail"],
      ]),
      "golden_cases"
    );
    const buffer = XLSX.write(workbook, {
      type: "array",
      bookType: "xlsx",
    }) as ArrayBuffer;
    const result = parseGoldenDatasetWorkbook(buffer);

    expect(result.issues).toEqual([]);
    expect(result.cases).toEqual([
      {
        caseId: "excel-001",
        prompt: "输入",
        candidateOutput: "候选输出",
        expectedAnswer: undefined,
        humanLabel: "fail",
        humanScore: undefined,
        reviewerNote: undefined,
      },
    ]);
  });
});

describe("golden dataset versions", () => {
  const cases = [
    {
      caseId: "gold-001",
      prompt: "判断客服回复",
      candidateOutput: "可以直接退款",
      expectedAnswer: "需要核对订单状态后退款",
      humanLabel: "fail" as const,
      humanScore: 2,
      reviewerNote: "遗漏订单状态校验",
    },
  ];

  it("creates an isolated immutable v1 snapshot", () => {
    const version = createGoldenDatasetVersion({
      existingVersions: [],
      id: "gold-version-1",
      name: " 客服黄金集 ",
      createTime: 100,
      createdBy: " Lu ",
      sourceFileName: "golden.xlsx",
      cases,
    });

    expect(version).toMatchObject({
      id: "gold-version-1",
      version: 1,
      name: "客服黄金集",
      createdBy: "Lu",
      sourceFileName: "golden.xlsx",
    });
    expect(version.datasetId).toBeTruthy();
    expect(isGoldenDatasetVersionIntact(version)).toBe(true);

    cases[0].candidateOutput = "外部修改";
    expect(version.cases[0].candidateOutput).toBe("可以直接退款");
  });

  it("appends v2 without changing v1 and requires a change note", () => {
    const v1 = createGoldenDatasetVersion({
      existingVersions: [],
      id: "gold-version-1",
      name: "客服黄金集",
      createTime: 100,
      createdBy: "Lu",
      cases,
    });
    const v1Snapshot = JSON.stringify(v1);

    expect(() =>
      createGoldenDatasetVersion({
        existingVersions: [v1],
        datasetId: v1.datasetId,
        id: "gold-version-2",
        name: "客服黄金集",
        createdBy: "Reviewer",
        cases: [{ ...cases[0], humanLabel: "pass" }],
      })
    ).toThrow("追加黄金集版本时必须填写变更说明");

    const v2 = createGoldenDatasetVersion({
      existingVersions: [v1],
      datasetId: v1.datasetId,
      id: "gold-version-2",
      name: "客服黄金集",
      createTime: 200,
      createdBy: "Reviewer",
      changeNote: "业务复核后修正标签",
      cases: [{ ...cases[0], humanLabel: "pass" }],
    });
    expect(v2).toMatchObject({
      datasetId: v1.datasetId,
      version: 2,
      changeNote: "业务复核后修正标签",
    });
    expect(v2.cases[0].humanLabel).toBe("pass");
    expect(JSON.stringify(v1)).toBe(v1Snapshot);
  });

  it("blocks missing families and detects snapshot tampering", () => {
    const v1 = createGoldenDatasetVersion({
      existingVersions: [],
      id: "gold-version-1",
      name: "客服黄金集",
      createdBy: "Lu",
      cases,
    });
    expect(() =>
      createGoldenDatasetVersion({
        existingVersions: [],
        datasetId: "missing-family",
        name: "客服黄金集",
        createdBy: "Lu",
        changeNote: "尝试伪造家族",
        cases,
      })
    ).toThrow("要追加版本的黄金集不存在或已损坏");

    const tampered = {
      ...v1,
      cases: [{ ...v1.cases[0], humanLabel: "pass" as const }],
    };
    expect(isGoldenDatasetVersionIntact(tampered)).toBe(false);
    expect(() => cloneGoldenDatasetCases(tampered)).toThrow(
      "黄金集版本完整性校验失败"
    );
  });

  it("redacts credentials before locking human truth", () => {
    const version = createGoldenDatasetVersion({
      existingVersions: [],
      name: "客服黄金集 token=private-token-value",
      createdBy: "Lu",
      changeNote: "authorization=private-auth-value",
      cases: [
        {
          ...cases[0],
          prompt: "检查 api_key=real-secret-value 后判断",
        },
      ],
    });
    const serialized = JSON.stringify(version);
    expect(serialized).toContain("[REDACTED]");
    expect(serialized).not.toContain("private-token-value");
    expect(serialized).not.toContain("real-secret-value");
    expect(isGoldenDatasetVersionIntact(version)).toBe(true);
  });
});
