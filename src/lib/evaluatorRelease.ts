import type {
  EvaluatorCalibrationGateThresholds,
  EvaluatorRelease,
  EvaluatorVersion,
  JudgeCalibrationMetrics,
  JudgeCalibrationRun,
} from "@/types";
import { generateId } from "@/lib/id";
import { isEvaluatorVersionIntact } from "@/lib/evaluatorVersion";
import { calculateJudgeCalibrationMetrics } from "@/lib/judgeCalibration";
import { buildEvaluatorCalibrationCriteria } from "@/lib/judgeCalibrationRerun";
import { isMultiJudgeCalibrationEvidenceIntact } from "@/lib/multiJudgeCalibration";
import { redactSensitiveText } from "@/lib/redactSensitive";

export const DEFAULT_EVALUATOR_GATE_THRESHOLDS: EvaluatorCalibrationGateThresholds = {
  minCompletedCases: 20,
  minAccuracy: 0.9,
  minCohenKappa: 0.8,
  maxBadCaseMissRate: 0.05,
  requireZeroErrors: true,
};

export type EvaluatorGateCheckKey =
  | "evaluator_binding"
  | "criteria_binding"
  | "run_complete"
  | "result_integrity"
  | "metrics_integrity"
  | "sample_size"
  | "accuracy"
  | "cohen_kappa"
  | "bad_case_miss_rate"
  | "zero_errors";

export interface EvaluatorGateCheck {
  key: EvaluatorGateCheckKey;
  label: string;
  passed: boolean;
  actual: string;
  expected: string;
}

export interface EvaluatorCalibrationGateResult {
  passed: boolean;
  checks: EvaluatorGateCheck[];
}

export interface CreateEvaluatorReleaseInput {
  existingReleases: EvaluatorRelease[];
  evaluatorVersion: EvaluatorVersion;
  calibrationRun: JudgeCalibrationRun;
  releasedBy: string;
  id?: string;
  releaseTime?: number;
}

function fingerprint(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash = Math.imul(hash ^ value.charCodeAt(index), 0x01000193);
  }
  return `fp1:${(hash >>> 0).toString(16).padStart(8, "0")}:${value.length}`;
}

function percent(value: number | null): string {
  return value === null ? "不适用" : `${(value * 100).toFixed(1)}%`;
}

function cloneMetrics(metrics: JudgeCalibrationMetrics): JudgeCalibrationMetrics {
  return {
    ...metrics,
    confusion: { ...metrics.confusion },
  };
}

function cloneThresholds(
  thresholds: EvaluatorCalibrationGateThresholds
): EvaluatorCalibrationGateThresholds {
  return { ...thresholds };
}

function releaseIntegritySource(release: Omit<EvaluatorRelease, "integrityFingerprint">) {
  return JSON.stringify(release);
}

function calibrationResultsAreIntact(run: JudgeCalibrationRun): boolean {
  const caseIds = new Set<string>();
  return (
    isMultiJudgeCalibrationEvidenceIntact(run) &&
    run.results.length > 0 &&
    run.results.every((result) => {
      if (!result.caseId.trim() || caseIds.has(result.caseId)) return false;
      caseIds.add(result.caseId);
      if (result.humanLabel !== "pass" && result.humanLabel !== "fail") {
        return false;
      }
      if (result.status === "error") {
        return typeof result.error === "string" && Boolean(result.error.trim());
      }
      return (
        result.status === "success" &&
        (result.judgeLabel === "pass" || result.judgeLabel === "fail") &&
        typeof result.confidence === "number" &&
        Number.isFinite(result.confidence) &&
        result.confidence >= 0 &&
        result.confidence <= 1 &&
        typeof result.reason === "string" &&
        Boolean(result.reason.trim())
      );
    })
  );
}

function metricsMatch(
  stored: JudgeCalibrationMetrics,
  calculated: JudgeCalibrationMetrics
): boolean {
  return JSON.stringify(stored) === JSON.stringify(calculated);
}

