import * as XLSX from "xlsx";
import type {
  GoldenDatasetCase,
  GoldenHumanLabel,
} from "@/types";
import { MAX_GOLDEN_DATASET_CASES } from "@/lib/goldenDataset";
import { formatTimestamp } from "@/lib/datetime";

export type GoldenDatasetField =
  | "caseId"
  | "prompt"
  | "candidateOutput"
  | "expectedAnswer"
  | "humanLabel"
  | "humanScore"
  | "reviewerNote";

export interface GoldenDatasetColumnMapping {
  field: GoldenDatasetField;
  label: string;
  sourceColumn: string | null;
  required: boolean;
}

export interface GoldenDatasetImportIssue {
  rowNumber: number;
  field: GoldenDatasetField | "file";
  message: string;
}

export interface GoldenDatasetImportResult {
  cases: GoldenDatasetCase[];
  totalRows: number;
  mappings: GoldenDatasetColumnMapping[];
  unmappedColumns: string[];
  issues: GoldenDatasetImportIssue[];
}

const FIELD_DEFINITIONS: {
  field: GoldenDatasetField;
  label: string;
  required: boolean;
  aliases: string[];
}[] = [
  {
    field: "caseId",
    label: "Case ID",
    required: true,
    aliases: ["case_id", "caseid", "id", "样本id", "case编号"],
  },
  {
    field: "prompt",
    label: "输入",
    required: true,
    aliases: ["prompt", "input", "question", "输入", "问题"],
  },
  {
    field: "candidateOutput",
    label: "候选输出",
    required: true,
    aliases: [
      "candidate_output",
      "model_output",
      "output",
      "response",
      "候选输出",
      "模型输出",
    ],
  },
  {
    field: "expectedAnswer",
    label: "标准答案",
    required: false,
    aliases: [
      "expected_answer",
      "gold_answer",
      "reference_answer",
      "expected_output",
      "标准答案",
      "参考答案",
    ],
  },
  {
    field: "humanLabel",
    label: "人工标签",
    required: true,
    aliases: ["human_label", "label", "human_judgment", "人工标签", "人工判断"],
  },
  {
    field: "humanScore",
    label: "人工分数",
    required: false,
    aliases: ["human_score", "score", "人工分数", "人工评分"],
  },
  {
    field: "reviewerNote",
    label: "复核说明",
    required: false,
    aliases: ["reviewer_note", "note", "comment", "复核说明", "标注说明"],
  },
];

function normalizeColumn(value: string): string {
  return value.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

function textValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value).trim();
  }
  return JSON.stringify(value);
}

function parseLabel(value: string): GoldenHumanLabel | null {
  const normalized = value.trim().toLowerCase();
  if (["pass", "通过", "合格", "1", "true", "yes"].includes(normalized)) {
    return "pass";
  }
  if (["fail", "不通过", "不合格", "0", "false", "no"].includes(normalized)) {
    return "fail";
  }
  return null;
}

function collectHeaders(rows: Record<string, unknown>[]): string[] {
  const headers = new Set<string>();
  for (const row of rows) {
    for (const key of Object.keys(row)) headers.add(key);
  }
  return Array.from(headers);
}

export function parseGoldenDatasetRows(
  rows: Record<string, unknown>[]
): GoldenDatasetImportResult {
  const nonEmptyRows = rows.filter((row) =>
    Object.values(row).some((value) => textValue(value) !== "")
  );
  const headers = collectHeaders(nonEmptyRows);
  const normalizedHeaders = new Map(
    headers.map((header) => [normalizeColumn(header), header])
  );
  const mappings = FIELD_DEFINITIONS.map((definition) => ({
    field: definition.field,
    label: definition.label,
    required: definition.required,
    sourceColumn:
      definition.aliases
        .map(normalizeColumn)
        .map((alias) => normalizedHeaders.get(alias))
        .find(Boolean) ?? null,
  }));
  const mappedColumns = new Set(
    mappings
      .map((mapping) => mapping.sourceColumn)
      .filter((column): column is string => Boolean(column))
  );
  const issues: GoldenDatasetImportIssue[] = mappings
    .filter((mapping) => mapping.required && !mapping.sourceColumn)
    .map((mapping) => ({
      rowNumber: 1,
      field: mapping.field,
      message: `缺少必填列：${mapping.label}`,
    }));

  if (nonEmptyRows.length > MAX_GOLDEN_DATASET_CASES) {
    issues.push({
      rowNumber: 1,
      field: "file",
      message: `黄金集最多支持 ${MAX_GOLDEN_DATASET_CASES} 条，当前为 ${nonEmptyRows.length} 条`,
    });
  }

  const mappingByField = new Map(
    mappings.map((mapping) => [mapping.field, mapping.sourceColumn] as const)
  );
  const read = (row: Record<string, unknown>, field: GoldenDatasetField) => {
    const column = mappingByField.get(field);
    return column ? textValue(row[column]) : "";
  };
  const cases: GoldenDatasetCase[] = [];
  const seenIds = new Set<string>();

  nonEmptyRows.slice(0, MAX_GOLDEN_DATASET_CASES).forEach((row, index) => {
    const rowNumber = index + 2;
    const caseId = read(row, "caseId");
    const prompt = read(row, "prompt");
    const candidateOutput = read(row, "candidateOutput");
    const expectedAnswer = read(row, "expectedAnswer");
    const humanLabelRaw = read(row, "humanLabel");
    const humanLabel = parseLabel(humanLabelRaw);
    const humanScoreRaw = read(row, "humanScore");
    const reviewerNote = read(row, "reviewerNote");
    let rowValid = true;

    const requiredValues: [GoldenDatasetField, string, string][] = [
      ["caseId", "Case ID", caseId],
      ["prompt", "输入", prompt],
      ["candidateOutput", "候选输出", candidateOutput],
      ["humanLabel", "人工标签", humanLabelRaw],
    ];
    for (const [field, label, value] of requiredValues) {
      if (!value) {
        issues.push({ rowNumber, field, message: `${label}不能为空` });
        rowValid = false;
      }
    }
    if (caseId && seenIds.has(caseId)) {
      issues.push({
        rowNumber,
        field: "caseId",
        message: `Case ID 重复：${caseId}`,
      });
      rowValid = false;
    }
    if (caseId) seenIds.add(caseId);
    if (humanLabelRaw && !humanLabel) {
      issues.push({
        rowNumber,
        field: "humanLabel",
        message: `无法识别人工标签“${humanLabelRaw}”，仅支持 pass/fail、通过/不通过或 1/0`,
      });
      rowValid = false;
    }
    let humanScore: number | undefined;
    if (humanScoreRaw) {
      humanScore = Number(humanScoreRaw);
      if (!Number.isFinite(humanScore) || humanScore < 0 || humanScore > 10) {
        issues.push({
          rowNumber,
          field: "humanScore",
          message: "人工分数必须在 0 到 10 之间",
        });
        rowValid = false;
      }
    }
    if (rowValid && humanLabel) {
      cases.push({
        caseId,
        prompt,
        candidateOutput,
        expectedAnswer: expectedAnswer || undefined,
        humanLabel,
        humanScore,
        reviewerNote: reviewerNote || undefined,
      });
    }
  });

  return {
    cases,
    totalRows: nonEmptyRows.length,
    mappings,
    unmappedColumns: headers.filter((header) => !mappedColumns.has(header)),
    issues,
  };
}

