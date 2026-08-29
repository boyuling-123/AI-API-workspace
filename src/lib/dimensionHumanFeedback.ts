import { redactSensitiveText } from "@/lib/redactSensitive";

export const DIMENSION_HUMAN_FEEDBACK_MODES = ["scores", "ranking"] as const;

export type DimensionHumanFeedbackMode =
  (typeof DIMENSION_HUMAN_FEEDBACK_MODES)[number];

export const DIMENSION_HUMAN_FEEDBACK_MODE_LABELS: Record<
  DimensionHumanFeedbackMode,
  string
> = {
  scores: "人工评分",
  ranking: "偏好排序",
};

export const MAX_DIMENSION_HUMAN_FEEDBACK_NOTE_LENGTH = 1_000;

export interface DimensionHumanFeedbackJudgment {
  targetId: string;
  score?: number;
  rank?: number;
}

export interface DimensionHumanFeedback {
  mode: DimensionHumanFeedbackMode;
  judgments: DimensionHumanFeedbackJudgment[];
  note?: string;
}

export interface DimensionHumanFeedbackTarget {
  targetId: string;
  targetName: string;
}

export interface DimensionHumanFeedbackDraft {
  mode: DimensionHumanFeedbackMode;
  values: Record<string, string>;
  note: string;
}

export interface DimensionHumanFeedbackAnalysis {
  feedback?: DimensionHumanFeedback;
  error: string | null;
}

export function analyzeDimensionHumanFeedbackDraft(
  draft: DimensionHumanFeedbackDraft | undefined,
  targets: DimensionHumanFeedbackTarget[]
): DimensionHumanFeedbackAnalysis {
  if (!draft) return { feedback: undefined, error: null };
  const targetError = validateTargets(targets);
  if (targetError) return { error: targetError };
  if (!DIMENSION_HUMAN_FEEDBACK_MODES.includes(draft.mode)) {
    return { error: "请选择有效的人工反馈模式" };
  }
  if (draft.mode === "ranking" && targets.length < 2) {
    return { error: "偏好排序至少需要 2 个目标输出" };
  }
  const note = validateNote(draft.note);
  if (note.error) return { error: note.error };

  const judgments: DimensionHumanFeedbackJudgment[] = [];
  for (const target of targets) {
    const rawValue = draft.values[target.targetId]?.trim() ?? "";
    if (!rawValue) {
      return {
        error: `${target.targetName} 尚未填写${draft.mode === "scores" ? "人工评分" : "偏好名次"}`,
      };
    }
    const value = Number(rawValue);
    const valueError = validateFeedbackValue(draft.mode, value, targets.length);
    if (valueError) {
      return { error: `${target.targetName}：${valueError}` };
    }
    judgments.push(
      draft.mode === "scores"
        ? { targetId: target.targetId, score: value }
        : { targetId: target.targetId, rank: value }
    );
  }

  const rankError = validateRanks(draft.mode, judgments, targets.length);
  if (rankError) return { error: rankError };
  return {
    feedback: {
      mode: draft.mode,
      judgments,
      note: note.value || undefined,
    },
    error: null,
  };
}