export function evaluateEvaluatorCalibrationGate(
  evaluatorVersion: EvaluatorVersion,
  run: JudgeCalibrationRun,
  thresholds: EvaluatorCalibrationGateThresholds =
    DEFAULT_EVALUATOR_GATE_THRESHOLDS
): EvaluatorCalibrationGateResult {
  const sameFamily = run.evaluatorId === evaluatorVersion.evaluatorId;
  const definitionMatches =
    isEvaluatorVersionIntact(evaluatorVersion) &&
    sameFamily &&
    run.evaluatorDefinitionFingerprint ===
      evaluatorVersion.definitionFingerprint;
  let criteriaMatches = false;
  if (run.criteriaSource === "evaluator") {
    try {
      criteriaMatches =
        run.criteria.trim().replace(/\r\n/g, "\n") ===
        buildEvaluatorCalibrationCriteria(evaluatorVersion);
    } catch {
      criteriaMatches = false;
    }
  }
  const resultsIntact = calibrationResultsAreIntact(run);
  const calculatedMetrics = calculateJudgeCalibrationMetrics(run.results);
  const metricsIntact =
    resultsIntact && metricsMatch(run.metrics, calculatedMetrics);
  const checks: EvaluatorGateCheck[] = [
    {
      key: "evaluator_binding",
      label: "Evaluator 执行定义",
      passed: definitionMatches,
      actual: definitionMatches
        ? "同一家族且执行定义完整一致"
        : sameFamily
          ? "执行定义缺失、不完整或不一致"
          : "Evaluator 家族不一致",
      expected: "校准运行必须绑定同一家族的相同执行定义",
    },
    {
      key: "criteria_binding",
      label: "判定标准来源",
      passed: criteriaMatches,
      actual: criteriaMatches
        ? "Evaluator 完整定义"
        : run.criteriaSource === "evaluator"
          ? "来源标记与完整定义不一致"
          : "自定义标准",
      expected: "必须逐字同步 Evaluator，不允许自定义或修改旁路",
    },
    {
      key: "run_complete",
      label: "校准运行状态",
      passed: run.status === "done",
      actual: run.status,
      expected: "done",
    },
    {
      key: "result_integrity",
      label: "逐 Case 结果完整性",
      passed: resultsIntact,
      actual: resultsIntact ? `${run.results.length} 条唯一且结构完整` : "存在重复、缺失或非法结果",
      expected: "Case ID 唯一，成功与失败结果结构完整",
    },
    {
      key: "metrics_integrity",
      label: "指标计算一致性",
      passed: metricsIntact,
      actual: metricsIntact ? "已由逐 Case 结果复算一致" : "已存指标与复算结果不一致",
      expected: "所有指标必须与逐 Case 结果确定性一致",
    },
    {
      key: "sample_size",
      label: "有效样本数",
      passed: calculatedMetrics.completedCases >= thresholds.minCompletedCases,
      actual: `${calculatedMetrics.completedCases} 条`,
      expected: `至少 ${thresholds.minCompletedCases} 条`,
    },
    {
      key: "accuracy",
      label: "准确率",
      passed:
        calculatedMetrics.accuracy !== null &&
        calculatedMetrics.accuracy >= thresholds.minAccuracy,
      actual: percent(calculatedMetrics.accuracy),
      expected: `≥ ${percent(thresholds.minAccuracy)}`,
    },
    {
      key: "cohen_kappa",
      label: "Cohen's κ",
      passed:
        calculatedMetrics.cohenKappa !== null &&
        calculatedMetrics.cohenKappa >= thresholds.minCohenKappa,
      actual:
        calculatedMetrics.cohenKappa === null
          ? "不适用"
          : calculatedMetrics.cohenKappa.toFixed(3),
      expected: `≥ ${thresholds.minCohenKappa.toFixed(3)}`,
    },
    {
      key: "bad_case_miss_rate",
      label: "Bad Case 漏判率",
      passed:
        calculatedMetrics.badCaseMissRate !== null &&
        calculatedMetrics.badCaseMissRate <= thresholds.maxBadCaseMissRate,
      actual: percent(calculatedMetrics.badCaseMissRate),
      expected: `≤ ${percent(thresholds.maxBadCaseMissRate)}`,
    },
    {
      key: "zero_errors",
      label: "调用错误",
      passed:
        !thresholds.requireZeroErrors || calculatedMetrics.errorCases === 0,
      actual: `${calculatedMetrics.errorCases} 条`,
      expected: thresholds.requireZeroErrors ? "必须为 0 条" : "允许错误",
    },
  ];
  return { passed: checks.every((check) => check.passed), checks };
}

