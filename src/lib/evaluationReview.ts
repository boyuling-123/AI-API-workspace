import type {
  EvalDimension,
  EvaluationRecord,
  EvaluationReviewEvent,
  EvaluationReviewScore,
  TargetDimensionScores,
} from "@/types";
import { generateId } from "@/lib/id";
import { redactSensitiveText } from "@/lib/redactSensitive";

export const MAX_EVALUATION_REVIEW_ACTOR_LENGTH = 40;
export const MAX_EVALUATION_REVIEW_NOTE_LENGTH = 1_000;

interface CreateEvaluationReviewEventInput {
  record: EvaluationRecord;
  inputId: string;
  targetId: string;
  existingEvents: EvaluationReviewEvent[];
  actor: string;
  note: string;
  isBadCase: boolean;
  dimensionScores: EvaluationReviewScore[];
  id?: string;
  createTime?: number;
}

export interface HumanReviewOutcome {
  weightedScore: number;
  vetoed: boolean;
  vetoReasons: string[];
}

export function evaluationReviewKey(
  evaluationId: string,
  inputId: string,
  targetId: string
): string {
  return `${evaluationId}:${inputId}:${targetId}`;
}

export function buildLatestEvaluationReviewMap(
  events: readonly EvaluationReviewEvent[],
  evaluationId: string
): Map<string, EvaluationReviewEvent> {
  const latest = new Map<string, EvaluationReviewEvent>();
  const sorted = events
    .filter(
      (event) =>
        event.evaluationId === evaluationId &&
        isEvaluationReviewEventIntact(event)
    )
    .sort(
      (left, right) =>
        left.createTime - right.createTime || left.id.localeCompare(right.id)
    );
  for (const event of sorted) latest.set(event.reviewKey, event);
  return latest;
}

export function getEvaluationReviewHistory(
  events: readonly EvaluationReviewEvent[],
  evaluationId: string,
  inputId: string,
  targetId: string
): EvaluationReviewEvent[] {
  const key = evaluationReviewKey(evaluationId, inputId, targetId);
  return events
    .filter(
      (event) =>
        event.reviewKey === key && isEvaluationReviewEventIntact(event)
    )
    .sort(
      (left, right) =>
        right.createTime - left.createTime || right.id.localeCompare(left.id)
    );
}

export function createEvaluationReviewEvent(
  input: CreateEvaluationReviewEventInput
): EvaluationReviewEvent {
  const sourceScore = findTargetScore(
    input.record,
    input.inputId,
    input.targetId
  );
  const originalDimensionScores = cloneSourceScores(sourceScore);
  const humanDimensionScores = validateHumanScores(
    input.dimensionScores,
    originalDimensionScores
  );
  const actor = requiredText(
    input.actor,
    "修改人",
    MAX_EVALUATION_REVIEW_ACTOR_LENGTH
  );
  const note = requiredText(
    input.note,
    "修改理由",
    MAX_EVALUATION_REVIEW_NOTE_LENGTH
  );
  const id = input.id ?? generateId();
  if (input.existingEvents.some((event) => event.id === id)) {
    throw new Error("人工复核事件 id 已存在");
  }

  const reviewKey = evaluationReviewKey(
    input.record.id,
    input.inputId,
    input.targetId
  );
  const history = getEvaluationReviewHistory(
    input.existingEvents,
    input.record.id,
    input.inputId,
    input.targetId
  );
  const previous = history[0];
  if (
    previous &&
    JSON.stringify(previous.originalDimensionScores) !==
      JSON.stringify(originalDimensionScores)
  ) {
    throw new Error("AI 原始评分已变化，请刷新后重新复核");
  }
  const requestedCreateTime = input.createTime ?? Date.now();
  if (!Number.isSafeInteger(requestedCreateTime) || requestedCreateTime < 0) {
    throw new Error("人工复核时间非法");
  }
  const createTime = previous
    ? Math.max(requestedCreateTime, previous.createTime + 1)
    : requestedCreateTime;
  const outcome = calculateEvaluationReviewOutcome(
    input.record.dimensions,
    humanDimensionScores
  );
  const snapshot = {
    id,
    reviewKey,
    evaluationId: input.record.id,
    inputId: input.inputId,
    targetId: input.targetId,
    targetName: redactSensitiveText(
      sourceScore.targetName.trim() || input.targetId
    ),
    actor,
    createTime,
    previousEventId: previous?.id,
    originalDimensionScores,
    originalWeightedScore: sourceScore.weightedScore,
    originalVetoed: sourceScore.vetoed,
    humanDimensionScores,
    humanWeightedScore: outcome.weightedScore,
    humanVetoed: outcome.vetoed,
    humanVetoReasons: outcome.vetoReasons,
    isBadCase: input.isBadCase === true,
    note,
  };
  return {
    ...snapshot,
    integrityFingerprint: fingerprint(eventIntegritySource(snapshot)),
  };
}

