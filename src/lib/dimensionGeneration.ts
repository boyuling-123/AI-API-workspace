import type { ResultRow, TaskInput } from "@/types";
import {
  AUTO_EXPECTED_ANSWER_KEY,
  resolveExpectedAnswer,
} from "@/services/expectedAnswer";
import { redactSensitiveText } from "@/lib/redactSensitive";

export const DIMENSION_TASK_TYPES = [
  "text_generation",
  "classification",
  "extraction",
  "tool_call",
  "multimodal_qa",
  "image_generation",
  "code",
  "other",
] as const;

export type DimensionTaskType = (typeof DIMENSION_TASK_TYPES)[number];

export const DIMENSION_TASK_TYPE_LABELS: Record<DimensionTaskType, string> = {
  text_generation: "文本生成",
  classification: "分类判断",
  extraction: "信息抽取",
  tool_call: "工具调用 / JSON",
  multimodal_qa: "多模态理解",
  image_generation: "图片生成",
  code: "代码生成",
  other: "其他任务",
};

export const DIMENSION_SAMPLE_STRATEGIES = [
  "coverage",
  "failures_first",
  "expected_first",
] as const;

export type DimensionSampleStrategy =
  (typeof DIMENSION_SAMPLE_STRATEGIES)[number];

export const DIMENSION_SAMPLE_STRATEGY_LABELS: Record<
  DimensionSampleStrategy,
  string
> = {
  coverage: "覆盖首、中、尾",
  failures_first: "优先失败 Case",
  expected_first: "优先有标准答案",
};

export interface DimensionGenerationSampleOutput {
  targetId: string;
  targetName: string;
  status: "success" | "error";
  outputText?: string;
  outputImageCount: number;
  errorType?: string;
}

export interface DimensionGenerationSample {
  inputId: string;
  prompt: string;
  inputImageCount: number;
  expectedAnswer?: string;
  expectedAnswerKey?: string;
  badCaseReason?: string;
  outputs: DimensionGenerationSampleOutput[];
}

export interface DimensionGenerationRequest {
  objective: string;
  businessScenario: string;
  taskType: DimensionTaskType;
  hardRules: string[];
  samples: DimensionGenerationSample[];
}

export interface DimensionSampleCandidate {
  inputId: string;
  index: number;
  prompt: string;
  hasExpectedAnswer: boolean;
  importedBadCase: boolean;
  importedBadCaseReason: string;
  successCount: number;
  errorCount: number;
}

export const MAX_DIMENSION_SAMPLES = 8;
export const MAX_DIMENSION_OBJECTIVE_LENGTH = 2_000;
export const MAX_DIMENSION_SCENARIO_LENGTH = 1_000;
export const MAX_DIMENSION_HARD_RULES = 20;
export const MAX_DIMENSION_HARD_RULE_LENGTH = 500;
export const MAX_DIMENSION_BAD_CASE_REASON_LENGTH = 1_000;
const MAX_SAMPLE_OUTPUTS = 5;
const MAX_PROMPT_LENGTH = 2_000;
const MAX_EXPECTED_LENGTH = 2_000;
const MAX_OUTPUT_LENGTH = 3_000;

const BAD_CASE_FLAG_KEYS = [
  "is_bad_case",
  "bad_case",
  "badcase",
  "isbadcase",
  "是否坏例",
  "是否badcase",
  "是否bad_case",
] as const;

const BAD_CASE_REASON_KEYS = [
  "bad_case_reason",
  "badcase_reason",
  "badcasereason",
  "failure_reason",
  "failurereason",
  "坏例原因",
  "badcase原因",
  "bad_case_原因",
] as const;

export interface DimensionHardRulesAnalysis {
  rules: string[];
  error: string | null;
}

export function analyzeDimensionHardRules(
  value: string
): DimensionHardRulesAnalysis {
  const rawRules: string[] = [];
  const seen = new Set<string>();
  for (const rawLine of value.split(/\r?\n/)) {
    const rule = rawLine.trim();
    if (!rule) continue;
    const normalized = normalizeComparableText(rule);
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    rawRules.push(rule);
  }
  if (rawRules.length > MAX_DIMENSION_HARD_RULES) {
    return {
      rules: rawRules,
      error: `硬规则最多 ${MAX_DIMENSION_HARD_RULES} 条，请删除多余规则`,
    };
  }
  const overlongIndex = rawRules.findIndex(
    (rule) => rule.length > MAX_DIMENSION_HARD_RULE_LENGTH
  );
  if (overlongIndex >= 0) {
    return {
      rules: rawRules,
      error: `第 ${overlongIndex + 1} 条硬规则不能超过 ${MAX_DIMENSION_HARD_RULE_LENGTH} 个字符`,
    };
  }
  return { rules: redactAndDedupe(rawRules), error: null };
}

