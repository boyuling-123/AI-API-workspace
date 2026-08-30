import type { EvalDimension, EvaluationRecord } from "@/types";

export interface EvaluationLeaderboardDimension {
  name: string;
  normalizedWeight: number;
}

export interface EvaluationLeaderboardDimensionAverage {
  dimension: string;
  score: number | null;
}

export interface EvaluationLeaderboardTarget {
  targetId: string;
  targetName: string;
}

export interface EvaluationLeaderboardEntry {
  rank: number | null;
  targetId: string;
  targetName: string;
  score: number | null;
  eligible: boolean;
  evaluatedCases: number;
  totalCases: number;
  coverageRatio: number;
  vetoedCases: number;
  dimensionAverages: EvaluationLeaderboardDimensionAverage[];
}

export interface EvaluationLeaderboard {
  totalCases: number;
  eligibleTargets: number;
  selectedDimensions: EvaluationLeaderboardDimension[];
  entries: EvaluationLeaderboardEntry[];
}

/**
 * 排行榜只使用已保存的原始维度分数。缺少任一所选维度的 Case 不补零，
 * 覆盖不完整的目标仍展示，但不授予正式名次。
 */
export function buildEvaluationLeaderboard(
  record: EvaluationRecord,
  selectedDimensionNames?: string[],
  expectedTargets: readonly EvaluationLeaderboardTarget[] = []
): EvaluationLeaderboard {
  const availableDimensions = uniqueDimensions(record.dimensions);
  const requestedNames =
    selectedDimensionNames === undefined
      ? new Set(availableDimensions.map((dimension) => dimension.name))
      : new Set(selectedDimensionNames);
  const selected = availableDimensions.filter((dimension) =>
    requestedNames.has(dimension.name)
  );
  const selectedDimensions = normalizeWeights(selected);

  const resultByInputId = new Map<string, EvaluationRecord["results"][number]>();
  for (const result of record.results) {
    if (!resultByInputId.has(result.inputId)) {
      resultByInputId.set(result.inputId, result);
    }
  }

  if (selectedDimensions.length === 0) {
    return {
      totalCases: resultByInputId.size,
      eligibleTargets: 0,
      selectedDimensions: [],
      entries: [],
    };
  }

  const targetCatalog = new Map<string, string>();
  for (const target of expectedTargets) {
    if (!target.targetId || targetCatalog.has(target.targetId)) continue;
    targetCatalog.set(
      target.targetId,
      target.targetName.trim() || target.targetId
    );
  }
  for (const result of Array.from(resultByInputId.values())) {
    for (const score of result.scores) {
      if (!targetCatalog.has(score.targetId)) {
        targetCatalog.set(
          score.targetId,
          score.targetName.trim() || score.targetId
        );
      }
    }
  }

  const totalCases = resultByInputId.size;
  const entries: EvaluationLeaderboardEntry[] = Array.from(
    targetCatalog.entries()
  ).map(([targetId, targetName]): EvaluationLeaderboardEntry => {
    let evaluatedCases = 0;
    let vetoedCases = 0;
    let scoreTotal = 0;
    const dimensionTotals = new Map<string, number>();

    for (const result of Array.from(resultByInputId.values())) {
      const targetScore = result.scores.find(
        (score) => score.targetId === targetId
      );
      if (!targetScore) continue;
      if (targetScore.vetoed) vetoedCases += 1;

      const scoreByDimension = new Map<string, number>(
        targetScore.dimensionScores.map(
          (dimensionScore): [string, number] => [
            dimensionScore.dimension,
            dimensionScore.score,
          ]
        )
      );
      const completeScores = selectedDimensions.map((dimension) => ({
        ...dimension,
        score: scoreByDimension.get(dimension.name),
      }));
      if (
        completeScores.some(
          (item) =>
            item.score === undefined ||
            !Number.isFinite(item.score) ||
            item.score < 0 ||
            item.score > 10
        )
      ) {
        continue;
      }

      evaluatedCases += 1;
      for (const item of completeScores) {
        const score = item.score as number;
        scoreTotal += score * item.normalizedWeight;
        dimensionTotals.set(
          item.name,
          (dimensionTotals.get(item.name) ?? 0) + score
        );
      }
    }

    const score =
      evaluatedCases > 0 ? roundMetric(scoreTotal / evaluatedCases) : null;
    const eligible = totalCases > 0 && evaluatedCases === totalCases;
    return {
      rank: null,
      targetId,
      targetName,
      score,
      eligible,
      evaluatedCases,
      totalCases,
      coverageRatio: totalCases > 0 ? evaluatedCases / totalCases : 0,
      vetoedCases,
      dimensionAverages: selectedDimensions.map((dimension) => ({
        dimension: dimension.name,
        score:
          evaluatedCases > 0
            ? roundMetric(
                (dimensionTotals.get(dimension.name) ?? 0) / evaluatedCases
              )
            : null,
      })),
    };
  });

  entries.sort(compareEntries);
  let previousScore: number | null = null;
  let previousRank = 0;
  let eligibleIndex = 0;
  for (const entry of entries) {
    if (!entry.eligible || entry.score === null) continue;
    eligibleIndex += 1;
    if (previousScore === null || Math.abs(entry.score - previousScore) > 1e-9) {
      previousRank = eligibleIndex;
      previousScore = entry.score;
    }
    entry.rank = previousRank;
  }

  return {
    totalCases,
    eligibleTargets: entries.filter((entry) => entry.eligible).length,
    selectedDimensions,
    entries,
  };
}

function uniqueDimensions(dimensions: EvalDimension[]): EvalDimension[] {
  const seen = new Set<string>();
  return dimensions.filter((dimension) => {
    if (!dimension.name || seen.has(dimension.name)) return false;
    seen.add(dimension.name);
    return true;
  });
}

function normalizeWeights(
  dimensions: EvalDimension[]
): EvaluationLeaderboardDimension[] {
  if (dimensions.length === 0) return [];
  const hasCompleteWeights = dimensions.every(
    (dimension) =>
      dimension.weight !== undefined &&
      Number.isFinite(dimension.weight) &&
      dimension.weight >= 0
  );
  const totalWeight = hasCompleteWeights
    ? dimensions.reduce((sum, dimension) => sum + (dimension.weight ?? 0), 0)
    : 0;
  const useEqualWeights = !hasCompleteWeights || totalWeight <= 0;

  return dimensions.map((dimension) => ({
    name: dimension.name,
    normalizedWeight: useEqualWeights
      ? 1 / dimensions.length
      : (dimension.weight ?? 0) / totalWeight,
  }));
}

function compareEntries(
  left: EvaluationLeaderboardEntry,
  right: EvaluationLeaderboardEntry
): number {
  if (left.eligible !== right.eligible) return left.eligible ? -1 : 1;
  if (left.score !== right.score) {
    if (left.score === null) return 1;
    if (right.score === null) return -1;
    return right.score - left.score;
  }
  if (left.coverageRatio !== right.coverageRatio) {
    return right.coverageRatio - left.coverageRatio;
  }
  if (left.targetId < right.targetId) return -1;
  if (left.targetId > right.targetId) return 1;
  return 0;
}

function roundMetric(value: number): number {
  return Math.round(value * 1_000_000_000_000) / 1_000_000_000_000;
}