export function isEvaluationReviewEventIntact(
  event: EvaluationReviewEvent
): boolean {
  if (
    !event.id ||
    !event.reviewKey ||
    !event.evaluationId ||
    !event.inputId ||
    !event.targetId ||
    !event.targetName ||
    !event.actor ||
    !event.note ||
    !Number.isSafeInteger(event.createTime) ||
    event.createTime < 0 ||
    !Array.isArray(event.originalDimensionScores) ||
    !Array.isArray(event.humanDimensionScores) ||
    event.originalDimensionScores.length === 0 ||
    event.originalDimensionScores.length !== event.humanDimensionScores.length ||
    !isValidScore(event.humanWeightedScore) ||
    typeof event.humanVetoed !== "boolean" ||
    !Array.isArray(event.humanVetoReasons) ||
    !event.humanVetoReasons.every((reason) => typeof reason === "string") ||
    typeof event.isBadCase !== "boolean" ||
    event.actor.length > MAX_EVALUATION_REVIEW_ACTOR_LENGTH ||
    event.note.length > MAX_EVALUATION_REVIEW_NOTE_LENGTH ||
    (event.previousEventId !== undefined &&
      typeof event.previousEventId !== "string") ||
    (event.originalWeightedScore !== undefined &&
      !isValidScore(event.originalWeightedScore)) ||
    (event.originalVetoed !== undefined &&
      typeof event.originalVetoed !== "boolean")
  ) {
    return false;
  }
  const originalNames = event.originalDimensionScores.map(
    (score) => score.dimension
  );
  const humanNames = event.humanDimensionScores.map((score) => score.dimension);
  if (
    new Set(originalNames).size !== originalNames.length ||
    JSON.stringify(originalNames) !== JSON.stringify(humanNames) ||
    !event.originalDimensionScores.every(isValidOriginalScore) ||
    !event.humanDimensionScores.every(isValidReviewScore) ||
    event.reviewKey !==
      evaluationReviewKey(event.evaluationId, event.inputId, event.targetId)
  ) {
    return false;
  }
  const { integrityFingerprint, ...snapshot } = event;
  return integrityFingerprint === fingerprint(eventIntegritySource(snapshot));
}

function findTargetScore(
  record: EvaluationRecord,
  inputId: string,
  targetId: string
): TargetDimensionScores {
  const evaluation = record.results.find((item) => item.inputId === inputId);
  if (!evaluation) throw new Error("未找到待复核的评价 Case");
  const score = evaluation.scores.find((item) => item.targetId === targetId);
  if (!score) throw new Error("未找到待复核的目标评分");
  if (score.dimensionScores.length === 0) {
    throw new Error("该目标没有可人工复核的维度分");
  }
  return score;
}

function cloneSourceScores(
  sourceScore: TargetDimensionScores
): EvaluationReviewScore[] {
  const seen = new Set<string>();
  return sourceScore.dimensionScores.map((score) => {
    if (!score.dimension || seen.has(score.dimension) || !isValidScore(score.score)) {
      throw new Error("AI 原始维度评分不完整或非法");
    }
    seen.add(score.dimension);
    return { dimension: score.dimension, score: score.score };
  });
}

