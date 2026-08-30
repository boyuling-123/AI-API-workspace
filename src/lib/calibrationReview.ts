import type {
  CalibrationReviewDecision,
  CalibrationReviewEvent,
  CalibrationReviewRiskCode,
  CalibrationReviewRiskLevel,
  CalibrationReviewRiskSignal,
  CalibrationReviewRiskSnapshot,
  GoldenDatasetCase,
  GoldenDatasetVersion,
  GoldenHumanLabel,
  JudgeCalibrationCaseResult,
  JudgeCalibrationRun,
} from "@/types";
import { generateId } from "@/lib/id";
import { hasJudgeDisagreement } from "@/lib/multiJudgeCalibration";
import { redactSensitiveText } from "@/lib/redactSensitive";

export const CALIBRATION_REVIEW_LOW_CONFIDENCE = 0.75;
export const MAX_CALIBRATION_REVIEW_ACTOR_LENGTH = 40;
export const MAX_CALIBRATION_REVIEW_NOTE_LENGTH = 1_000;

export const CALIBRATION_REVIEW_RISK_LABELS: Record<
  CalibrationReviewRiskCode,
  string
> = {
  judge_error: "调用或解析失败",
  bad_case_miss: "Bad Case 漏判",
  human_judge_disagreement: "人工与 Judge 分歧",
  multi_judge_disagreement: "多 Judge 内部分歧",
  low_confidence: "低置信度",
  repeated_risk: "跨运行重复出现",
};

export const CALIBRATION_REVIEW_DECISION_LABELS: Record<
  CalibrationReviewDecision,
  string
> = {
  confirm_judge: "确认原 Judge 结论",
  override_pass: "人工改判为 pass",
  override_fail: "人工改判为 fail",
  needs_followup: "需要后续处理",
};

export type CalibrationReviewQueueStatus =
  | "unclaimed"
  | "claimed"
  | "completed";

export interface CalibrationReviewQueueItem {
  key: string;
  run: JudgeCalibrationRun;
  result: JudgeCalibrationCaseResult;
  datasetCase?: GoldenDatasetCase;
  risk: CalibrationReviewRiskSnapshot;
  status: CalibrationReviewQueueStatus;
  claim?: CalibrationReviewEvent;
  completion?: CalibrationReviewEvent;
}

interface BuildCalibrationReviewQueueInput {
  runs: JudgeCalibrationRun[];
  versions: GoldenDatasetVersion[];
  events: CalibrationReviewEvent[];
}

interface CreateCalibrationReviewClaimInput {
  item: CalibrationReviewQueueItem;
  existingEvents: CalibrationReviewEvent[];
  actor: string;
  id?: string;
  createTime?: number;
}

interface CreateCalibrationReviewCompletionInput
  extends CreateCalibrationReviewClaimInput {
  decision: CalibrationReviewDecision;
  note: string;
}

interface RiskCandidate {
  key: string;
  familyCaseKey: string;
  run: JudgeCalibrationRun;
  result: JudgeCalibrationCaseResult;
  datasetCase?: GoldenDatasetCase;
  signals: CalibrationReviewRiskSignal[];
}

function fingerprint(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash = Math.imul(hash ^ value.charCodeAt(index), 0x01000193);
  }
  return `fp1:${(hash >>> 0).toString(16).padStart(8, "0")}:${value.length}`;
}

function reviewKey(runId: string, caseId: string): string {
  return `${runId}:${caseId}`;
}

function requiredText(value: string, label: string, maxLength: number): string {
  const normalized = redactSensitiveText(value.trim());
  if (!normalized) throw new Error(`${label}不能为空`);
  if (normalized.length > maxLength) {
    throw new Error(`${label}不能超过 ${maxLength} 个字符`);
  }
  return normalized;
}

function cloneRisk(risk: CalibrationReviewRiskSnapshot): CalibrationReviewRiskSnapshot {
  return {
    ...risk,
    signals: risk.signals.map((signal) => ({ ...signal })),
  };
}

