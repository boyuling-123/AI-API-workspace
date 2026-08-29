import * as XLSX from "xlsx";
import type { EvalDimension, ResultItem, ResultRow, TaskInput } from "@/types";
import { generateId } from "@/lib/id";
import { formatTimestamp } from "@/lib/datetime";
import { RUN_ERROR_LABELS } from "@/lib/runError";

/**
 * 批量模式基础列。算法 API 参数列将在 M8 按选中目标动态扩展。
 * 列名使用固定英文 key。
 */
export const BASE_TEMPLATE_COLUMNS = ["prompt", "image_url", "expected_output"] as const;
const STRUCTURAL_COLUMNS = new Set<string>(["prompt", "image_url"]);

export interface ImportParseResult {
  inputs: TaskInput[];
  unmatchedColumns: string[];
  warnings: string[];
}

/**
 * 下载导入模板：空表，仅含基础列。
 */
export function downloadImportTemplate(projectName: string): void {
  const worksheet = XLSX.utils.aoa_to_sheet([
    [...BASE_TEMPLATE_COLUMNS],
  ]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "inputs");
  const fileName = `${sanitizeFileName(projectName)}_模板_${formatTimestamp()}.xlsx`;
  XLSX.writeFile(workbook, fileName);
}

/**
 * 解析导入的 Excel，落位到 TaskInput。
 * prompt -> prompt；image_url -> images(source='url')；其余列暂存 extraFields。
 * 不匹配（非基础列）的列名收集到 unmatchedColumns 提示。
 */
export function parseImportedExcel(fileBuffer: ArrayBuffer): ImportParseResult {
  const workbook = XLSX.read(fileBuffer, { type: "array" });
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
    defval: "",
  });

  const warnings: string[] = [];
  const unmatchedColumns = new Set<string>();
  const inputs: TaskInput[] = rows.map((row, rowIndex) => {
    const prompt = toStringValue(row["prompt"]);
    const imageUrl = toStringValue(row["image_url"]).trim();

    const extraFields: Record<string, unknown> = {};
    for (const [columnName, rawValue] of Object.entries(row)) {
      if (STRUCTURAL_COLUMNS.has(columnName)) {
        continue;
      }
      unmatchedColumns.add(columnName);
      extraFields[columnName] = rawValue;
    }

    const input: TaskInput = {
      id: generateId(),
      prompt,
      images: imageUrl
        ? [
            {
              id: generateId(),
              name: imageUrl.split("/").pop() ?? "image",
              source: "url",
              value: imageUrl,
            },
          ]
        : [],
    };
    if (Object.keys(extraFields).length > 0) {
      input.extraFields = extraFields;
    }

    if (!prompt && !imageUrl) {
      warnings.push(`第 ${rowIndex + 2} 行 prompt 与 image_url 均为空`);
    }
    return input;
  });

  return {
    inputs,
    unmatchedColumns: Array.from(unmatchedColumns),
    warnings,
  };
}

/**
 * 解析 JSON / JSONL 微调测试集，兼容：
 * - {"messages":[{"role":"user","content":"..."},{"role":"assistant","content":"..."}]}
 * - {"prompt":"...","expected_output":"..."}
 * - JSON 数组或 {items:[...]} / {data:[...]} 包裹。
 */
export function parseImportedJsonText(
  jsonText: string,
  fileName = "dataset.jsonl"
): ImportParseResult {
  const warnings: string[] = [];
  let records: unknown[];

  try {
    records = fileName.toLowerCase().endsWith(".jsonl")
      ? parseJsonl(jsonText)
      : parseJsonRecords(jsonText);
  } catch (error) {
    const message = error instanceof Error ? error.message : "未知错误";
    return {
      inputs: [],
      unmatchedColumns: [],
      warnings: [`JSON/JSONL 解析失败：${message}`],
    };
  }

  const unmatchedColumns = new Set<string>();
  const inputs = records.map((record, index) => {
    const normalized = normalizeJsonRecord(record);
    for (const key of Object.keys(normalized.extraFields ?? {})) {
      unmatchedColumns.add(key);
    }
    if (!normalized.prompt.trim()) {
      warnings.push(`第 ${index + 1} 条 prompt 为空`);
    }
    if (!normalized.extraFields?.expected_output) {
      warnings.push(`第 ${index + 1} 条未识别到 expected_output/标准答案`);
    }
    return normalized;
  });

  return {
    inputs,
    unmatchedColumns: Array.from(unmatchedColumns),
    warnings,
  };
}