export function resolveImportedBadCase(input: TaskInput): {
  marked: boolean;
  reason: string;
} {
  const extraFields = input.extraFields ?? {};
  const normalizedEntries = Object.entries(extraFields).map(([key, value]) => [
    normalizeExtraFieldKey(key),
    value,
  ] as const);
  const reasonValue = normalizedEntries.find(([key]) =>
    BAD_CASE_REASON_KEYS.includes(key as (typeof BAD_CASE_REASON_KEYS)[number])
  )?.[1];
  const reason =
    typeof reasonValue === "string"
      ? clip(
          redactSensitiveText(reasonValue.trim()),
          MAX_DIMENSION_BAD_CASE_REASON_LENGTH
        )
      : "";
  const flagValue = normalizedEntries.find(([key]) =>
    BAD_CASE_FLAG_KEYS.includes(key as (typeof BAD_CASE_FLAG_KEYS)[number])
  )?.[1];
  return {
    marked: reason.length > 0 || isExplicitBadCaseFlag(flagValue),
    reason,
  };
}

export function listDimensionSampleCandidates(
  inputs: TaskInput[],
  results: ResultRow[],
  expectedAnswerKey: string = AUTO_EXPECTED_ANSWER_KEY
): DimensionSampleCandidate[] {
  const resultByInputId = new Map(results.map((row) => [row.inputId, row]));
  return inputs.flatMap((input, index) => {
    const row = resultByInputId.get(input.id);
    if (!row || row.items.length === 0) return [];
    const importedBadCase = resolveImportedBadCase(input);
    return [
      {
        inputId: input.id,
        index,
        prompt: input.prompt,
        hasExpectedAnswer: Boolean(
          resolveExpectedAnswer(input, expectedAnswerKey).value
        ),
        importedBadCase: importedBadCase.marked,
        importedBadCaseReason: importedBadCase.reason,
        successCount: row.items.filter((item) => item.status === "success")
          .length,
        errorCount: row.items.filter((item) => item.status === "error").length,
      },
    ];
  });
}

/** Deterministic order: endpoints first, then recursively selected midpoints. */
export function buildCoverageOrder(length: number): number[] {
  if (length <= 0) return [];
  const order: number[] = [];
  const seen = new Set<number>();
  const add = (index: number) => {
    if (index >= 0 && index < length && !seen.has(index)) {
      seen.add(index);
      order.push(index);
    }
  };

  add(0);
  add(length - 1);
  const ranges: [number, number][] = [[0, length - 1]];
  let cursor = 0;
  while (cursor < ranges.length) {
    const [start, end] = ranges[cursor];
    cursor += 1;
    if (end - start <= 1) continue;
    const midpoint = Math.floor((start + end) / 2);
    add(midpoint);
    ranges.push([start, midpoint], [midpoint, end]);
  }
  return order;
}

export function selectRepresentativeSampleIds(
  candidates: DimensionSampleCandidate[],
  strategy: DimensionSampleStrategy,
  requestedCount: number
): string[] {
  const count = Math.min(
    MAX_DIMENSION_SAMPLES,
    Math.max(1, Math.floor(Number.isFinite(requestedCount) ? requestedCount : 1))
  );
  const coverage = buildCoverageOrder(candidates.length).map(
    (index) => candidates[index]
  );
  const prioritize = (predicate: (candidate: DimensionSampleCandidate) => boolean) => [
    ...coverage.filter(predicate),
    ...coverage.filter((candidate) => !predicate(candidate)),
  ];
  const ordered =
    strategy === "failures_first"
      ? prioritize((candidate) => candidate.errorCount > 0)
      : strategy === "expected_first"
        ? prioritize((candidate) => candidate.hasExpectedAnswer)
        : coverage;
  return ordered.slice(0, count).map((candidate) => candidate.inputId);
}

