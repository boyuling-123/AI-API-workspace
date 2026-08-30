"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  EvaluatorRelease,
  EvaluatorVersion,
  GoldenDatasetVersion,
  JudgeArbitrationStrategy,
  JudgeCalibrationChangeKind,
  JudgeCalibrationCriteriaSource,
  JudgeCalibrationMetrics,
  JudgeCalibrationRun,
} from "@/types";
import { formatDateTime } from "@/lib/datetime";
import { isEvaluatorVersionIntact } from "@/lib/evaluatorVersion";
import { isGoldenDatasetVersionIntact } from "@/lib/goldenDataset";
import {
  buildEvaluatorCalibrationCriteria,
  buildJudgeCalibrationRerunPlan,
  JUDGE_CALIBRATION_CHANGE_LABELS,
} from "@/lib/judgeCalibrationRerun";
import {
  buildMultiJudgeSelectionId,
  hasJudgeDisagreement,
  MAX_MULTI_JUDGES,
} from "@/lib/multiJudgeCalibration";
import { runJudgeCalibration } from "@/services/judgeCalibrationClient";
import { runMultiJudgeCalibration } from "@/services/multiJudgeCalibrationClient";
import { EvaluatorReleaseGate } from "@/components/calibration/EvaluatorReleaseGate";

interface JudgeModelOption {
  id: string;
  name: string;
}

interface JudgeCalibrationPanelProps {
  versions: GoldenDatasetVersion[];
  evaluatorVersions: EvaluatorVersion[];
  judgeModels: JudgeModelOption[];
  runs: JudgeCalibrationRun[];
  releases: EvaluatorRelease[];
  onSaveRun: (run: JudgeCalibrationRun) => void;
  onSaveRelease: (release: EvaluatorRelease) => void;
}

const DEFAULT_CRITERIA =
  "候选输出必须满足事实正确、关键字段完整、格式合规且不存在明显业务风险，才判定为 pass。";
const CUSTOM_EVALUATOR_VALUE = "__custom_criteria__";
type CalibrationMode = "single" | "multi";

const ARBITRATION_STRATEGY_LABELS: Record<
  JudgeArbitrationStrategy,
  string
> = {
  majority_conservative: "多数票（平票保守 fail）",
  unanimous_pass: "全票通过",
};

function formatPercent(value: number | null): string {
  if (value === null) return "不适用";
  return `${(value * 100).toFixed(1)}%`;
}

function formatKappa(value: number | null): string {
  return value === null ? "不适用" : value.toFixed(3);
}

function runStatus(run: JudgeCalibrationRun): string {
  if (run.status === "done") return "完成";
  if (run.status === "partial") return "部分完成";
  return "失败";
}

function triggerText(run: JudgeCalibrationRun): string {
  if (run.trigger === "configuration_change") return "配置变化重跑";
  if (run.trigger === "manual_repeat") return "相同配置复跑";
  return "首次校准";
}

function changeLabels(changeKinds: JudgeCalibrationChangeKind[]): string[] {
  return changeKinds.map((kind) => JUDGE_CALIBRATION_CHANGE_LABELS[kind]);
}

function metricDelta(
  current: number | null,
  baseline: number | null,
  digits = 1
): string {
  if (current === null || baseline === null) return "不适用";
  const delta = (current - baseline) * 100;
  const prefix = delta > 0 ? "+" : "";
  return `${prefix}${delta.toFixed(digits)} pp`;
}

