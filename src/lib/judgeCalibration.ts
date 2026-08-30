import type {
  JudgeCalibrationCaseResult,
  JudgeCalibrationConfusionMatrix,
  JudgeCalibrationMetrics,
} from "@/types";

function ratio(numerator: number, denominator: number): number | null {
  if (denominator === 0) return null;
  return numerator / denominator;
}

/**
 * 以人工标签为真值计算二分类指标。Bad Case 被视为正类，因此
 * human=fail、judge=pass 是漏判，human=pass、judge=fail 是误杀。
 */
export function calculateJudgeCalibrationMetrics(
  results: JudgeCalibrationCaseResult[]
): JudgeCalibrationMetrics {
  const confusion: JudgeCalibrationConfusionMatrix = {
    humanPassJudgePass: 0,
    humanPassJudgeFail: 0,
    humanFailJudgePass: 0,
    humanFailJudgeFail: 0,
  };
  let completedCases = 0;

  for (const result of results) {
    if (result.status !== "success" || !result.judgeLabel) continue;
    completedCases += 1;
    if (result.humanLabel === "pass" && result.judgeLabel === "pass") {
      confusion.humanPassJudgePass += 1;
    } else if (
      result.humanLabel === "pass" &&
      result.judgeLabel === "fail"
    ) {
      confusion.humanPassJudgeFail += 1;
    } else if (
      result.humanLabel === "fail" &&
      result.judgeLabel === "pass"
    ) {
      confusion.humanFailJudgePass += 1;
    } else {
      confusion.humanFailJudgeFail += 1;
    }
  }

  const matchingCases =
    confusion.humanPassJudgePass + confusion.humanFailJudgeFail;
  const humanPassCases =
    confusion.humanPassJudgePass + confusion.humanPassJudgeFail;
  const humanFailCases =
    confusion.humanFailJudgePass + confusion.humanFailJudgeFail;
  const judgePassCases =
    confusion.humanPassJudgePass + confusion.humanFailJudgePass;
  const judgeFailCases =
    confusion.humanPassJudgeFail + confusion.humanFailJudgeFail;
  const accuracy = ratio(matchingCases, completedCases);

  let cohenKappa: number | null = null;
  if (completedCases > 0 && accuracy !== null) {
    const expectedAgreement =
      (humanPassCases * judgePassCases + humanFailCases * judgeFailCases) /
      (completedCases * completedCases);
    if (expectedAgreement < 1) {
      cohenKappa = (accuracy - expectedAgreement) / (1 - expectedAgreement);
    }
  }

  return {
    totalCases: results.length,
    completedCases,
    errorCases: results.length - completedCases,
    matchingCases,
    accuracy,
    cohenKappa,
    badCaseMissRate: ratio(confusion.humanFailJudgePass, humanFailCases),
    falseRejectRate: ratio(confusion.humanPassJudgeFail, humanPassCases),
    confusion,
  };
}
