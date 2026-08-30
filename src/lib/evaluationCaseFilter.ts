import type {
  EvalDimension,
  EvaluationRecord,
  ResultItem,
  TargetDimensionScores,
  Task,
} from "@/types";

export const DEFAULT_LOW_SCORE_THRESHOLD = 6;
export const DEFAULT_DISAGREEMENT_THRESHOLD = 2;
export const HIGH_RISK_SCORE_THRESHOLD = 3;

export const EVALUATION_CASE_SIGNAL_ORDER = [
  "low_score",
  "disagreement",
  "high_risk",
  "failure",
] as const;

export type EvaluationCaseSignal =
  (typeof EVALUATION_CASE_SIGNAL_ORDER)[number];
export type EvaluationCaseMatchMode = "any" | "all";

export const EVALUATION_CASE_SIGNAL_LABELS: Record<
  EvaluationCaseSignal,
  string
> = {
  low_score: "低分",
  disagreement: "模型分歧",
  high_risk: "高风险",
  failure: "失败",
};

export interface EvaluationCaseFilterThresholds {
  lowScore: number;
  disagreement: number;
}

export interface EvaluationCaseTargetScore {
  targetId: string;
  targetName: string;
  score: number | null;
  vetoed: boolean;
}

export interface EvaluationCaseInsight {
  inputId: string;
  sourceIndex: number;
  targetScores: EvaluationCaseTargetScore[];
  lowestScore: number | null;
  highestScore: number | null;
  scoreSpread: number | null;
  signals: EvaluationCaseSignal[];
  details: Record<EvaluationCaseSignal, string[]>;
}

export interface EvaluationCaseFilter {
  signals: readonly EvaluationCaseSignal[];
  matchMode: EvaluationCaseMatchMode;
}

export interface EvaluationCaseExportSelection {
  inputs: Task["inputs"];
  results: Task["results"];
  evaluations: EvaluationRecord["results"];
}

/**
 * 四类 Case 信号全部由已保存的评价分与来源运行状态确定性派生。
 * 旧记录缺少 weightedScore 时才按原维度权重补算，结果不会写回历史记录。
 */