function eventIntegritySource(
  event: Omit<CalibrationReviewEvent, "integrityFingerprint">
): string {
  return JSON.stringify({
    id: event.id,
    reviewKey: event.reviewKey,
    runId: event.runId,
    caseId: event.caseId,
    action: event.action,
    actor: event.actor,
    createTime: event.createTime,
    claimEventId: event.claimEventId,
    decision: event.decision,
    note: event.note,
    resolutionLabel: event.resolutionLabel,
    originalStatus: event.originalStatus,
    originalHumanLabel: event.originalHumanLabel,
    originalJudgeLabel: event.originalJudgeLabel,
    risk: event.risk,
  });
}

function baseRiskSignals(
  result: JudgeCalibrationCaseResult
): CalibrationReviewRiskSignal[] {
  const signals: CalibrationReviewRiskSignal[] = [];
  if (result.status === "error") {
    signals.push({
      code: "judge_error",
      label: CALIBRATION_REVIEW_RISK_LABELS.judge_error,
      detail: result.error
        ? `该 Case 未形成完整判定：${result.error}`
        : "该 Case 未形成完整判定。",
      score: 100,
    });
    return signals;
  }

  if (result.humanLabel === "fail" && result.judgeLabel === "pass") {
    signals.push({
      code: "bad_case_miss",
      label: CALIBRATION_REVIEW_RISK_LABELS.bad_case_miss,
      detail: "人工标记为 fail，但 Judge 或最终仲裁判为 pass。",
      score: 90,
    });
  } else if (
    result.judgeLabel !== undefined &&
    result.humanLabel !== result.judgeLabel
  ) {
    signals.push({
      code: "human_judge_disagreement",
      label: CALIBRATION_REVIEW_RISK_LABELS.human_judge_disagreement,
      detail: `人工标签为 ${result.humanLabel}，Judge 或最终仲裁为 ${result.judgeLabel}。`,
      score: 50,
    });
  }

  if (hasJudgeDisagreement(result.votes ?? [])) {
    const passVotes = result.votes?.filter(
      (vote) => vote.status === "success" && vote.judgeLabel === "pass"
    ).length ?? 0;
    const failVotes = result.votes?.filter(
      (vote) => vote.status === "success" && vote.judgeLabel === "fail"
    ).length ?? 0;
    signals.push({
      code: "multi_judge_disagreement",
      label: CALIBRATION_REVIEW_RISK_LABELS.multi_judge_disagreement,
      detail: `原始投票未达成一致：pass ${passVotes} 票，fail ${failVotes} 票。`,
      score: 55,
    });
  }

  if (
    result.confidence !== undefined &&
    result.confidence < CALIBRATION_REVIEW_LOW_CONFIDENCE
  ) {
    signals.push({
      code: "low_confidence",
      label: CALIBRATION_REVIEW_RISK_LABELS.low_confidence,
      detail: `当前置信度 ${(result.confidence * 100).toFixed(1)}%，低于 ${(CALIBRATION_REVIEW_LOW_CONFIDENCE * 100).toFixed(0)}% 复核线。`,
      score: 25,
    });
  }
  return signals;
}

function riskLevel(
  signals: CalibrationReviewRiskSignal[],
  occurrenceCount: number
): CalibrationReviewRiskLevel {
  if (
    signals.some(
      (signal) =>
        signal.code === "judge_error" || signal.code === "bad_case_miss"
    )
  ) {
    return "critical";
  }
  if (occurrenceCount >= 2 || signals.reduce((sum, signal) => sum + signal.score, 0) >= 50) {
    return "high";
  }
  return "medium";
}

