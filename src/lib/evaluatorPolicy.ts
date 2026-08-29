import type { EvalDimension } from "@/types";
import {
  EvaluationRubricValidationError,
  formatEvaluationRubricForPrompt,
  normalizeEvaluationRubricName,
  parseEvaluationRubrics,
} from "@/lib/evaluationRubric";

export const EVALUATOR_TOTAL_WEIGHT = 100;
export const MIN_EVALUATOR_WEIGHT = 0.01;
export const MAX_EVALUATOR_WEIGHT_DECIMALS = 2;
export const MAX_VETO_THRESHOLD_DECIMALS = 1;

export interface EvaluatorPolicyIssue {
  field: "rubric" | "weight" | "vetoThreshold" | "totalWeight";
  message: string;
  index?: number;
}

export interface EvaluatorPolicyAnalysis {
  dimensions: EvalDimension[];
  issues: EvaluatorPolicyIssue[];
  totalWeight: number;
}

export interface EvaluatorPolicyOutcome {
  weightedScore: number;
  vetoed: boolean;
  vetoReasons: string[];
}

export class EvaluatorPolicyValidationError extends Error {}

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function hasAtMostDecimals(value: number, decimals: number): boolean {
  return Math.abs(value - round(value, decimals)) < 1e-9;
}

/** Evenly allocates exactly 100.00% in basis points while preserving item fields. */
export function distributeEvenEvaluatorWeights<T extends EvalDimension>(
  dimensions: T[]
): T[] {
  if (dimensions.length === 0) return [];
  const totalBasisPoints = EVALUATOR_TOTAL_WEIGHT * 100;
  const base = Math.floor(totalBasisPoints / dimensions.length);
  const remainder = totalBasisPoints - base * dimensions.length;
  return dimensions.map((dimension, index) => ({
    ...dimension,
    weight: (base + (index < remainder ? 1 : 0)) / 100,
  }));
}

export function analyzeEvaluatorPolicy(
  value: unknown,
  options: { min?: number; max?: number; sourceLabel?: string } = {}
): EvaluatorPolicyAnalysis {
  const sourceLabel = options.sourceLabel ?? "评价策略";
  let rubrics: EvalDimension[];
  try {
    rubrics = parseEvaluationRubrics(value, {
      min: options.min,
      max: options.max,
      sourceLabel,
    });
  } catch (error) {
    return {
      dimensions: [],
      issues: [
        {
          field: "rubric",
          message:
            error instanceof EvaluationRubricValidationError
              ? error.message
              : `${sourceLabel}格式无效`,
        },
      ],
      totalWeight: 0,
    };
  }

  const rawItems = value as Record<string, unknown>[];
  const issues: EvaluatorPolicyIssue[] = [];
  const dimensions = rubrics.map((rubric, index) => {
    const raw = rawItems[index] ?? {};
    const rawWeight = raw.weight;
    let weight: number | undefined;
    if (
      typeof rawWeight !== "number" ||
      !Number.isFinite(rawWeight) ||
      rawWeight < MIN_EVALUATOR_WEIGHT ||
      rawWeight > EVALUATOR_TOTAL_WEIGHT ||
      !hasAtMostDecimals(rawWeight, MAX_EVALUATOR_WEIGHT_DECIMALS)
    ) {
      issues.push({
        field: "weight",
        index,
        message: `${sourceLabel}第 ${index + 1} 条权重必须为 ${MIN_EVALUATOR_WEIGHT}-${EVALUATOR_TOTAL_WEIGHT} 的数字，最多 ${MAX_EVALUATOR_WEIGHT_DECIMALS} 位小数`,
      });
    } else {
      weight = round(rawWeight, MAX_EVALUATOR_WEIGHT_DECIMALS);
    }

    const rawThreshold = raw.vetoThreshold;
    let vetoThreshold: number | undefined;
    if (rawThreshold !== undefined && rawThreshold !== null) {
      if (
        typeof rawThreshold !== "number" ||
        !Number.isFinite(rawThreshold) ||
        rawThreshold < 0 ||
        rawThreshold > 10 ||
        !hasAtMostDecimals(rawThreshold, MAX_VETO_THRESHOLD_DECIMALS)
      ) {
        issues.push({
          field: "vetoThreshold",
          index,
          message: `${sourceLabel}第 ${index + 1} 条否决阈值必须为 0-10 的数字，最多 ${MAX_VETO_THRESHOLD_DECIMALS} 位小数`,
        });
      } else {
        vetoThreshold = round(rawThreshold, MAX_VETO_THRESHOLD_DECIMALS);
      }
    }

    return {
      ...rubric,
      ...(weight === undefined ? {} : { weight }),
      ...(vetoThreshold === undefined ? {} : { vetoThreshold }),
    };
  });

  const totalWeight = round(
    dimensions.reduce(
      (total, dimension) => total + (dimension.weight ?? 0),
      0
    ),
    MAX_EVALUATOR_WEIGHT_DECIMALS
  );
  if (
    issues.every((issue) => issue.field !== "weight") &&
    totalWeight !== EVALUATOR_TOTAL_WEIGHT
  ) {
    issues.push({
      field: "totalWeight",
      message: `已选维度权重合计必须为 ${EVALUATOR_TOTAL_WEIGHT}%，当前为 ${totalWeight}%`,
    });
  }

  return { dimensions, issues, totalWeight };
}

export function parseEvaluatorPolicy(
  value: unknown,
  options: { min?: number; max?: number; sourceLabel?: string } = {}
): EvalDimension[] {
  const analysis = analyzeEvaluatorPolicy(value, options);
  if (analysis.issues.length > 0) {
    throw new EvaluatorPolicyValidationError(analysis.issues[0].message);
  }
  return analysis.dimensions;
}

export function formatEvaluatorPolicyForPrompt(
  dimension: EvalDimension,
  index: number
): string {
  const vetoRule =
    dimension.vetoThreshold === undefined
      ? "不启用"
      : `得分低于 ${dimension.vetoThreshold} 分时触发`;
  return `${formatEvaluationRubricForPrompt(dimension, index)}\n权重：${dimension.weight}%\n一票否决：${vetoRule}`;
}

export function buildEvaluatorPolicyFingerprint(
  dimensions: EvalDimension[]
): string {
  return JSON.stringify(parseEvaluatorPolicy(dimensions));
}

/** Applies weighting and vetoes after Judge scores are normalized by dimension name. */
export function calculateEvaluatorPolicyOutcome(
  dimensions: EvalDimension[],
  scores: { dimension: string; score: number }[]
): EvaluatorPolicyOutcome {
  const policy = parseEvaluatorPolicy(dimensions);
  const scoreByName = new Map(
    scores.map((score) => [normalizeEvaluationRubricName(score.dimension), score.score])
  );
  let weightedScore = 0;
  const vetoReasons: string[] = [];

  for (const dimension of policy) {
    const score = scoreByName.get(normalizeEvaluationRubricName(dimension.name)) ?? 0;
    weightedScore += score * ((dimension.weight ?? 0) / EVALUATOR_TOTAL_WEIGHT);
    if (
      dimension.vetoThreshold !== undefined &&
      score < dimension.vetoThreshold
    ) {
      vetoReasons.push(
        `“${dimension.name}”得分 ${round(score, 1).toFixed(1)}，低于否决阈值 ${dimension.vetoThreshold}`
      );
    }
  }

  return {
    weightedScore: round(weightedScore, 2),
    vetoed: vetoReasons.length > 0,
    vetoReasons,
  };
}
