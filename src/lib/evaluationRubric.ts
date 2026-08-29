import { redactSensitiveText } from "@/lib/redactSensitive";
import type { EvalDimension, EvalDimensionScoreLevel } from "@/types";

export const REQUIRED_RUBRIC_SCORES = [0, 5, 10] as const;
export const MAX_EVALUATION_RUBRICS = 15;
export const MAX_RUBRIC_NAME_LENGTH = 80;
export const MAX_RUBRIC_DEFINITION_LENGTH = 600;
export const MAX_RUBRIC_CRITERIA_LENGTH = 600;
export const MAX_RUBRIC_EVIDENCE_ITEMS = 5;
export const MAX_RUBRIC_EVIDENCE_LENGTH = 400;
export const MAX_RUBRIC_JUDGE_INSTRUCTION_LENGTH = 800;

export interface EvaluationRubricIssue {
  field:
    | "name"
    | "definition"
    | "scoreLevels"
    | "evidenceRequirements"
    | "judgeInstruction";
  message: string;
}

export interface EvaluationRubricAnalysis {
  dimension?: EvalDimension;
  issues: EvaluationRubricIssue[];
}

export class EvaluationRubricValidationError extends Error {}

export function normalizeEvaluationRubricName(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

export function createEmptyEvaluationRubric(): EvalDimension {
  return {
    name: "",
    desc: "",
    scoreLevels: REQUIRED_RUBRIC_SCORES.map((score) => ({
      score,
      criteria: "",
    })),
    evidenceRequirements: [],
    judgeInstruction: "",
  };
}

/** Builds a complete fallback rubric for trusted built-in defaults, not AI output. */
export function createDefinitionBasedRubric(
  name: string,
  definition: string
): EvalDimension {
  return {
    name,
    desc: definition,
    scoreLevels: [
      {
        score: 0,
        criteria: `完全不满足“${name}”：存在关键错误、明显违规或结果不可用。`,
      },
      {
        score: 5,
        criteria: `部分满足“${name}”，但仍有影响使用的明显缺陷。`,
      },
      {
        score: 10,
        criteria: `完全满足“${name}”：${definition}，且没有可见缺陷。`,
      },
    ],
    evidenceRequirements: [
      `指出输出中直接支持或违反“${name}”定义的具体内容；若关键内容缺失，明确说明缺失项。`,
    ],
    judgeInstruction:
      "先定位可核验的输出证据，再与 0/5/10 评分锚点比较；介于锚点时按缺陷严重度给出 0–10 分，最多 1 位小数。",
  };
}

export function analyzeEvaluationRubric(
  value: unknown
): EvaluationRubricAnalysis {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {
      issues: [{ field: "name", message: "Rubric 必须是对象" }],
    };
  }
  const raw = value as Record<string, unknown>;
  const issues: EvaluationRubricIssue[] = [];
  const name = readRequiredText(
    raw.name,
    "维度名称",
    MAX_RUBRIC_NAME_LENGTH,
    "name",
    issues
  );
  const definition = readRequiredText(
    raw.desc,
    "维度定义",
    MAX_RUBRIC_DEFINITION_LENGTH,
    "definition",
    issues
  );
  const scoreLevels = analyzeScoreLevels(raw.scoreLevels, issues);
  const evidenceRequirements = analyzeEvidenceRequirements(
    raw.evidenceRequirements,
    issues
  );
  const judgeInstruction = readRequiredText(
    raw.judgeInstruction,
    "可执行判断规则",
    MAX_RUBRIC_JUDGE_INSTRUCTION_LENGTH,
    "judgeInstruction",
    issues
  );

  if (issues.length > 0) return { issues };
  return {
    dimension: {
      name,
      desc: definition,
      scoreLevels,
      evidenceRequirements,
      judgeInstruction,
    },
    issues: [],
  };
}

export function parseEvaluationRubrics(
  value: unknown,
  options: {
    min?: number;
    max?: number;
    sourceLabel?: string;
  } = {}
): EvalDimension[] {
  const min = options.min ?? 1;
  const max = options.max ?? MAX_EVALUATION_RUBRICS;
  const sourceLabel = options.sourceLabel ?? "评价维度";
  if (!Array.isArray(value)) {
    throw new EvaluationRubricValidationError(`${sourceLabel}必须是数组`);
  }
  if (value.length < min) {
    throw new EvaluationRubricValidationError(
      `${sourceLabel}至少需要 ${min} 条`
    );
  }
  if (value.length > max) {
    throw new EvaluationRubricValidationError(
      `${sourceLabel}最多支持 ${max} 条`
    );
  }

  const dimensions = value.map((item, index) => {
    const analysis = analyzeEvaluationRubric(item);
    if (!analysis.dimension) {
      throw new EvaluationRubricValidationError(
        `${sourceLabel}第 ${index + 1} 条：${analysis.issues[0]?.message ?? "格式无效"}`
      );
    }
    return analysis.dimension;
  });
  const seen = new Set<string>();
  for (const dimension of dimensions) {
    const normalized = normalizeEvaluationRubricName(dimension.name);
    if (seen.has(normalized)) {
      throw new EvaluationRubricValidationError(
        `${sourceLabel}名称不能重复：${dimension.name}`
      );
    }
    seen.add(normalized);
  }
  return dimensions;
}