export function parseDimensionHumanFeedback(
  value: unknown,
  targets: DimensionHumanFeedbackTarget[]
): DimensionHumanFeedbackAnalysis {
  if (value === undefined) return { feedback: undefined, error: null };
  const targetError = validateTargets(targets);
  if (targetError) return { error: targetError };
  if (!value || typeof value !== "object") {
    return { error: "人工反馈必须是对象" };
  }
  const raw = value as Record<string, unknown>;
  if (
    typeof raw.mode !== "string" ||
    !DIMENSION_HUMAN_FEEDBACK_MODES.includes(
      raw.mode as DimensionHumanFeedbackMode
    )
  ) {
    return { error: "请选择有效的人工反馈模式" };
  }
  const mode = raw.mode as DimensionHumanFeedbackMode;
  if (mode === "ranking" && targets.length < 2) {
    return { error: "偏好排序至少需要 2 个目标输出" };
  }
  if (!Array.isArray(raw.judgments) || raw.judgments.length !== targets.length) {
    return { error: "人工反馈必须覆盖当前样本的全部目标输出" };
  }
  const note = validateNote(raw.note);
  if (note.error) return { error: note.error };

  const rawByTargetId = new Map<string, Record<string, unknown>>();
  for (const judgment of raw.judgments) {
    if (!judgment || typeof judgment !== "object") {
      return { error: "人工反馈的目标项格式无效" };
    }
    const item = judgment as Record<string, unknown>;
    if (typeof item.targetId !== "string" || !item.targetId.trim()) {
      return { error: "人工反馈缺少目标 id" };
    }
    const targetId = item.targetId.trim();
    if (rawByTargetId.has(targetId)) {
      return { error: "人工反馈的目标 id 不能重复" };
    }
    rawByTargetId.set(targetId, item);
  }

  const judgments: DimensionHumanFeedbackJudgment[] = [];
  for (const target of targets) {
    const item = rawByTargetId.get(target.targetId);
    if (!item) {
      return { error: "人工反馈必须覆盖当前样本的全部目标输出" };
    }
    const value = mode === "scores" ? item.score : item.rank;
    if (typeof value !== "number") {
      return {
        error: `${target.targetName} 尚未填写${mode === "scores" ? "人工评分" : "偏好名次"}`,
      };
    }
    const valueError = validateFeedbackValue(mode, value, targets.length);
    if (valueError) return { error: `${target.targetName}：${valueError}` };
    judgments.push(
      mode === "scores"
        ? { targetId: target.targetId, score: value }
        : { targetId: target.targetId, rank: value }
    );
  }

  if (rawByTargetId.size !== targets.length) {
    return { error: "人工反馈包含当前样本不存在的目标" };
  }
  const rankError = validateRanks(mode, judgments, targets.length);
  if (rankError) return { error: rankError };
  return {
    feedback: {
      mode,
      judgments,
      note: note.value || undefined,
    },
    error: null,
  };
}

function validateTargets(targets: DimensionHumanFeedbackTarget[]): string | null {
  if (targets.length === 0) return "人工反馈缺少目标输出";
  if (new Set(targets.map((target) => target.targetId)).size !== targets.length) {
    return "样本目标输出不能重复";
  }
  return null;
}

function validateNote(value: unknown): { value: string; error: string | null } {
  if (value === undefined || value === null || value === "") {
    return { value: "", error: null };
  }
  if (typeof value !== "string") {
    return { value: "", error: "人工反馈备注必须是字符串" };
  }
  const trimmed = value.trim();
  if (trimmed.length > MAX_DIMENSION_HUMAN_FEEDBACK_NOTE_LENGTH) {
    return {
      value: "",
      error: `人工反馈备注不能超过 ${MAX_DIMENSION_HUMAN_FEEDBACK_NOTE_LENGTH} 个字符`,
    };
  }
  return { value: redactSensitiveText(trimmed), error: null };
}

function validateFeedbackValue(
  mode: DimensionHumanFeedbackMode,
  value: number,
  targetCount: number
): string | null {
  if (!Number.isFinite(value)) {
    return mode === "scores" ? "人工评分必须是数字" : "偏好名次必须是整数";
  }
  if (mode === "scores") {
    if (value < 0 || value > 10 || !hasAtMostOneDecimal(value)) {
      return "人工评分必须是 0–10 的数字，最多 1 位小数";
    }
    return null;
  }
  if (!Number.isInteger(value) || value < 1 || value > targetCount) {
    return `偏好名次必须是 1–${targetCount} 的整数`;
  }
  return null;
}

function validateRanks(
  mode: DimensionHumanFeedbackMode,
  judgments: DimensionHumanFeedbackJudgment[],
  targetCount: number
): string | null {
  if (mode !== "ranking") return null;
  const ranks = judgments.map((judgment) => judgment.rank);
  if (new Set(ranks).size !== targetCount) {
    return `偏好名次不能重复，且必须完整覆盖 1–${targetCount}`;
  }
  return null;
}

function hasAtMostOneDecimal(value: number): boolean {
  return Math.abs(value * 10 - Math.round(value * 10)) < 1e-9;
}