/** 把当前输入数据（TaskInput[]）导出为本地 Excel。 */
export function exportInputsToExcel(
  projectName: string,
  inputs: TaskInput[],
  fileLabel = "输入数据"
): void {
  const extraColumns: string[] = [];
  const seen = new Set<string>();
  for (const input of inputs) {
    for (const key of Object.keys(input.extraFields ?? {})) {
      if (!seen.has(key)) {
        seen.add(key);
        extraColumns.push(key);
      }
    }
  }

  const header = ["prompt", "image_url", ...extraColumns];
  const rows = inputs.map((input) => {
    const imageUrl = input.images.find((img) => img.source === "url")?.value ?? "";
    const line: (string | number)[] = [input.prompt, imageUrl];
    for (const column of extraColumns) {
      const value = input.extraFields?.[column];
      line.push(value === null || value === undefined ? "" : String(value));
    }
    return line;
  });

  const worksheet = XLSX.utils.aoa_to_sheet([header, ...rows]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "inputs");
  const fileName = `${sanitizeFileName(projectName)}_${sanitizeFileName(fileLabel)}_${formatTimestamp()}.xlsx`;
  XLSX.writeFile(workbook, fileName);
}

/** M9 评价结果（逐条；v4.5 多维度），用于在导出时追加各维度评分列。 */
export interface ExportEvaluationData {
  inputId: string;
  scores: {
    targetId: string;
    dimensionScores: { dimension: string; score: number; comment: string }[];
    overallComment?: string;
  }[];
  summary: string;
  recommendation: string;
}

export interface ExportResultsParams {
  projectName: string;
  inputs: TaskInput[];
  results: ResultRow[];
  targetIds: string[];
  /** v4.5 评价导出时的选定维度（决定每目标的维度评分列）。 */
  dimensions?: EvalDimension[];
  /** M9 可选：逐条评价结果，存在时追加每目标每维度「分/理由」+「总体结论/推荐」列（无总分）。 */
  evaluations?: ExportEvaluationData[];
  /** 文件名中部前缀，默认「结果」；板块⑤导出评价记录时传「AI评价」（v4.3）。 */
  fileNamePrefix?: string;
}

const STATUS_LABEL: Record<ResultItem["status"], string> = {
  pending: "排队",
  running: "运行中",
  success: "成功",
  error: "失败",
  interrupted: "中断",
};

/**
 * 解析每个目标的展示名：优先用结果行里的 targetName（兼容算法目标），
 * 回退到内置模型名 / targetId 本身。保证评分列与运行结果列对齐同名。
 */
function resolveTargetName(
  targetId: string,
  results: ResultRow[]
): string {
  for (const row of results) {
    const item = row.items.find((it) => it.targetId === targetId);
    if (item?.targetName && item.targetName !== targetId) {
      return item.targetName;
    }
  }
  return targetId;
}

/**
 * 确保列名唯一：若已存在同名列，追加 _2、_3… 后缀。
 */
function ensureUniqueColumn(name: string, used: Set<string>): string {
  if (!used.has(name)) {
    used.add(name);
    return name;
  }
  let suffix = 2;
  let candidate = `${name}_${suffix}`;
  while (used.has(candidate)) {
    suffix += 1;
    candidate = `${name}_${suffix}`;
  }
  used.add(candidate);
  return candidate;
}

/**
 * 导出运行结果为 Excel。每行一条输入，固定列（序号/prompt/image_url）+
 * 每个目标六列（输出 / 状态 / 失败类型 / 尝试次数 / HTTP 状态 / 耗时(s)）。
 * 传入 evaluations 时，在原列之后追加：每目标「评分/点评」+ 每行「总体结论/推荐」，
 * 不改动 M6 原有列，列名经去重保证唯一。
 */