function validateHumanScores(
  scores: EvaluationReviewScore[],
  originalScores: EvaluationReviewScore[]
): EvaluationReviewScore[] {
  if (!Array.isArray(scores) || scores.length !== originalScores.length) {
    throw new Error("人工评分必须完整覆盖全部原始维度");
  }
  const scoreByDimension = new Map<string, number>();
  for (const score of scores) {
    if (!score.dimension || scoreByDimension.has(score.dimension)) {
      throw new Error("人工评分包含重复或空维度");
    }
    if (!isValidScore(score.score) || !hasAtMostOneDecimal(score.score)) {
      throw new Error("人工评分必须是 0 到 10 之间、最多 1 位小数的数字");
    }
    scoreByDimension.set(score.dimension, score.score);
  }
  return originalScores.map((original) => {
    const score = scoreByDimension.get(original.dimension);
    if (score === undefined) {
      throw new Error(`人工评分缺少维度“${original.dimension}”`);
    }
    return { dimension: original.dimension, score };
  });
}

export function calculateEvaluationReviewOutcome(
  dimensions: EvalDimension[],
  scores: EvaluationReviewScore[]
): HumanReviewOutcome {
  const policyByName = new Map(
    dimensions.map((dimension) => [dimension.name, dimension])
  );
  const hasCompleteWeights = scores.every((score) => {
    const weight = policyByName.get(score.dimension)?.weight;
    return weight !== undefined && Number.isFinite(weight) && weight >= 0;
  });
  const totalWeight = hasCompleteWeights
    ? scores.reduce(
        (sum, score) =>
          sum + (policyByName.get(score.dimension)?.weight ?? 0),
        0
      )
    : 0;
  const useEqualWeights = !hasCompleteWeights || totalWeight <= 0;
  let weightedScore = 0;
  const vetoReasons: string[] = [];
  for (const score of scores) {
    const policy = policyByName.get(score.dimension);
    const weight = useEqualWeights
      ? 1 / scores.length
      : (policy?.weight ?? 0) / totalWeight;
    weightedScore += score.score * weight;
    const vetoThreshold = policy?.vetoThreshold;
    if (
      vetoThreshold !== undefined &&
      Number.isFinite(vetoThreshold) &&
      vetoThreshold >= 0 &&
      vetoThreshold <= 10 &&
      score.score < vetoThreshold
    ) {
      vetoReasons.push(
        `“${score.dimension}”人工分 ${score.score.toFixed(1)}，低于否决阈值 ${vetoThreshold}`
      );
    }
  }
  return {
    weightedScore: Math.round(weightedScore * 100) / 100,
    vetoed: vetoReasons.length > 0,
    vetoReasons,
  };
}

function requiredText(value: string, label: string, maxLength: number): string {
  const normalized = redactSensitiveText(value.trim());
  if (!normalized) throw new Error(`${label}不能为空`);
  if (normalized.length > maxLength) {
    throw new Error(`${label}不能超过 ${maxLength} 个字符`);
  }
  return normalized;
}

function isValidReviewScore(score: EvaluationReviewScore): boolean {
  return (
    Boolean(score.dimension) &&
    isValidScore(score.score) &&
    hasAtMostOneDecimal(score.score)
  );
}

function isValidOriginalScore(score: EvaluationReviewScore): boolean {
  return Boolean(score.dimension) && isValidScore(score.score);
}

function isValidScore(value: number | undefined): value is number {
  return value !== undefined && Number.isFinite(value) && value >= 0 && value <= 10;
}

function hasAtMostOneDecimal(value: number): boolean {
  return Math.abs(value * 10 - Math.round(value * 10)) < 1e-9;
}

function eventIntegritySource(
  event: Omit<EvaluationReviewEvent, "integrityFingerprint">
): string {
  return JSON.stringify(event);
}

function fingerprint(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash = Math.imul(hash ^ value.charCodeAt(index), 0x01000193);
  }
  return `fp1:${(hash >>> 0).toString(16).padStart(8, "0")}:${value.length}`;
}