export function buildDimensionGenerationSamples(params: {
  inputs: TaskInput[];
  results: ResultRow[];
  selectedInputIds: string[];
  expectedAnswerKey?: string;
  badCaseReasons?: Record<string, string>;
}): DimensionGenerationSample[] {
  const {
    inputs,
    results,
    selectedInputIds,
    expectedAnswerKey = AUTO_EXPECTED_ANSWER_KEY,
    badCaseReasons = {},
  } = params;
  const inputById = new Map(inputs.map((input) => [input.id, input]));
  const resultByInputId = new Map(results.map((row) => [row.inputId, row]));
  const uniqueIds = Array.from(new Set(selectedInputIds)).slice(
    0,
    MAX_DIMENSION_SAMPLES
  );

  return uniqueIds.flatMap((inputId) => {
    const input = inputById.get(inputId);
    const row = resultByInputId.get(inputId);
    if (!input || !row || row.items.length === 0) return [];
    const expected = resolveExpectedAnswer(input, expectedAnswerKey);
    const badCaseReason = badCaseReasons[inputId]?.trim();
    const outputs = row.items
      .filter((item) => item.status === "success" || item.status === "error")
      .slice(0, MAX_SAMPLE_OUTPUTS)
      .map((item) => ({
        targetId: item.targetId,
        targetName: item.targetName,
        status: item.status as "success" | "error",
        outputText:
          item.status === "success"
            ? redactAndClip(item.outputText, MAX_OUTPUT_LENGTH)
            : undefined,
        outputImageCount: item.outputImages?.length ?? 0,
        errorType: item.status === "error" ? item.errorType : undefined,
      }));
    if (outputs.length === 0) return [];
    return [
      {
        inputId: input.id,
        prompt: redactAndClip(input.prompt, MAX_PROMPT_LENGTH) ?? "",
        inputImageCount: input.images.length,
        expectedAnswer: expected.value
          ? redactAndClip(expected.value, MAX_EXPECTED_LENGTH)
          : undefined,
        expectedAnswerKey: expected.key ?? undefined,
        badCaseReason: badCaseReason
          ? redactAndClip(
              badCaseReason,
              MAX_DIMENSION_BAD_CASE_REASON_LENGTH
            )
          : undefined,
        outputs,
      },
    ];
  });
}

export class DimensionGenerationValidationError extends Error {}

export function parseDimensionGenerationRequest(
  value: unknown
): DimensionGenerationRequest {
  if (!value || typeof value !== "object") {
    throw new DimensionGenerationValidationError("维度生成请求必须是对象");
  }
  const raw = value as Record<string, unknown>;
  const objective = redactSensitiveText(
    requiredText(raw.objective, "评测目标", MAX_DIMENSION_OBJECTIVE_LENGTH)
  );
  const businessScenario = redactSensitiveText(
    requiredText(raw.businessScenario, "业务场景", MAX_DIMENSION_SCENARIO_LENGTH)
  );
  if (
    typeof raw.taskType !== "string" ||
    !DIMENSION_TASK_TYPES.includes(raw.taskType as DimensionTaskType)
  ) {
    throw new DimensionGenerationValidationError("请选择有效的任务类型");
  }
  const hardRules = parseHardRules(raw.hardRules);
  if (!Array.isArray(raw.samples) || raw.samples.length === 0) {
    throw new DimensionGenerationValidationError("请至少选择 1 条代表性样本");
  }
  if (raw.samples.length > MAX_DIMENSION_SAMPLES) {
    throw new DimensionGenerationValidationError(
      `代表性样本最多 ${MAX_DIMENSION_SAMPLES} 条`
    );
  }

  const samples = raw.samples.map((sample, index) =>
    parseSample(sample, index)
  );
  if (new Set(samples.map((sample) => sample.inputId)).size !== samples.length) {
    throw new DimensionGenerationValidationError("代表性样本 inputId 不能重复");
  }
  return {
    objective,
    businessScenario,
    taskType: raw.taskType as DimensionTaskType,
    hardRules,
    samples,
  };
}