function buildRisk(
  signals: CalibrationReviewRiskSignal[],
  occurrenceCount: number
): CalibrationReviewRiskSnapshot {
  const completeSignals = signals.map((signal) => ({ ...signal }));
  if (occurrenceCount >= 2) {
    completeSignals.push({
      code: "repeated_risk",
      label: CALIBRATION_REVIEW_RISK_LABELS.repeated_risk,
      detail: `同一黄金集家族的该 Case 已在 ${occurrenceCount} 次校准运行中触发风险。`,
      score: Math.min(30, occurrenceCount * 10),
    });
  }
  return {
    level: riskLevel(completeSignals, occurrenceCount),
    score: Math.min(
      100,
      completeSignals.reduce((sum, signal) => sum + signal.score, 0)
    ),
    occurrenceCount,
    signals: completeSignals,
  };
}

function resolveQueueState(
  key: string,
  events: CalibrationReviewEvent[]
): Pick<CalibrationReviewQueueItem, "status" | "claim" | "completion"> {
  const matching = events
    .filter(
      (event) => event.reviewKey === key && isCalibrationReviewEventIntact(event)
    )
    .sort(
      (left, right) =>
        left.createTime - right.createTime || left.id.localeCompare(right.id)
    );
  const claims = matching.filter((event) => event.action === "claimed");
  const completions = matching.filter((event) => {
    if (event.action !== "completed" || !event.claimEventId) return false;
    const claim = claims.find((candidate) => candidate.id === event.claimEventId);
    return Boolean(claim && claim.actor === event.actor);
  });
  const completion = completions.at(-1);
  if (completion) {
    const claim = claims.find((event) => event.id === completion.claimEventId);
    return { status: "completed", claim, completion };
  }
  const claim = claims.at(-1);
  return claim ? { status: "claimed", claim } : { status: "unclaimed" };
}

export function buildCalibrationReviewQueue({
  runs,
  versions,
  events,
}: BuildCalibrationReviewQueueInput): CalibrationReviewQueueItem[] {
  const versionById = new Map(versions.map((version) => [version.id, version]));
  const candidates: RiskCandidate[] = [];

  for (const run of runs) {
    const version = versionById.get(run.goldenDatasetVersionId);
    const caseById = new Map(
      (version?.cases ?? []).map((datasetCase) => [datasetCase.caseId, datasetCase])
    );
    for (const result of run.results) {
      const signals = baseRiskSignals(result);
      if (signals.length === 0) continue;
      candidates.push({
        key: reviewKey(run.id, result.caseId),
        familyCaseKey: `${version?.datasetId ?? run.goldenDatasetVersionId}:${result.caseId}`,
        run,
        result,
        datasetCase: caseById.get(result.caseId),
        signals,
      });
    }
  }

  const occurrenceByCase = new Map<string, number>();
  for (const candidate of candidates) {
    occurrenceByCase.set(
      candidate.familyCaseKey,
      (occurrenceByCase.get(candidate.familyCaseKey) ?? 0) + 1
    );
  }

  const levelOrder: Record<CalibrationReviewRiskLevel, number> = {
    critical: 0,
    high: 1,
    medium: 2,
  };
  return candidates
    .map((candidate) => ({
      key: candidate.key,
      run: candidate.run,
      result: candidate.result,
      datasetCase: candidate.datasetCase,
      risk: buildRisk(
        candidate.signals,
        occurrenceByCase.get(candidate.familyCaseKey) ?? 1
      ),
      ...resolveQueueState(candidate.key, events),
    }))
    .sort(
      (left, right) =>
        levelOrder[left.risk.level] - levelOrder[right.risk.level] ||
        right.risk.score - left.risk.score ||
        right.risk.occurrenceCount - left.risk.occurrenceCount ||
        right.run.finishTime - left.run.finishTime ||
        left.key.localeCompare(right.key)
    );
}