function parseJsonRecords(jsonText: string, fileName: string): unknown[] {
  if (fileName.toLowerCase().endsWith(".jsonl")) {
    return jsonText
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line, index) => {
        try {
          return JSON.parse(line) as unknown;
        } catch {
          throw new Error(`JSONL 第 ${index + 1} 行不是合法 JSON`);
        }
      });
  }
  const parsed = JSON.parse(jsonText) as unknown;
  if (Array.isArray(parsed)) return parsed;
  if (parsed && typeof parsed === "object") {
    const container = parsed as Record<string, unknown>;
    if (Array.isArray(container.items)) return container.items;
    if (Array.isArray(container.data)) return container.data;
  }
  throw new Error("JSON 顶层必须是数组，或包含 items/data 数组");
}

export function parseGoldenDatasetJsonText(
  jsonText: string,
  fileName = "golden-dataset.json"
): GoldenDatasetImportResult {
  let records: unknown[];
  try {
    records = parseJsonRecords(jsonText, fileName);
  } catch (error) {
    return {
      cases: [],
      totalRows: 0,
      mappings: FIELD_DEFINITIONS.map((definition) => ({
        field: definition.field,
        label: definition.label,
        required: definition.required,
        sourceColumn: null,
      })),
      unmappedColumns: [],
      issues: [
        {
          rowNumber: 1,
          field: "file",
          message: error instanceof Error ? error.message : "JSON 解析失败",
        },
      ],
    };
  }
  const rows: Record<string, unknown>[] = [];
  const shapeIssues: GoldenDatasetImportIssue[] = [];
  records.forEach((record, index) => {
    if (!record || typeof record !== "object" || Array.isArray(record)) {
      shapeIssues.push({
        rowNumber: index + 1,
        field: "file",
        message: "每条 JSON 数据必须是字段对象",
      });
      return;
    }
    rows.push(record as Record<string, unknown>);
  });
  const result = parseGoldenDatasetRows(rows);
  return { ...result, totalRows: records.length, issues: [...shapeIssues, ...result.issues] };
}

export function parseGoldenDatasetWorkbook(
  fileBuffer: ArrayBuffer
): GoldenDatasetImportResult {
  try {
    const workbook = XLSX.read(fileBuffer, { type: "array" });
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    if (!firstSheet) throw new Error("工作簿没有可读取的 Sheet");
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(firstSheet, {
      defval: "",
    });
    return parseGoldenDatasetRows(rows);
  } catch (error) {
    return {
      cases: [],
      totalRows: 0,
      mappings: FIELD_DEFINITIONS.map((definition) => ({
        field: definition.field,
        label: definition.label,
        required: definition.required,
        sourceColumn: null,
      })),
      unmappedColumns: [],
      issues: [
        {
          rowNumber: 1,
          field: "file",
          message: error instanceof Error ? error.message : "表格解析失败",
        },
      ],
    };
  }
}

export function downloadGoldenDatasetTemplate(projectName: string): void {
  const columns = [
    "case_id",
    "prompt",
    "candidate_output",
    "expected_answer",
    "human_label",
    "human_score",
    "reviewer_note",
  ];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet([columns]),
    "golden_cases"
  );
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet([
      ["字段", "必填", "说明"],
      ["case_id", "是", "稳定且唯一的 Case ID"],
      ["prompt", "是", "原始输入或问题"],
      ["candidate_output", "是", "交给 Judge 判定的候选输出"],
      ["expected_answer", "否", "可选标准答案"],
      ["human_label", "是", "pass/fail、通过/不通过或 1/0"],
      ["human_score", "否", "0 到 10"],
      ["reviewer_note", "否", "人工标注依据"],
    ]),
    "字段说明"
  );
  XLSX.writeFile(
    workbook,
    `${sanitizeFileName(projectName)}_黄金集模板_${formatTimestamp()}.xlsx`
  );
}

function sanitizeFileName(value: string): string {
  return (value.trim() || "未命名项目").replace(/[\\/:*?"<>|]/g, "_");
}
