export type EvaluationExecutionIntent = "trial" | "formal";

export const DEFAULT_TRIAL_EVALUATION_COUNT = 3;
export const MAX_TRIAL_EVALUATION_COUNT = 5;

export interface EvaluationExecutionPlan {
  intent: EvaluationExecutionIntent;
  inputIds: string[];
  judgeCallCount: number;
  reusedOutputCount: number;
  testedTargetCallCount: 0;
  writesHistory: boolean;
}

interface BuildEvaluationExecutionPlanParams {
  intent: EvaluationExecutionIntent;
  eligibleInputIds: string[];
  trialCount?: number;
}

function uniqueInputIds(inputIds: string[]): string[] {
  const seen = new Set<string>();
  return inputIds.filter((inputId) => {
    if (!inputId || seen.has(inputId)) return false;
    seen.add(inputId);
    return true;
  });
}

function normalizeTrialCount(value: number | undefined): number {
  if (!Number.isFinite(value)) return DEFAULT_TRIAL_EVALUATION_COUNT;
  return Math.min(
    MAX_TRIAL_EVALUATION_COUNT,
    Math.max(1, Math.floor(value!))
  );
}

/**
 * Builds the single source of truth for evaluation scope and cost previews.
 * Evaluation always reuses completed target outputs; only the Judge is called.
 */
export function buildEvaluationExecutionPlan({
  intent,
  eligibleInputIds,
  trialCount,
}: BuildEvaluationExecutionPlanParams): EvaluationExecutionPlan {
  const reusableInputIds = uniqueInputIds(eligibleInputIds);
  const inputIds =
    intent === "trial"
      ? reusableInputIds.slice(0, normalizeTrialCount(trialCount))
      : reusableInputIds;

  return {
    intent,
    inputIds,
    judgeCallCount: inputIds.length,
    reusedOutputCount: inputIds.length,
    testedTargetCallCount: 0,
    writesHistory: intent === "formal",
  };
}