export function exportResultsToExcel(params: ExportResultsParams): void {
  const {
    projectName,
    inputs,
    results,
    targetIds,
    dimensions,
    evaluations,
    fileNamePrefix,
  } = params;
  const dimensionList = dimensions ?? [];

  const targetNames = targetIds.map((targetId) =>
    resolveTargetName(targetId, results)
  );

  const usedColumnNames = new Set<string>();
  const header: string[] = [];
  for (const column of ["序号", "prompt", "image_url"]) {
    header.push(ensureUniqueColumn(column, usedColumnNames));
  }
  for (const name of targetNames) {
    header.push(
      ensureUniqueColumn(`${name}_输出`, usedColumnNames),
      ensureUniqueColumn(`${name}_状态`, usedColumnNames),
      ensureUniqueColumn(`${name}_失败类型`, usedColumnNames),
      ensureUniqueColumn(`${name}_尝试次数`, usedColumnNames),
      ensureUniqueColumn(`${name}_HTTP状态`, usedColumnNames),
      ensureUniqueColumn(`${name}_耗时(s)`, usedColumnNames)
    );
  }

  const hasEvaluation = Array.isArray(evaluations) && evaluations.length > 0;
  if (hasEvaluation) {
    // v4.5：每目标 × 每维度两列「分/理由」，再加每目标一列「总体点评」，无总分列。
    for (const name of targetNames) {
      for (const dimension of dimensionList) {
        header.push(
          ensureUniqueColumn(`${name}_${dimension.name}_分`, usedColumnNames),
          ensureUniqueColumn(`${name}_${dimension.name}_理由`, usedColumnNames)
        );
      }
      header.push(ensureUniqueColumn(`${name}_总体点评`, usedColumnNames));
    }
    header.push(
      ensureUniqueColumn("总体结论", usedColumnNames),
      ensureUniqueColumn("推荐项", usedColumnNames)
    );
  }

  const inputById = new Map(inputs.map((input) => [input.id, input]));
  const evaluationByInputId = new Map(
    (evaluations ?? []).map((evaluation) => [evaluation.inputId, evaluation])
  );

  const rows: (string | number)[][] = results.map((row, rowIndex) => {
    const input = inputById.get(row.inputId);
    const imageUrl = input?.images.find((img) => img.source === "url")?.value ?? "";
    const line: (string | number)[] = [
      rowIndex + 1,
      input?.prompt ?? "",
      imageUrl,
    ];

    for (const targetId of targetIds) {
      const item = row.items.find((it) => it.targetId === targetId);
      line.push(
        formatOutputCell(item),
        item ? STATUS_LABEL[item.status] : "—",
        item?.errorType ? RUN_ERROR_LABELS[item.errorType] : "",
        item?.attemptCount ?? "",
        item?.httpStatus ?? "",
        formatLatencyCell(item)
      );
    }

    if (hasEvaluation) {
      const evaluation = evaluationByInputId.get(row.inputId);
      const scoreByTargetId = new Map(
        (evaluation?.scores ?? []).map((score) => [score.targetId, score])
      );
      for (const targetId of targetIds) {
        const score = scoreByTargetId.get(targetId);
        const dimScoreByName = new Map(
          (score?.dimensionScores ?? []).map((dim) => [dim.dimension, dim])
        );
        for (const dimension of dimensionList) {
          const cell = dimScoreByName.get(dimension.name);
          line.push(cell ? cell.score.toFixed(1) : "", cell?.comment ?? "");
        }
        line.push(score?.overallComment ?? "");
      }
      line.push(evaluation?.summary ?? "", evaluation?.recommendation ?? "");
    }

    return line;
  });

  const worksheet = XLSX.utils.aoa_to_sheet([header, ...rows]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "results");
  const prefix = fileNamePrefix ?? "结果";
  const fileName = `${sanitizeFileName(projectName)}_${prefix}_${formatTimestamp()}.xlsx`;
  XLSX.writeFile(workbook, fileName);
}