export function isCalibrationReviewEventIntact(
  event: CalibrationReviewEvent
): boolean {
  if (
    !event.id ||
    !event.reviewKey ||
    !event.runId ||
    !event.caseId ||
    !event.actor ||
    (event.action !== "claimed" && event.action !== "completed")
  ) {
    return false;
  }
  if (
    event.action === "claimed" &&
    (event.claimEventId !== undefined ||
      event.decision !== undefined ||
      event.note !== undefined ||
      event.resolutionLabel !== undefined)
  ) {
    return false;
  }
  if (
    event.action === "completed" &&
    (!event.claimEventId || !event.decision || !event.note)
  ) {
    return false;
  }
  const { integrityFingerprint, ...snapshot } = event;
  return integrityFingerprint === fingerprint(eventIntegritySource(snapshot));
}

function eventSnapshot(item: CalibrationReviewQueueItem) {
  return {
    reviewKey: item.key,
    runId: item.run.id,
    caseId: item.result.caseId,
    originalStatus: item.result.status,
    originalHumanLabel: item.result.humanLabel,
    originalJudgeLabel: item.result.judgeLabel,
    risk: cloneRisk(item.risk),
  };
}

function assertUniqueEventId(events: CalibrationReviewEvent[], id: string) {
  if (events.some((event) => event.id === id)) {
    throw new Error("复核事件 id 已存在");
  }
}

export function createCalibrationReviewClaim(
  input: CreateCalibrationReviewClaimInput
): CalibrationReviewEvent {
  const state = resolveQueueState(input.item.key, input.existingEvents);
  if (state.status !== "unclaimed") {
    throw new Error(state.status === "completed" ? "该 Case 已完成复核" : "该 Case 已被领取");
  }
  const actor = requiredText(
    input.actor,
    "复核人",
    MAX_CALIBRATION_REVIEW_ACTOR_LENGTH
  );
  const id = input.id ?? generateId();
  assertUniqueEventId(input.existingEvents, id);
  const snapshot = {
    id,
    ...eventSnapshot(input.item),
    action: "claimed" as const,
    actor,
    createTime: input.createTime ?? Date.now(),
  };
  return {
    ...snapshot,
    integrityFingerprint: fingerprint(eventIntegritySource(snapshot)),
  };
}

function resolutionLabel(
  decision: CalibrationReviewDecision,
  judgeLabel: GoldenHumanLabel | undefined
): GoldenHumanLabel | undefined {
  if (decision === "override_pass") return "pass";
  if (decision === "override_fail") return "fail";
  if (decision === "needs_followup") return undefined;
  if (!judgeLabel) throw new Error("失败 Case 没有可确认的 Judge 结论");
  return judgeLabel;
}

export function createCalibrationReviewCompletion(
  input: CreateCalibrationReviewCompletionInput
): CalibrationReviewEvent {
  const state = resolveQueueState(input.item.key, input.existingEvents);
  if (state.status === "completed") throw new Error("该 Case 已完成复核");
  if (state.status !== "claimed" || !state.claim) {
    throw new Error("请先领取该 Case");
  }
  const actor = requiredText(
    input.actor,
    "复核人",
    MAX_CALIBRATION_REVIEW_ACTOR_LENGTH
  );
  if (actor !== state.claim.actor) {
    throw new Error(`该 Case 已由 ${state.claim.actor} 领取`);
  }
  if (!(input.decision in CALIBRATION_REVIEW_DECISION_LABELS)) {
    throw new Error("复核结论无效");
  }
  const note = requiredText(
    input.note,
    "复核说明",
    MAX_CALIBRATION_REVIEW_NOTE_LENGTH
  );
  const id = input.id ?? generateId();
  assertUniqueEventId(input.existingEvents, id);
  const snapshot = {
    id,
    ...eventSnapshot(input.item),
    action: "completed" as const,
    actor,
    createTime: input.createTime ?? Date.now(),
    claimEventId: state.claim.id,
    decision: input.decision,
    note,
    resolutionLabel: resolutionLabel(
      input.decision,
      input.item.result.judgeLabel
    ),
  };
  return {
    ...snapshot,
    integrityFingerprint: fingerprint(eventIntegritySource(snapshot)),
  };
}