export function buildEvaluationCaseInsights(
  record: EvaluationRecord,
  task: Task,
  thresholds: Partial<EvaluationCaseFilterThresholds> = {}
): EvaluationCaseInsight[] {
  const resolvedThresholds = normalizeThresholds(thresholds);
  const inputIndexById = new Map(
    task.inputs.map((input, index) => [input.id, index])
  );
  const resultByInputId = new Map(
    task.results.map((result) => [result.inputId, result])
  );
  const targetNames = buildTargetNameCatalog(record, task);
  const expectedTargetIds = buildExpectedTargetIds(record, task);
  const seenInputIds = new Set<string>();

  return record.results.flatMap((evaluation, evaluationIndex) => {
    if (!evaluation.inputId || seenInputIds.has(evaluation.inputId)) return [];
    seenInputIds.add(evaluation.inputId);

    const sourceResult = resultByInputId.get(evaluation.inputId);
    const sourceItemByTargetId = new Map(
      (sourceResult?.items ?? []).map((item) => [item.targetId, item])
    );
    const scoreByTargetId = new Map<string, TargetDimensionScores>();
    for (const score of evaluation.scores) {
      if (!scoreByTargetId.has(score.targetId)) {
        scoreByTargetId.set(score.targetId, score);
      }
    }

    const targetScores = expectedTargetIds.map((targetId) => {
      const score = scoreByTargetId.get(targetId);
      return {
        targetId,
        targetName: targetNames.get(targetId) ?? targetId,
        score: score ? resolveWeightedScore(record.dimensions, score) : null,
        vetoed: score?.vetoed === true,
      };
    });
    const validScores = targetScores.filter(
      (target): target is EvaluationCaseTargetScore & { score: number } =>
        target.score !== null
    );
    const scoreValues = validScores.map((target) => target.score);
    const lowestScore = scoreValues.length > 0 ? Math.min(...scoreValues) : null;
    const highestScore = scoreValues.length > 0 ? Math.max(...scoreValues) : null;
    const scoreSpread =
      scoreValues.length >= 2 && lowestScore !== null && highestScore !== null
        ? roundMetric(highestScore - lowestScore)
        : null;

    const details = emptySignalDetails();
    for (const target of validScores) {
      if (target.score < resolvedThresholds.lowScore) {
        details.low_score.push(
          `${target.targetName} 加权分 ${formatMetric(target.score)}，低于 ${formatMetric(resolvedThresholds.lowScore)}`
        );
      }
      if (target.score <= HIGH_RISK_SCORE_THRESHOLD) {
        details.high_risk.push(
          `${target.targetName} 加权分 ${formatMetric(target.score)}，不高于严重阈值 ${HIGH_RISK_SCORE_THRESHOLD.toFixed(1)}`
        );
      }
      if (target.vetoed) {
        const vetoReasons = scoreByTargetId.get(target.targetId)?.vetoReasons;
        details.high_risk.push(
          `${target.targetName} 已被一票否决${vetoReasons?.length ? `：${vetoReasons.join("；")}` : ""}`
        );
      }
    }

    if (
      scoreSpread !== null &&
      scoreSpread >= resolvedThresholds.disagreement
    ) {
      const lowestTargets = validScores
        .filter((target) => target.score === lowestScore)
        .map((target) => target.targetName)
        .join("、");
      const highestTargets = validScores
        .filter((target) => target.score === highestScore)
        .map((target) => target.targetName)
        .join("、");
      details.disagreement.push(
        `最高 ${highestTargets} ${formatMetric(highestScore)}，最低 ${lowestTargets} ${formatMetric(lowestScore)}，分差 ${formatMetric(scoreSpread)}`
      );
    }

    for (const targetId of expectedTargetIds) {
      const targetName = targetNames.get(targetId) ?? targetId;
      const sourceItem = sourceItemByTargetId.get(targetId);
      const targetScore = targetScores.find(
        (target) => target.targetId === targetId
      );
      if (!sourceItem) {
        details.failure.push(`${targetName} 缺少来源运行结果`);
        continue;
      }
      if (sourceItem.status !== "success") {
        details.failure.push(formatRunFailure(targetName, sourceItem));
        continue;
      }
      if (!targetScore || targetScore.score === null) {
        details.failure.push(`${targetName} 评价分缺失或非法`);
      }
    }

    const signals = EVALUATION_CASE_SIGNAL_ORDER.filter(
      (signal) => details[signal].length > 0
    );
    return [
      {
        inputId: evaluation.inputId,
        sourceIndex:
          inputIndexById.get(evaluation.inputId) ?? evaluationIndex,
        targetScores,
        lowestScore,
        highestScore,
        scoreSpread,
        signals,
        details,
      },
    ];
  });
}

export function filterEvaluationCaseInsights(
  insights: readonly EvaluationCaseInsight[],
  filter: EvaluationCaseFilter
): EvaluationCaseInsight[] {
  const selectedSignals = EVALUATION_CASE_SIGNAL_ORDER.filter((signal) =>
    filter.signals.includes(signal)
  );
  if (selectedSignals.length === 0) return [...insights];

  return insights.filter((insight) =>
    filter.matchMode === "all"
      ? selectedSignals.every((signal) => insight.signals.includes(signal))
      : selectedSignals.some((signal) => insight.signals.includes(signal))
  );
}

/** 生成 Excel 所需的精确 Case 子集；即使来源结果缺失，也保留一个空结果行。 */
export function buildEvaluationCaseExportSelection(
  record: EvaluationRecord,
  task: Task,
  inputIds: readonly string[]
): EvaluationCaseExportSelection {
  const selectedInputIds = new Set(inputIds);
  const sourceInputs = new Map(task.inputs.map((input) => [input.id, input]));
  const sourceResults = new Map(
    task.results.map((result) => [result.inputId, result])
  );
  const evaluations = record.results.filter((evaluation) =>
    selectedInputIds.has(evaluation.inputId)
  );

  return {
    inputs: evaluations.flatMap((evaluation) => {
      const input = sourceInputs.get(evaluation.inputId);
      return input ? [input] : [];
    }),
    results: evaluations.map(
      (evaluation) =>
        sourceResults.get(evaluation.inputId) ?? {
          inputId: evaluation.inputId,
          items: [],
        }
    ),
    evaluations,
  };
}