function formatOutputCell(item?: ResultItem): string {
  if (!item) {
    return "";
  }
  if (item.status === "error" || item.status === "interrupted") {
    return `[${STATUS_LABEL[item.status]}] ${item.error ?? ""}`.trim();
  }
  const text = item.outputText ?? "";
  const images = item.outputImages ?? [];
  if (images.length === 0) {
    return text;
  }
  return [text, `图片: ${images.join(", ")}`].filter(Boolean).join("\n");
}

function parseJsonl(jsonText: string): unknown[] {
  return jsonText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      try {
        return JSON.parse(line) as unknown;
      } catch {
        throw new Error(`第 ${index + 1} 行不是合法 JSON`);
      }
    });
}

function parseJsonRecords(jsonText: string): unknown[] {
  const parsed = JSON.parse(jsonText) as unknown;
  if (Array.isArray(parsed)) return parsed;
  const obj = parsed as Record<string, unknown>;
  if (Array.isArray(obj?.items)) return obj.items;
  if (Array.isArray(obj?.data)) return obj.data;
  return [parsed];
}

function normalizeJsonRecord(raw: unknown): TaskInput {
  const obj = (raw ?? {}) as Record<string, unknown>;
  const messages = Array.isArray(obj.messages) ? obj.messages : [];
  const userMessage = [...messages]
    .reverse()
    .find((message) => readMessageRole(message) === "user");
  const assistantMessage = [...messages]
    .reverse()
    .find((message) => readMessageRole(message) === "assistant");

  const prompt =
    stringifyDatasetValue(readMessageContent(userMessage)) ||
    stringifyDatasetValue(obj.prompt) ||
    stringifyDatasetValue(obj.input) ||
    stringifyDatasetValue(obj.question) ||
    stringifyDatasetValue(obj.user);

  const expected =
    stringifyDatasetValue(readMessageContent(assistantMessage)) ||
    stringifyDatasetValue(obj.expected_output) ||
    stringifyDatasetValue(obj.expected) ||
    stringifyDatasetValue(obj.standard_answer) ||
    stringifyDatasetValue(obj.reference_answer) ||
    stringifyDatasetValue(obj.answer) ||
    stringifyDatasetValue(obj.output) ||
    stringifyDatasetValue(obj.completion);

  const imageUrl =
    stringifyDatasetValue(obj.image_url) ||
    stringifyDatasetValue(obj.image) ||
    stringifyDatasetValue(obj.imageUrl);

  const extraFields: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (
      [
        "messages",
        "prompt",
        "input",
        "question",
        "user",
        "image_url",
        "image",
        "imageUrl",
      ].includes(key)
    ) {
      continue;
    }
    extraFields[key] = value;
  }
  if (expected) {
    extraFields.expected_output = expected;
  }

  return {
    id: generateId(),
    prompt,
    images: imageUrl
      ? [
          {
            id: generateId(),
            name: imageUrl.split("/").pop() ?? "image",
            source: "url",
            value: imageUrl,
          },
        ]
      : [],
    extraFields: Object.keys(extraFields).length > 0 ? extraFields : undefined,
  };
}

function readMessageRole(message: unknown): string {
  const obj = (message ?? {}) as Record<string, unknown>;
  return typeof obj.role === "string" ? obj.role : "";
}

function readMessageContent(message: unknown): unknown {
  const obj = (message ?? {}) as Record<string, unknown>;
  return obj.content;
}

function stringifyDatasetValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value.trim();
  return JSON.stringify(value);
}

function formatLatencyCell(item?: ResultItem): string {
  if (!item || typeof item.latencyMs !== "number") {
    return "";
  }
  return (item.latencyMs / 1000).toFixed(1);
}

function toStringValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }
  return String(value);
}

function sanitizeFileName(name: string): string {
  const trimmed = name.trim() || "未命名项目";
  return trimmed.replace(/[\\/:*?"<>|]/g, "_");
}