function CalibrationComparison({
  baseline,
  current,
}: {
  baseline: JudgeCalibrationRun;
  current: JudgeCalibrationRun;
}) {
  const rows = [
    {
      label: "准确率",
      before: formatPercent(baseline.metrics.accuracy),
      after: formatPercent(current.metrics.accuracy),
      delta: metricDelta(current.metrics.accuracy, baseline.metrics.accuracy),
    },
    {
      label: "Cohen's κ",
      before: formatKappa(baseline.metrics.cohenKappa),
      after: formatKappa(current.metrics.cohenKappa),
      delta:
        current.metrics.cohenKappa === null ||
        baseline.metrics.cohenKappa === null
          ? "不适用"
          : `${current.metrics.cohenKappa - baseline.metrics.cohenKappa >= 0 ? "+" : ""}${(
              current.metrics.cohenKappa - baseline.metrics.cohenKappa
            ).toFixed(3)}`,
    },
    {
      label: "Bad Case 漏判率",
      before: formatPercent(baseline.metrics.badCaseMissRate),
      after: formatPercent(current.metrics.badCaseMissRate),
      delta: metricDelta(
        current.metrics.badCaseMissRate,
        baseline.metrics.badCaseMissRate
      ),
    },
  ];
  return (
    <section
      aria-label="Judge 校准前后对比"
      className="overflow-hidden rounded-xl border border-cyan-200 dark:border-cyan-500/30"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 bg-cyan-50 px-3 py-2 text-xs dark:bg-cyan-500/10">
        <p className="font-semibold text-cyan-900 dark:text-cyan-100">
          基线与本次结果
        </p>
        <p className="text-cyan-800 dark:text-cyan-200">
          {changeLabels(current.changeKinds ?? []).join(" / ") || "相同配置"}
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[420px] text-xs">
          <thead className="bg-slate-50 text-slate-500 dark:bg-slate-800">
            <tr>
              <th className="px-3 py-2 text-left">指标</th>
              <th className="px-3 py-2 text-right">基线</th>
              <th className="px-3 py-2 text-right">本次</th>
              <th className="px-3 py-2 text-right">变化</th>
            </tr>
          </thead>
          <tbody className="text-slate-700 dark:text-slate-200">
            {rows.map((row) => (
              <tr key={row.label} className="border-t border-slate-100 dark:border-slate-800">
                <th className="px-3 py-2 text-left font-medium">{row.label}</th>
                <td className="px-3 py-2 text-right">{row.before}</td>
                <td className="px-3 py-2 text-right font-semibold">{row.after}</td>
                <td className="px-3 py-2 text-right font-mono">{row.delta}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="border-t border-cyan-100 px-3 py-2 text-[11px] text-slate-500 dark:border-cyan-500/20 dark:text-slate-400">
        基线：{baseline.evaluatorVersionName ?? "自定义标准"}
        {baseline.evaluatorVersion ? ` v${baseline.evaluatorVersion}` : ""} · {formatDateTime(baseline.finishTime)}
      </p>
    </section>
  );
}

function MetricsCards({ metrics }: { metrics: JudgeCalibrationMetrics }) {
  const cards = [
    { label: "准确率", value: formatPercent(metrics.accuracy), tone: "text-blue-700 dark:text-blue-300" },
    { label: "Cohen's κ", value: formatKappa(metrics.cohenKappa), tone: "text-slate-800 dark:text-white" },
    { label: "Bad Case 漏判率", value: formatPercent(metrics.badCaseMissRate), tone: "text-red-700 dark:text-red-300" },
    { label: "成功 / 失败", value: `${metrics.completedCases} / ${metrics.errorCases}`, tone: "text-amber-700 dark:text-amber-300" },
  ];
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <div key={card.label} className="rounded-xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-900">
          <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {card.label}
          </p>
          <p className={`mt-1 text-xl font-bold ${card.tone}`}>{card.value}</p>
        </div>
      ))}
    </div>
  );
}

function runCallCount(run: JudgeCalibrationRun): number {
  return run.metrics.totalCases * (run.judgeModels?.length ?? 1);
}

function PerJudgeMetrics({ run }: { run: JudgeCalibrationRun }) {
  if (!run.perJudgeMetrics?.length) return null;
  return (
    <section
      aria-label="逐 Judge 校准指标"
      className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50 px-3 py-2 dark:bg-slate-800">
        <div>
          <h4 className="text-xs font-semibold text-slate-700 dark:text-slate-200">
            逐 Judge 指标
          </h4>
          <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
            原始投票独立统计，不使用最终仲裁结果代替。
          </p>
        </div>
        <span className="rounded-full bg-cyan-100 px-2 py-1 text-[11px] font-semibold text-cyan-800 dark:bg-cyan-500/15 dark:text-cyan-200">
          Judge 内部分歧 {run.disagreementCases ?? 0} 条
        </span>
      </div>
      <div className="grid gap-2 p-3">
        {run.perJudgeMetrics.map((item) => (
          <article
            key={item.judgeModelId}
            aria-label={`${item.judgeModelName} 校准指标`}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 dark:border-slate-700 dark:bg-slate-900"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h5 className="text-xs font-semibold text-slate-800 dark:text-slate-100">
                {item.judgeModelName}
              </h5>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                成功 / 失败 {item.metrics.completedCases} / {item.metrics.errorCases}
              </span>
            </div>
            <dl className="mt-2 grid grid-cols-3 gap-2 text-[11px]">
              <div>
                <dt className="text-slate-500 dark:text-slate-400">准确率</dt>
                <dd className="mt-0.5 font-mono font-semibold text-slate-800 dark:text-slate-100">
                  {formatPercent(item.metrics.accuracy)}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500 dark:text-slate-400">Cohen&apos;s κ</dt>
                <dd className="mt-0.5 font-mono font-semibold text-slate-800 dark:text-slate-100">
                  {formatKappa(item.metrics.cohenKappa)}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500 dark:text-slate-400">Bad Case 漏判率</dt>
                <dd className="mt-0.5 font-mono font-semibold text-slate-800 dark:text-slate-100">
                  {formatPercent(item.metrics.badCaseMissRate)}
                </dd>
              </div>
            </dl>
          </article>
        ))}
      </div>
    </section>
  );
}