function buildTargetNameCatalog(
  record: EvaluationRecord,
  task: Task
): Map<string, string> {
  const names = new Map<string, string>();
  for (const result of task.results) {
    for (const item of result.items) {
      if (!names.has(item.targetId)) {
        names.set(item.targetId, item.targetName.trim() || item.targetId);
      }
    }
  }
  for (const evaluation of record.results) {
    for (const score of evaluation.scores) {
      if (!names.has(score.targetId)) {
        names.set(score.targetId, score.targetName.trim() || score.targetId);
      }
    }
  }
  return names;
}

function buildExpectedTargetIds(
  record: EvaluationRecord,
  task: Task
): string[] {
  const targetIds: string[] = [];
  const seen = new Set<string>();
  const append = (targetId: string) => {
    if (!targetId || seen.has(targetId)) return;
    seen.add(targetId);
    targetIds.push(targetId);
  };
  task.targetIds.forEach(append);
  task.results.forEach((result) => result.items.forEach((item) => append(item.targetId)));
  record.results.forEach((evaluation) =>
    evaluation.scores.forEach((score) => append(score.targetId))
  );
  return targetIds;
}

function resolveWeightedScore(
  dimensions: EvalDimension[],
  targetScore: TargetDimensionScores
): number | null {
  if (isValidScore(targetScore.weightedScore)) {
    return targetScore.weightedScore;
  }

  const uniqueDimensions: EvalDimension[] = [];
  const seenNames = new Set<string>();
  for (const dimension of dimensions) {
    if (!dimension.name || seenNames.has(dimension.name)) continue;
    seenNames.add(dimension.name);
    uniqueDimensions.push(dimension);
  }
  if (uniqueDimensions.length === 0) return null;

  const scoreByName = new Map(
    targetScore.dimensionScores.map((score) => [score.dimension, score.score])
  );
  const hasCompleteWeights = uniqueDimensions.every(
    (dimension) =>
      dimension.weight !== undefined &&
      Number.isFinite(dimension.weight) &&
      dimension.weight >= 0
  );
  const totalWeight = hasCompleteWeights
    ? uniqueDimensions.reduce(
        (sum, dimension) => sum + (dimension.weight ?? 0),
        0
      )
    : 0;
  const useEqualWeights = !hasCompleteWeights || totalWeight <= 0;
  let weightedScore = 0;
  for (const dimension of uniqueDimensions) {
    const score = scoreByName.get(dimension.name);
    if (!isValidScore(score)) return null;
    const weight = useEqualWeights
      ? 1 / uniqueDimensions.length
      : (dimension.weight ?? 0) / totalWeight;
    weightedScore += score * weight;
  }
  return roundMetric(weightedScore);
}

function normalizeThresholds(
  thresholds: Partial<EvaluationCaseFilterThresholds>
): EvaluationCaseFilterThresholds {
  return {
    lowScore: clampThreshold(
      thresholds.lowScore,
      DEFAULT_LOW_SCORE_THRESHOLD
    ),
    disagreement: clampThreshold(
      thresholds.disagreement,
      DEFAULT_DISAGREEMENT_THRESHOLD
    ),
  };
}

function clampThreshold(value: number | undefined, fallback: number): number {
  if (value === undefined || !Number.isFinite(value)) return fallback;
  return Math.min(10, Math.max(0, value));
}

function emptySignalDetails(): Record<EvaluationCaseSignal, string[]> {
  return {
    low_score: [],
    disagreement: [],
    high_risk: [],
    failure: [],
  };
}

function isValidScore(value: number | undefined): value is number {
  return value !== undefined && Number.isFinite(value) && value >= 0 && value <= 10;
}

function formatRunFailure(targetName: string, item: ResultItem): string {
  const statusLabel: Record<ResultItem["status"], string> = {
    pending: "仍在排队",
    running: "仍在运行",
    success: "成功",
    error: "运行失败",
    interrupted: "运行中断",
  };
  const reason = item.error?.trim();
  return `${targetName} ${statusLabel[item.status]}${reason ? `：${reason}` : ""}`;
}

function formatMetric(value: number | null): string {
  return value === null ? "—" : value.toFixed(2);
}

function roundMetric(value: number): number {
  return Math.round(value * 1_000_000_000_000) / 1_000_000_000_000;
}