export function formatEvaluationRubricForPrompt(
  dimension: EvalDimension,
  index: number
): string {
  const scoreLevels = (dimension.scoreLevels ?? [])
    .map((level) => `  - ${level.score} 分：${level.criteria}`)
    .join("\n");
  const evidence = (dimension.evidenceRequirements ?? [])
    .map((item) => `  - ${item}`)
    .join("\n");
  return `${index + 1}. ${dimension.name}\n定义：${dimension.desc ?? ""}\n评分锚点：\n${scoreLevels}\n证据要求：\n${evidence}\n判断规则：${dimension.judgeInstruction ?? ""}`;
}

function readRequiredText(
  value: unknown,
  label: string,
  maxLength: number,
  field: EvaluationRubricIssue["field"],
  issues: EvaluationRubricIssue[]
): string {
  if (typeof value !== "string" || !value.trim()) {
    issues.push({ field, message: `${label}不能为空` });
    return "";
  }
  const trimmed = value.trim().replace(/\s+/g, " ");
  if (trimmed.length > maxLength) {
    issues.push({ field, message: `${label}不能超过 ${maxLength} 个字符` });
    return "";
  }
  return redactSensitiveText(trimmed);
}

function analyzeScoreLevels(
  value: unknown,
  issues: EvaluationRubricIssue[]
): EvalDimensionScoreLevel[] {
  if (!Array.isArray(value) || value.length !== REQUIRED_RUBRIC_SCORES.length) {
    issues.push({
      field: "scoreLevels",
      message: "评分分级必须完整包含 0、5、10 三个锚点",
    });
    return [];
  }
  const byScore = new Map<number, EvalDimensionScoreLevel>();
  for (const item of value) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      issues.push({ field: "scoreLevels", message: "评分锚点格式无效" });
      continue;
    }
    const raw = item as Record<string, unknown>;
    if (
      typeof raw.score !== "number" ||
      !REQUIRED_RUBRIC_SCORES.includes(
        raw.score as (typeof REQUIRED_RUBRIC_SCORES)[number]
      )
    ) {
      issues.push({
        field: "scoreLevels",
        message: "评分锚点只允许 0、5、10",
      });
      continue;
    }
    if (byScore.has(raw.score)) {
      issues.push({ field: "scoreLevels", message: "评分锚点不能重复" });
      continue;
    }
    const criteriaIssues: EvaluationRubricIssue[] = [];
    const criteria = readRequiredText(
      raw.criteria,
      `${raw.score} 分标准`,
      MAX_RUBRIC_CRITERIA_LENGTH,
      "scoreLevels",
      criteriaIssues
    );
    issues.push(...criteriaIssues);
    if (criteria) byScore.set(raw.score, { score: raw.score, criteria });
  }
  const missing = REQUIRED_RUBRIC_SCORES.filter((score) => !byScore.has(score));
  if (missing.length > 0 && !issues.some((issue) => issue.message.includes("完整包含"))) {
    issues.push({
      field: "scoreLevels",
      message: `评分分级缺少 ${missing.join("、")} 分锚点`,
    });
  }
  return REQUIRED_RUBRIC_SCORES.flatMap((score) => {
    const level = byScore.get(score);
    return level ? [level] : [];
  });
}

function analyzeEvidenceRequirements(
  value: unknown,
  issues: EvaluationRubricIssue[]
): string[] {
  if (
    !Array.isArray(value) ||
    value.length === 0 ||
    value.length > MAX_RUBRIC_EVIDENCE_ITEMS
  ) {
    issues.push({
      field: "evidenceRequirements",
      message: `证据要求必须包含 1–${MAX_RUBRIC_EVIDENCE_ITEMS} 条`,
    });
    return [];
  }
  const evidence: string[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    const itemIssues: EvaluationRubricIssue[] = [];
    const text = readRequiredText(
      item,
      "证据要求",
      MAX_RUBRIC_EVIDENCE_LENGTH,
      "evidenceRequirements",
      itemIssues
    );
    issues.push(...itemIssues);
    if (!text) continue;
    const normalized = text.toLocaleLowerCase();
    if (seen.has(normalized)) {
      issues.push({
        field: "evidenceRequirements",
        message: "证据要求不能重复",
      });
      continue;
    }
    seen.add(normalized);
    evidence.push(text);
  }
  return evidence;
}