export function isEvaluatorReleaseIntact(release: EvaluatorRelease): boolean {
  const { integrityFingerprint, ...snapshot } = release;
  return integrityFingerprint === fingerprint(releaseIntegritySource(snapshot));
}

export function getActiveEvaluatorRelease(
  releases: EvaluatorRelease[],
  evaluatorId: string
): EvaluatorRelease | undefined {
  return releases
    .filter(
      (release) =>
        release.evaluatorId === evaluatorId &&
        isEvaluatorReleaseIntact(release)
    )
    .sort(
      (left, right) =>
        right.releaseTime - left.releaseTime || right.id.localeCompare(left.id)
    )[0];
}

export function createEvaluatorRelease(
  input: CreateEvaluatorReleaseInput
): EvaluatorRelease {
  const thresholds = cloneThresholds(DEFAULT_EVALUATOR_GATE_THRESHOLDS);
  const gate = evaluateEvaluatorCalibrationGate(
    input.evaluatorVersion,
    input.calibrationRun,
    thresholds
  );
  if (!gate.passed) {
    const failed = gate.checks
      .filter((check) => !check.passed)
      .map((check) => check.label)
      .join("、");
    throw new Error(`Evaluator 未通过发布门禁：${failed}`);
  }
  const releasedBy = redactSensitiveText(input.releasedBy.trim());
  if (!releasedBy) throw new Error("发布人不能为空");
  if (releasedBy.length > 40) throw new Error("发布人不能超过 40 个字符");
  const id = input.id ?? generateId();
  if (input.existingReleases.some((release) => release.id === id)) {
    throw new Error("Evaluator 发布记录 id 已存在");
  }
  const previous = getActiveEvaluatorRelease(
    input.existingReleases,
    input.evaluatorVersion.evaluatorId
  );
  const snapshot = {
    id,
    releaseTime: input.releaseTime ?? Date.now(),
    releasedBy,
    evaluatorId: input.evaluatorVersion.evaluatorId,
    evaluatorVersionId: input.evaluatorVersion.id,
    evaluatorVersionName: input.evaluatorVersion.name,
    evaluatorVersion: input.evaluatorVersion.version,
    evaluatorDefinitionFingerprint:
      input.evaluatorVersion.definitionFingerprint,
    calibrationRunId: input.calibrationRun.id,
    goldenDatasetVersionId: input.calibrationRun.goldenDatasetVersionId,
    goldenDatasetName: input.calibrationRun.goldenDatasetName,
    goldenDatasetVersion: input.calibrationRun.goldenDatasetVersion,
    judgeModelId: input.calibrationRun.judgeModelId,
    judgeModelName: input.calibrationRun.judgeModelName,
    ...(input.calibrationRun.judgeModels
      ? {
          judgeModels: input.calibrationRun.judgeModels.map((judge) => ({
            ...judge,
          })),
        }
      : {}),
    ...(input.calibrationRun.arbitrationStrategy
      ? { arbitrationStrategy: input.calibrationRun.arbitrationStrategy }
      : {}),
    thresholds,
    calibrationMetrics: cloneMetrics(
      calculateJudgeCalibrationMetrics(input.calibrationRun.results)
    ),
    previousReleaseId: previous?.id,
  };
  return {
    ...snapshot,
    integrityFingerprint: fingerprint(releaseIntegritySource(snapshot)),
  };
}
