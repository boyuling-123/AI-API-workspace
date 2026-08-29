import type {
  EvalDimension,
  EvaluationMode,
  EvaluationRecord,
  ResultRow,
  TaskInput,
} from "@/types";
import { resolveExpectedAnswer } from "@/services/expectedAnswer";
import {
  analyzeEvaluationRubric,
  normalizeEvaluationRubricName,
} from "@/lib/evaluationRubric";

export interface NewDimensionAnalysis {
  dimensions: EvalDimension[];
  duplicateNames: string[];
}

export interface NewDimensionPreview {
  inputIds: string[];
  judgeCallCount: number;
  reusedOutputCount: number;
  skippedMissingExpectedCount: number;
}

export function normalizeEvaluationDimensionName(name: string): string {
  return normalizeEvaluationRubricName(name);
}

/** Keeps only unique dimensions and reports names already present in the lineage. */
export function analyzeNewEvaluationDimensions(
  selected: EvalDimension[],
  existing: EvalDimension[]
): NewDimensionAnalysis {
  const existingNames = new Set(
    existing
      .map((dimension) => normalizeEvaluationDimensionName(dimension.name))
      .filter(Boolean)
  );
  const seen = new Set<string>();
  const dimensions: EvalDimension[] = [];
  const duplicateNames: string[] = [];

  for (const dimension of selected) {
    const name = dimension.name.trim().replace(/\s+/g, " ");
    const normalized = normalizeEvaluationDimensionName(name);
    if (!normalized) continue;
    if (existingNames.has(normalized) || seen.has(normalized)) {
      if (!duplicateNames.includes(name)) duplicateNames.push(name);
      continue;
    }
    seen.add(normalized);
    const structured = analyzeEvaluationRubric({ ...dimension, name }).dimension;
    dimensions.push(
      structured ?? {
        name,
        desc: dimension.desc?.trim() || undefined,
      }
    );
  }

  return { dimensions, duplicateNames };
}

export function getEvaluationRootId(record: EvaluationRecord): string {
  return record.sourceEvaluationId ?? record.id;
}

/** Collects the root evaluation and every incremental record attached to it. */
export function collectEvaluationLineageDimensions(
  records: EvaluationRecord[],
  source: EvaluationRecord
): EvalDimension[] {
  const rootId = getEvaluationRootId(source);
  const related = records.filter(
    (record) => record.id === rootId || record.sourceEvaluationId === rootId
  );
  if (!related.some((record) => record.id === source.id)) related.push(source);

  return analyzeNewEvaluationDimensions(
    related.flatMap((record) => record.dimensions),
    []
  ).dimensions;
}

/** Calculates the exact Judge calls while reusing only source-task terminal outputs. */
export function buildNewDimensionPreview(params: {
  inputs: TaskInput[];
  results: ResultRow[];
  sourceInputIds: string[];
  evaluationMode: EvaluationMode;
  expectedAnswerKey: string;
}): NewDimensionPreview {
  const {
    inputs,
    results,
    sourceInputIds,
    evaluationMode,
    expectedAnswerKey,
  } = params;
  const sourceIds = new Set(sourceInputIds);
  const resultByInputId = new Map(
    results.map((row) => [row.inputId, row] as const)
  );
  const inputIds: string[] = [];
  let reusedOutputCount = 0;
  let skippedMissingExpectedCount = 0;

  for (const input of inputs) {
    if (!sourceIds.has(input.id)) continue;
    const row = resultByInputId.get(input.id);
    const successfulOutputs =
      row?.items.filter((item) => item.status === "success") ?? [];
    if (successfulOutputs.length === 0) continue;
    if (
      evaluationMode === "reference" &&
      !resolveExpectedAnswer(input, expectedAnswerKey).value
    ) {
      skippedMissingExpectedCount += 1;
      continue;
    }
    inputIds.push(input.id);
    reusedOutputCount += successfulOutputs.length;
  }

  return {
    inputIds,
    judgeCallCount: inputIds.length,
    reusedOutputCount,
    skippedMissingExpectedCount,
  };
}