export function JudgeCalibrationPanel({
  versions,
  evaluatorVersions,
  judgeModels,
  runs,
  releases,
  onSaveRun,
  onSaveRelease,
}: JudgeCalibrationPanelProps) {
  const usableVersions = useMemo(
    () =>
      versions
        .filter(isGoldenDatasetVersionIntact)
        .sort((left, right) => left.createTime - right.createTime),
    [versions]
  );
  const sortedRuns = useMemo(
    () => [...runs].sort((left, right) => right.finishTime - left.finishTime),
    [runs]
  );
  const usableEvaluatorVersions = useMemo(
    () =>
      evaluatorVersions
        .filter(isEvaluatorVersionIntact)
        .sort((left, right) => left.createTime - right.createTime),
    [evaluatorVersions]
  );
  const [datasetVersionId, setDatasetVersionId] = useState("");
  const selectedVersion =
    usableVersions.find((item) => item.id === datasetVersionId) ??
    usableVersions.at(-1);
  const [judgeModelId, setJudgeModelId] = useState("");
  const selectedJudge =
    judgeModels.find((item) => item.id === judgeModelId) ?? judgeModels[0];
  const [calibrationMode, setCalibrationMode] =
    useState<CalibrationMode>("single");
  const [multiJudgeIds, setMultiJudgeIds] = useState<string[]>([]);
  const [arbitrationStrategy, setArbitrationStrategy] =
    useState<JudgeArbitrationStrategy>("majority_conservative");
  const selectedMultiJudges = useMemo(
    () =>
      judgeModels.filter((model) => multiJudgeIds.includes(model.id)).slice(0, MAX_MULTI_JUDGES),
    [judgeModels, multiJudgeIds]
  );
  const multiSelectionReady =
    selectedMultiJudges.length >= 2 &&
    selectedMultiJudges.length <= MAX_MULTI_JUDGES;
  const selectedJudgesReady =
    calibrationMode === "single" ? Boolean(selectedJudge) : multiSelectionReady;
  const executionJudgeModelId = useMemo(() => {
    if (calibrationMode === "single") return selectedJudge?.id ?? "";
    if (!multiSelectionReady) return "";
    return buildMultiJudgeSelectionId(
      selectedMultiJudges,
      arbitrationStrategy
    );
  }, [
    arbitrationStrategy,
    calibrationMode,
    multiSelectionReady,
    selectedJudge?.id,
    selectedMultiJudges,
  ]);
  const [evaluatorVersionId, setEvaluatorVersionId] = useState("");
  const selectedEvaluator =
    evaluatorVersionId === CUSTOM_EVALUATOR_VALUE
      ? undefined
      : usableEvaluatorVersions.find(
          (item) => item.id === evaluatorVersionId
        ) ?? usableEvaluatorVersions.at(-1);
  const [criteria, setCriteria] = useState(DEFAULT_CRITERIA);
  const [criteriaSource, setCriteriaSource] =
    useState<JudgeCalibrationCriteriaSource>("custom");
  const [concurrency, setConcurrency] = useState(3);
  const [confirming, setConfirming] = useState(false);
  const [largeRunConfirmation, setLargeRunConfirmation] = useState("");
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ completed: 0, total: 0 });
  const [selectedRunId, setSelectedRunId] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    if (!selectedEvaluator) return;
    try {
      setCriteria(buildEvaluatorCalibrationCriteria(selectedEvaluator));
      setCriteriaSource("evaluator");
      setError("");
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Evaluator 校准标准生成失败"
      );
    }
  }, [selectedEvaluator]);
  const selectedRun =
    sortedRuns.find((item) => item.id === selectedRunId) ?? sortedRuns[0];
  const rerunPlan = useMemo(
    () =>
      buildJudgeCalibrationRerunPlan({
        datasetVersionId: selectedVersion?.id ?? "",
        judgeModelId: executionJudgeModelId,
        criteria,
        criteriaSource,
        evaluatorVersion: selectedEvaluator,
        runs,
      }),
    [
      criteria,
      criteriaSource,
      runs,
      selectedEvaluator,
      executionJudgeModelId,
      selectedVersion?.id,
    ]
  );
  const comparisonBaseline = selectedRun?.baselineRunId
    ? runs.find((run) => run.id === selectedRun.baselineRunId)
    : undefined;
  const caseCount = selectedVersion?.cases.length ?? 0;
  const selectedJudgeCount =
    calibrationMode === "single"
      ? selectedJudge
        ? 1
        : 0
      : selectedMultiJudges.length;
  const callCount = caseCount * selectedJudgeCount;
  const requiresTypedConfirmation = callCount >= 100;
  const canConfirm =
    !requiresTypedConfirmation || largeRunConfirmation.trim() === String(callCount);
  const disagreements = selectedRun
    ? selectedRun.results.filter(
        (item) =>
          item.status === "error" ||
          item.humanLabel !== item.judgeLabel ||
          hasJudgeDisagreement(item.votes ?? [])
      )
    : [];
  const rerunChangeLabels = changeLabels(rerunPlan.changeKinds);
  const actionLabel =
    rerunPlan.trigger === "configuration_change"
      ? "预览并启动重跑"
      : rerunPlan.trigger === "manual_repeat"
        ? "预览并再次校准"
        : "预览并启动校准";

  function selectEvaluatorVersion(value: string) {
    setEvaluatorVersionId(value);
    if (value === CUSTOM_EVALUATOR_VALUE) {
      setCriteria(DEFAULT_CRITERIA);
      setCriteriaSource("custom");
      setError("");
    }
  }

  function selectCalibrationMode(mode: CalibrationMode) {
    setCalibrationMode(mode);
    setConfirming(false);
    setMessage("");
    setError("");
  }

  function toggleMultiJudge(modelId: string) {
    setMultiJudgeIds((current) => {
      const availableIds = new Set(judgeModels.map((model) => model.id));
      const normalized = current.filter((id) => availableIds.has(id));
      if (normalized.includes(modelId)) {
        return normalized.filter((id) => id !== modelId);
      }
      if (normalized.length >= MAX_MULTI_JUDGES) return normalized;
      return [...normalized, modelId];
    });
    setMessage("");
    setError("");
  }

  function syncEvaluatorCriteria() {
    if (!selectedEvaluator) return;
    try {
      setCriteria(buildEvaluatorCalibrationCriteria(selectedEvaluator));
      setCriteriaSource("evaluator");
      setError("");
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Evaluator 校准标准生成失败"
      );
    }
  }

  function openConfirmation() {
    if (!selectedVersion) {
      setError("请先发布至少一个人工黄金集版本");
      return;
    }
    if (calibrationMode === "single" && !selectedJudge) {
      setError("没有可用的文本 Judge，请先在接口创建与管理中配置");
      return;
    }
    if (calibrationMode === "multi" && !multiSelectionReady) {
      setError(`多 Judge 校准必须选择 2-${MAX_MULTI_JUDGES} 个 Judge`);
      return;
    }
    if (!criteria.trim()) {
      setError("请填写校准判定标准");
      return;
    }
    setLargeRunConfirmation("");
    setError("");
    setConfirming(true);
  }

  async function confirmAndRun() {
    if (!selectedVersion || !selectedJudgesReady || !canConfirm || running) {
      return;
    }
    setConfirming(false);
    setRunning(true);
    setMessage("");
    setError("");
    setProgress({ completed: 0, total: callCount });
    try {
      let run: JudgeCalibrationRun;
      if (calibrationMode === "multi") {
        run = await runMultiJudgeCalibration({
          datasetVersion: selectedVersion,
          judges: selectedMultiJudges,
          arbitrationStrategy,
          criteria,
          criteriaSource,
          evaluatorVersion: selectedEvaluator,
          rerunPlan,
          concurrency,
          onProgress: (completed, total) => setProgress({ completed, total }),
        });
      } else {
        if (!selectedJudge) return;
        run = await runJudgeCalibration({
          datasetVersion: selectedVersion,
          judgeModelId: selectedJudge.id,
          judgeModelName: selectedJudge.name,
          criteria,
          criteriaSource,
          evaluatorVersion: selectedEvaluator,
          rerunPlan,
          concurrency,
          onProgress: (completed, total) => setProgress({ completed, total }),
        });
      }
      onSaveRun(run);
      setSelectedRunId(run.id);
      setMessage(
        calibrationMode === "multi"
          ? `多 Judge 校准完成：Case 成功 ${run.metrics.completedCases} 条，失败 ${run.metrics.errorCases} 条，共调用 ${runCallCount(run)} 次。`
          : `${run.trigger === "configuration_change" ? "重跑" : "校准"}完成：成功 ${run.metrics.completedCases} 条，失败 ${run.metrics.errorCases} 条。`
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "校准运行失败");
    } finally {
      setRunning(false);
    }
  }

  return (
    <section aria-label="Judge 校准运行" className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card dark:border-slate-700 dark:bg-slate-900">
      <div className="border-b border-slate-200 bg-slate-950 px-6 py-5 text-white dark:border-slate-700">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">
              Calibration run
            </p>
            <h2 className="mt-2 text-xl font-bold">Judge 与人工真值一致性</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
              人工标签只在浏览器本地用于对比，不发送给 Judge。准确率、κ、漏判率和混淆矩阵由平台确定性计算。
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs font-semibold">
            <span className="rounded-full bg-cyan-400/10 px-3 py-1 text-cyan-200">
              预览 {callCount} 次 Judge 调用
            </span>
            <span className="rounded-full bg-emerald-400/10 px-3 py-1 text-emerald-200">
              0 次被测模型调用
            </span>
          </div>
        </div>
      </div>

      <div className="grid gap-5 p-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <section aria-label="Judge 校准配置" className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-950/50">
          <h3 className="font-semibold text-slate-800 dark:text-slate-100">运行配置</h3>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
              黄金集版本
              <select
                aria-label="校准黄金集版本"
                value={selectedVersion?.id ?? ""}
                onChange={(event) => setDatasetVersionId(event.target.value)}
                disabled={running}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
              >
                {usableVersions.length === 0 && <option value="">暂无已发布版本</option>}
                {usableVersions.map((version) => (
                  <option key={version.id} value={version.id}>
                    {version.name} v{version.version} · {version.cases.length} 条
                  </option>
                ))}
              </select>
            </label>
            <fieldset
              aria-label="Judge 校准模式"
              disabled={running}
              className="text-xs font-medium text-slate-600 dark:text-slate-300"
            >
              <legend>运行方式</legend>
              <div className="mt-1 grid grid-cols-2 rounded-lg border border-slate-300 bg-white p-1 dark:border-slate-600 dark:bg-slate-900">
                {(
                  [
                    ["single", "单 Judge"],
                    ["multi", "多 Judge"],
                  ] as const
                ).map(([mode, label]) => (
                  <button
                    key={mode}
                    type="button"
                    aria-pressed={calibrationMode === mode}
                    onClick={() => selectCalibrationMode(mode)}
                    className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                      calibrationMode === mode
                        ? "bg-cyan-700 text-white shadow-sm"
                        : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </fieldset>
            {calibrationMode === "single" ? (
              <label className="text-xs font-medium text-slate-600 dark:text-slate-300 sm:col-span-2">
                Judge
                <select
                  aria-label="校准 Judge"
                  value={selectedJudge?.id ?? ""}
                  onChange={(event) => setJudgeModelId(event.target.value)}
                  disabled={running}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
                >
                  {judgeModels.length === 0 && <option value="">暂无可用 Judge</option>}
                  {judgeModels.map((model) => (
                    <option key={model.id} value={model.id}>{model.name}</option>
                  ))}
                </select>
              </label>
            ) : (
              <fieldset
                aria-label="多 Judge 选择"
                disabled={running}
                className="rounded-xl border border-cyan-200 bg-cyan-50/70 p-3 text-xs sm:col-span-2 dark:border-cyan-500/30 dark:bg-cyan-500/5"
              >
                <legend className="px-1 font-semibold text-cyan-950 dark:text-cyan-100">
                  Judge 组合
                </legend>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-slate-600 dark:text-slate-300">
                    独立投票，完整保留每个模型的原始结果
                  </span>
                  <span className={`font-semibold ${multiSelectionReady ? "text-emerald-700 dark:text-emerald-300" : "text-amber-700 dark:text-amber-300"}`}>
                    已选择 {selectedMultiJudges.length} / {MAX_MULTI_JUDGES}，至少 2 个
                  </span>
                </div>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {judgeModels.map((model) => {
                    const checked = multiJudgeIds.includes(model.id);
                    const disabled =
                      !checked && multiJudgeIds.length >= MAX_MULTI_JUDGES;
                    return (
                      <label
                        key={model.id}
                        className={`flex min-w-0 items-start gap-2 rounded-lg border px-3 py-2 transition ${
                          checked
                            ? "border-cyan-400 bg-white text-cyan-950 shadow-sm dark:border-cyan-400/60 dark:bg-slate-900 dark:text-cyan-100"
                            : "border-cyan-100 bg-white/60 text-slate-700 hover:border-cyan-300 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-200"
                        } ${disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}
                      >
                        <input
                          type="checkbox"
                          aria-label={`选择 Judge ${model.name}`}
                          checked={checked}
                          disabled={disabled}
                          onChange={() => toggleMultiJudge(model.id)}
                          className="mt-0.5 h-4 w-4 rounded border-slate-300 text-cyan-700 focus:ring-cyan-600"
                        />
                        <span className="min-w-0 break-words font-medium">
                          {model.name}
                        </span>
                      </label>
                    );
                  })}
                </div>
                {judgeModels.length < 2 && (
                  <p role="alert" className="mt-2 text-amber-800 dark:text-amber-200">
                    当前少于 2 个可用文本 Judge，请先在接口创建与管理中配置。
                  </p>
                )}
                <label className="mt-3 block font-medium text-slate-700 dark:text-slate-200">
                  仲裁策略
                  <select
                    aria-label="多 Judge 仲裁策略"
                    value={arbitrationStrategy}
                    onChange={(event) => {
                      setArbitrationStrategy(
                        event.target.value as JudgeArbitrationStrategy
                      );
                      setMessage("");
                      setError("");
                    }}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
                  >
                    {Object.entries(ARBITRATION_STRATEGY_LABELS).map(
                      ([strategy, label]) => (
                        <option key={strategy} value={strategy}>{label}</option>
                      )
                    )}
                  </select>
                </label>
                <p className="mt-2 leading-5 text-slate-600 dark:text-slate-300">
                  {arbitrationStrategy === "majority_conservative"
                    ? "多数票决定最终标签；票数相同时固定判为 fail。"
                    : "只有全部 Judge 都判为 pass 才通过，其余情况判为 fail。"}
                  任一 Judge 缺失或失败时，该 Case 记为错误，不使用残缺票数仲裁。
                </p>
                <div
                  aria-label="多 Judge 调用矩阵预览"
                  className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-950 px-3 py-2 text-white"
                >
                  <span className="font-medium">精确调用矩阵</span>
                  <span className="font-mono font-semibold text-cyan-200">
                    {caseCount} Case × {selectedMultiJudges.length} Judge = {callCount} 次调用
                  </span>
                </div>
              </fieldset>
            )}
            <label className="text-xs font-medium text-slate-600 dark:text-slate-300 sm:col-span-2">
              Evaluator 版本
              <select
                aria-label="校准 Evaluator 版本"
                value={selectedEvaluator?.id ?? CUSTOM_EVALUATOR_VALUE}
                onChange={(event) => selectEvaluatorVersion(event.target.value)}
                disabled={running}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
              >
                <option value={CUSTOM_EVALUATOR_VALUE}>自定义判定标准（不绑定版本）</option>
                {usableEvaluatorVersions.map((version) => (
                  <option key={version.id} value={version.id}>
                    {version.name} v{version.version} · {version.createdBy}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="mt-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label htmlFor="judge-calibration-criteria" className="text-xs font-medium text-slate-600 dark:text-slate-300">
                校准判定标准
              </label>
              <div className="flex items-center gap-2 text-[11px]">
                <span className="rounded-full bg-slate-200 px-2 py-0.5 text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                  {criteriaSource === "evaluator" ? "已同步 Evaluator" : "自定义"}
                </span>
                {selectedEvaluator && criteriaSource === "custom" && (
                  <button
                    type="button"
                    onClick={syncEvaluatorCriteria}
                    className="font-semibold text-cyan-700 underline-offset-2 hover:underline dark:text-cyan-300"
                  >
                    重新同步版本定义
                  </button>
                )}
              </div>
            </div>
            <textarea
              id="judge-calibration-criteria"
              aria-label="校准判定标准"
              value={criteria}
              onChange={(event) => {
                setCriteria(event.target.value);
                setCriteriaSource("custom");
              }}
              disabled={running}
              rows={6}
              className="mt-1 w-full resize-y rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm leading-6 text-slate-900 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
            />
            <p className="mt-1 text-right text-[11px] text-slate-500">
              {criteria.length.toLocaleString()} 字符
            </p>
          </div>
          <label className="mt-3 block text-xs font-medium text-slate-600 dark:text-slate-300">
            Judge 并发
            <select
              aria-label="Judge 校准并发"
              value={concurrency}
              onChange={(event) => setConcurrency(Number(event.target.value))}
              disabled={running}
              className="mt-1 w-28 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
            >
              {[1, 2, 3, 4, 5].map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
          </label>

          <div aria-label="Judge 校准重跑计划" className={`mt-4 rounded-xl border p-3 text-xs leading-5 ${rerunPlan.trigger === "configuration_change" ? "border-cyan-200 bg-cyan-50 text-cyan-900 dark:border-cyan-500/30 dark:bg-cyan-500/10 dark:text-cyan-100" : rerunPlan.trigger === "manual_repeat" ? "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100" : "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-100"}`}>
            <p className="font-semibold">
              {rerunPlan.trigger === "configuration_change"
                ? "已自动生成配置变化重跑任务"
                : rerunPlan.trigger === "manual_repeat"
                  ? "相同执行配置已有校准结果"
                  : "首次校准任务"}
            </p>
            {rerunPlan.trigger === "configuration_change" && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {rerunChangeLabels.map((label) => (
                  <span key={label} className="rounded-full border border-current/20 px-2 py-0.5 font-medium">
                    {label} 已变化
                  </span>
                ))}
              </div>
            )}
            <p className="mt-1 opacity-80">
              {rerunPlan.trigger === "configuration_change"
                ? "确认后追加新运行并关联基线，旧结果不会覆盖。"
                : rerunPlan.trigger === "manual_repeat"
                  ? "平台不会自动调用；如需观察 Judge 波动，可主动确认再次运行。"
                  : "尚无同黄金集基线，确认后建立首个可追溯结果。"}
            </p>
          </div>
          <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
            启动前会再次展示调用数。失败 Case 会单独保留，绝不会静默跳过或写成通过。
          </div>
          {message && <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">{message}</p>}
          {error && <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-500/10 dark:text-red-300">{error}</p>}
          {running && (
            <div aria-label="Judge 校准进度" className="mt-3">
              <div className="flex justify-between text-xs text-slate-500"><span>校准运行中</span><span>{progress.completed} / {progress.total}</span></div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                <div className="h-full rounded-full bg-cyan-500 transition-[width]" style={{ width: `${progress.total ? (progress.completed / progress.total) * 100 : 0}%` }} />
              </div>
            </div>
          )}
          <button
            type="button"
            onClick={openConfirmation}
            disabled={running || !selectedVersion || !selectedJudgesReady}
            className="mt-4 w-full rounded-lg bg-cyan-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-cyan-800 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {running ? `校准中 ${progress.completed}/${progress.total}` : actionLabel}
          </button>
        </section>

        <section aria-label="Judge 校准结果" className="min-w-0 rounded-xl border border-slate-200 p-4 dark:border-slate-700">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h3 className="font-semibold text-slate-800 dark:text-slate-100">校准结果与分歧下钻</h3>
              <p className="mt-1 text-xs text-slate-500">漏判定义：人工 fail、Judge pass。</p>
            </div>
            <label className="text-xs text-slate-500">
              历史运行
              <select
                aria-label="查看 Judge 校准历史"
                value={selectedRun?.id ?? ""}
                onChange={(event) => setSelectedRunId(event.target.value)}
                className="ml-2 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-800 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
              >
                {sortedRuns.length === 0 && <option value="">暂无历史</option>}
                {sortedRuns.map((run) => (
                  <option key={run.id} value={run.id}>
                    {run.goldenDatasetName} v{run.goldenDatasetVersion}
                    {run.evaluatorVersionName ? ` · ${run.evaluatorVersionName} v${run.evaluatorVersion}` : ""} · {formatDateTime(run.finishTime)}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {selectedRun ? (
            <div className="mt-4 space-y-4">
              <div className="flex flex-wrap gap-2 text-[11px] text-slate-600 dark:text-slate-300">
                <span className="rounded-full bg-slate-100 px-2 py-1 dark:bg-slate-800">{selectedRun.judgeModelName}</span>
                <span className="rounded-full bg-slate-100 px-2 py-1 dark:bg-slate-800">{runStatus(selectedRun)}</span>
                <span className="rounded-full bg-slate-100 px-2 py-1 dark:bg-slate-800">{triggerText(selectedRun)}</span>
                {selectedRun.evaluatorVersionName && (
                  <span className="rounded-full bg-slate-100 px-2 py-1 dark:bg-slate-800">
                    {selectedRun.evaluatorVersionName} v{selectedRun.evaluatorVersion}
                  </span>
                )}
                {selectedRun.arbitrationStrategy && (
                  <span className="rounded-full bg-cyan-100 px-2 py-1 font-semibold text-cyan-800 dark:bg-cyan-500/15 dark:text-cyan-200">
                    {ARBITRATION_STRATEGY_LABELS[selectedRun.arbitrationStrategy]}
                  </span>
                )}
                <span className="rounded-full bg-slate-100 px-2 py-1 dark:bg-slate-800">{runCallCount(selectedRun)} 次调用</span>
              </div>
              <MetricsCards metrics={selectedRun.metrics} />
              <PerJudgeMetrics run={selectedRun} />
              {comparisonBaseline && (
                <CalibrationComparison
                  baseline={comparisonBaseline}
                  current={selectedRun}
                />
              )}

              <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
                <table aria-label="Judge 校准混淆矩阵" className="w-full text-center text-xs">
                  <thead className="bg-slate-50 text-slate-500 dark:bg-slate-800">
                    <tr><th className="px-3 py-2 text-left">人工真值</th><th className="px-3 py-2">{selectedRun.judgeModels ? "仲裁 pass" : "Judge pass"}</th><th className="px-3 py-2">{selectedRun.judgeModels ? "仲裁 fail" : "Judge fail"}</th></tr>
                  </thead>
                  <tbody className="text-slate-700 dark:text-slate-200">
                    <tr className="border-t border-slate-100 dark:border-slate-800"><th className="px-3 py-2 text-left">人工 pass</th><td>{selectedRun.metrics.confusion.humanPassJudgePass}</td><td>{selectedRun.metrics.confusion.humanPassJudgeFail}</td></tr>
                    <tr className="border-t border-slate-100 dark:border-slate-800"><th className="px-3 py-2 text-left">人工 fail</th><td className="font-bold text-red-600 dark:text-red-300">{selectedRun.metrics.confusion.humanFailJudgePass}</td><td>{selectedRun.metrics.confusion.humanFailJudgeFail}</td></tr>
                  </tbody>
                </table>
              </div>

              <div>
                <div className="flex items-center justify-between"><h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200">分歧与失败样本</h4><span className="text-xs text-slate-500">{disagreements.length} 条</span></div>
                {disagreements.length === 0 ? (
                  <p className="mt-2 rounded-lg bg-emerald-50 px-3 py-4 text-center text-xs text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                    {selectedRun.judgeModels
                      ? "所有 Judge 投票一致，且仲裁结果均与人工标签一致。"
                      : "所有成功 Case 均与人工标签一致。"}
                  </p>
                ) : (
                  <div className="mt-2 max-h-72 space-y-2 overflow-y-auto pr-1">
                    {disagreements.slice(0, 100).map((item) => {
                      const internalDisagreement = hasJudgeDisagreement(
                        item.votes ?? []
                      );
                      return (
                        <article key={item.caseId} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-950/50">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="font-mono text-slate-600 dark:text-slate-300">{item.caseId}</span>
                            <span className={item.status === "error" || internalDisagreement ? "text-amber-700 dark:text-amber-300" : "text-red-700 dark:text-red-300"}>
                              {item.status === "error"
                                ? "投票不完整 / 调用失败"
                                : internalDisagreement
                                  ? `Judge 内部分歧 · 仲裁 ${item.judgeLabel} · 人工 ${item.humanLabel}`
                                  : `人工 ${item.humanLabel} / Judge ${item.judgeLabel}`}
                            </span>
                          </div>
                          <p className="mt-1 leading-5 text-slate-600 dark:text-slate-400">{item.error ?? item.reason}</p>
                          {item.confidence !== undefined && <p className="mt-1 text-[11px] text-slate-500">{item.votes ? "仲裁" : "Judge"} 置信度 {(item.confidence * 100).toFixed(1)}%</p>}
                          {item.votes && (
                            <details
                              aria-label={`${item.caseId} 原始 Judge 投票`}
                              className="mt-2 rounded-lg border border-slate-200 bg-white px-2.5 py-2 dark:border-slate-700 dark:bg-slate-900"
                            >
                              <summary className="cursor-pointer font-semibold text-cyan-800 dark:text-cyan-200">
                                查看 {item.votes.length} 张原始票
                              </summary>
                              <div className="mt-2 grid gap-2" role="list">
                                {item.votes.map((vote) => (
                                  <div
                                    key={vote.judgeModelId}
                                    role="listitem"
                                    className="rounded-md bg-slate-50 px-2.5 py-2 dark:bg-slate-950"
                                  >
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                      <span className="font-semibold text-slate-700 dark:text-slate-200">
                                        {vote.judgeModelName}
                                      </span>
                                      <span className={vote.status === "error" ? "font-semibold text-red-700 dark:text-red-300" : "font-mono font-semibold text-slate-700 dark:text-slate-200"}>
                                        {vote.status === "error" ? "调用失败" : vote.judgeLabel}
                                      </span>
                                    </div>
                                    <p className="mt-1 leading-5 text-slate-600 dark:text-slate-400">
                                      {vote.error ?? vote.reason}
                                    </p>
                                    {vote.confidence !== undefined && (
                                      <p className="mt-1 text-[11px] text-slate-500">
                                        置信度 {(vote.confidence * 100).toFixed(1)}%
                                      </p>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </details>
                          )}
                        </article>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="mt-8 rounded-xl border border-dashed border-slate-300 px-5 py-12 text-center dark:border-slate-700">
              <p className="text-sm font-medium text-slate-700 dark:text-slate-200">尚无校准历史</p>
              <p className="mt-2 text-xs leading-5 text-slate-500">先在左侧选择锁定的黄金集和 Judge，确认调用数后运行。</p>
            </div>
          )}
        </section>
      </div>

      <EvaluatorReleaseGate
        selectedRun={selectedRun}
        evaluatorVersions={usableEvaluatorVersions}
        releases={releases}
        onSaveRelease={onSaveRelease}
      />

      {confirming && selectedVersion && selectedJudgesReady && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4" role="dialog" aria-modal="true" aria-label="确认启动 Judge 校准">
          <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl dark:bg-slate-900">
            <p className="font-mono text-xs font-semibold uppercase tracking-[0.16em] text-cyan-700 dark:text-cyan-300">Cost confirmation</p>
            <h3 className="mt-2 text-lg font-bold text-slate-900 dark:text-white">确认启动 Judge 校准</h3>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-cyan-50 p-3 dark:bg-cyan-500/10"><p className="text-xs text-cyan-700 dark:text-cyan-300">Judge 调用</p><p className="mt-1 text-xl font-bold text-cyan-800 dark:text-cyan-200">{callCount} 次</p></div>
              <div className="rounded-xl bg-emerald-50 p-3 dark:bg-emerald-500/10"><p className="text-xs text-emerald-700 dark:text-emerald-300">被测模型调用</p><p className="mt-1 text-xl font-bold text-emerald-800 dark:text-emerald-200">0 次</p></div>
            </div>
            <dl className="mt-4 space-y-2 text-xs text-slate-600 dark:text-slate-300">
              <div className="flex justify-between gap-3"><dt>任务类型</dt><dd className="text-right font-medium">{rerunPlan.trigger === "configuration_change" ? "配置变化重跑" : rerunPlan.trigger === "manual_repeat" ? "相同配置复跑" : "首次校准"}</dd></div>
              <div className="flex justify-between gap-3"><dt>黄金集</dt><dd className="text-right font-medium">{selectedVersion.name} v{selectedVersion.version}</dd></div>
              <div className="flex justify-between gap-3"><dt>Evaluator</dt><dd className="text-right font-medium">{selectedEvaluator ? `${selectedEvaluator.name} v${selectedEvaluator.version}` : "自定义标准"}</dd></div>
              <div className="flex justify-between gap-3"><dt>运行方式</dt><dd className="text-right font-medium">{calibrationMode === "multi" ? "多 Judge 独立投票" : "单 Judge"}</dd></div>
              <div className="flex justify-between gap-3"><dt>Judge</dt><dd className="max-w-[70%] text-right font-medium">{calibrationMode === "multi" ? selectedMultiJudges.map((judge) => judge.name).join(" / ") : selectedJudge?.name}</dd></div>
              {calibrationMode === "multi" && (
                <>
                  <div className="flex justify-between gap-3"><dt>仲裁策略</dt><dd className="text-right font-medium">{ARBITRATION_STRATEGY_LABELS[arbitrationStrategy]}</dd></div>
                  <div className="flex justify-between gap-3"><dt>调用公式</dt><dd className="text-right font-mono font-semibold text-cyan-700 dark:text-cyan-300">{caseCount} Case × {selectedMultiJudges.length} Judge = {callCount}</dd></div>
                </>
              )}
              <div className="flex justify-between gap-3"><dt>并发</dt><dd className="font-medium">{concurrency}</dd></div>
            </dl>
            {rerunPlan.trigger === "configuration_change" && (
              <div className="mt-3 rounded-lg border border-cyan-200 bg-cyan-50 px-3 py-2 text-xs text-cyan-900 dark:border-cyan-500/30 dark:bg-cyan-500/10 dark:text-cyan-100">
                <p className="font-semibold">自动关联基线并保留前后结果</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {rerunChangeLabels.map((label) => (
                    <span key={label} className="rounded-full bg-white/70 px-2 py-0.5 dark:bg-slate-900/40">{label} 已变化</span>
                  ))}
                </div>
              </div>
            )}
            <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">确认后会立即产生 Judge 模型调用费用。人工标签不会发送给 Judge。{calibrationMode === "multi" ? "每个 Judge 独立收到同一 Case；任一投票失败，该 Case 不会使用残缺票数仲裁。" : ""}</p>
            {requiresTypedConfirmation && (
              <label className="mt-3 block text-xs font-medium text-red-700 dark:text-red-300">本次不少于 100 次调用，请输入 {callCount} 继续<input aria-label="大批量校准调用数确认" value={largeRunConfirmation} onChange={(event) => setLargeRunConfirmation(event.target.value)} className="mt-1 w-full rounded-lg border border-red-300 px-3 py-2 text-sm text-slate-900 dark:border-red-500/40 dark:bg-slate-950 dark:text-white" /></label>
            )}
            <div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setConfirming(false)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 dark:border-slate-600 dark:text-slate-200">取消</button><button type="button" disabled={!canConfirm} onClick={confirmAndRun} className="rounded-lg bg-cyan-700 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-800 disabled:cursor-not-allowed disabled:opacity-40">确认并调用 {callCount} 次 Judge</button></div>
          </div>
        </div>
      )}
    </section>
  );
}