function parseSample(value: unknown, index: number): DimensionGenerationSample {
  if (!value || typeof value !== "object") {
    throw new DimensionGenerationValidationError(`第 ${index + 1} 条样本格式无效`);
  }
  const raw = value as Record<string, unknown>;
  const inputId = requiredText(raw.inputId, "样本 inputId", 200);
  const prompt = redactSensitiveText(
    requiredText(raw.prompt, "样本 prompt", MAX_PROMPT_LENGTH)
  );
  if (!Array.isArray(raw.outputs) || raw.outputs.length === 0) {
    throw new DimensionGenerationValidationError(
      `第 ${index + 1} 条样本缺少模型或算法输出`
    );
  }
  if (raw.outputs.length > MAX_SAMPLE_OUTPUTS) {
    throw new DimensionGenerationValidationError(
      `每条样本最多 ${MAX_SAMPLE_OUTPUTS} 个目标输出`
    );
  }
  const outputs = raw.outputs.map((output, outputIndex) => {
    if (!output || typeof output !== "object") {
      throw new DimensionGenerationValidationError(
        `第 ${index + 1} 条样本的第 ${outputIndex + 1} 个输出格式无效`
      );
    }
    const item = output as Record<string, unknown>;
    const status = item.status;
    if (status !== "success" && status !== "error") {
      throw new DimensionGenerationValidationError("样本输出状态必须为 success 或 error");
    }
    return {
      targetId: requiredText(item.targetId, "目标 id", 200),
      targetName: requiredText(item.targetName, "目标名称", 300),
      status,
      outputText:
        status === "success" && typeof item.outputText === "string"
          ? redactAndClip(item.outputText, MAX_OUTPUT_LENGTH)
          : undefined,
      outputImageCount: boundedInteger(item.outputImageCount, 0, 100),
      errorType:
        status === "error" && typeof item.errorType === "string"
          ? redactAndClip(item.errorType, 100)
          : undefined,
    } satisfies DimensionGenerationSampleOutput;
  });

  let badCaseReason: string | undefined;
  if (raw.badCaseReason !== undefined) {
    badCaseReason = redactSensitiveText(
      requiredText(
        raw.badCaseReason,
        `第 ${index + 1} 条样本的 Bad Case 原因`,
        MAX_DIMENSION_BAD_CASE_REASON_LENGTH
      )
    );
  }

  return {
    inputId,
    prompt,
    inputImageCount: boundedInteger(raw.inputImageCount, 0, 100),
    expectedAnswer:
      typeof raw.expectedAnswer === "string"
        ? redactAndClip(raw.expectedAnswer, MAX_EXPECTED_LENGTH)
        : undefined,
    expectedAnswerKey:
      typeof raw.expectedAnswerKey === "string"
        ? clip(raw.expectedAnswerKey, 200) || undefined
        : undefined,
    badCaseReason,
    outputs,
  };
}

function parseHardRules(value: unknown): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) {
    throw new DimensionGenerationValidationError("硬规则必须是字符串数组");
  }
  if (value.length > MAX_DIMENSION_HARD_RULES) {
    throw new DimensionGenerationValidationError(
      `硬规则最多 ${MAX_DIMENSION_HARD_RULES} 条`
    );
  }
  const rawRules = value.map((rule, index) =>
    requiredText(
      rule,
      `第 ${index + 1} 条硬规则`,
      MAX_DIMENSION_HARD_RULE_LENGTH
    )
  );
  const normalized = rawRules.map(normalizeComparableText);
  if (new Set(normalized).size !== normalized.length) {
    throw new DimensionGenerationValidationError("硬规则不能重复");
  }
  return redactAndDedupe(rawRules);
}

function requiredText(value: unknown, label: string, maxLength: number): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new DimensionGenerationValidationError(`${label}不能为空`);
  }
  const trimmed = value.trim();
  if (trimmed.length > maxLength) {
    throw new DimensionGenerationValidationError(
      `${label}不能超过 ${maxLength} 个字符`
    );
  }
  return trimmed;
}

function boundedInteger(value: unknown, min: number, max: number): number {
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(number)) return min;
  return Math.min(max, Math.max(min, Math.floor(number)));
}

function clip(value: string, maxLength: number): string {
  return value.slice(0, maxLength);
}

function redactAndClip(
  value: string | null | undefined,
  maxLength: number
): string | undefined {
  if (typeof value !== "string") return undefined;
  return clip(redactSensitiveText(value), maxLength) || undefined;
}

function redactAndDedupe(values: string[]): string[] {
  const redacted: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    const safeValue = redactSensitiveText(value);
    const normalized = normalizeComparableText(safeValue);
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    redacted.push(safeValue);
  }
  return redacted;
}

function normalizeComparableText(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function normalizeExtraFieldKey(value: string): string {
  return value.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

function isExplicitBadCaseFlag(value: unknown): boolean {
  if (value === true || value === 1) return true;
  if (typeof value !== "string") return false;
  return ["true", "1", "yes", "y", "是", "坏例", "bad"].includes(
    value.trim().toLowerCase()
  );
}
