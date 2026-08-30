"use client";

import { useMemo, useState } from "react";
import type {
  GoldenDatasetVersion,
  JudgeCalibrationMetrics,
  JudgeCalibrationRun,
} from "@/types";
import { formatDateTime } from "@/lib/datetime";
import { isGoldenDatasetVersionIntact } from "@/lib/goldenDataset";
import { runJudgeCalibration } from "@/services/judgeCalibrationClient";

interface JudgeModelOption {
  id: string;
  name: string;
}

interface JudgeCalibrationPanelProps {
  versions: GoldenDatasetVersion[];
  judgeModels: JudgeModelOption[];
  runs: JudgeCalibrationRun[];
  onSaveRun: (run: JudgeCalibrationRun) => void;
}

const DEFAULT_CRITERIA =
  "候选输出必须满足事实正确、关键字段完整、格式合规且不存在明显业务风险，才判定为 pass。";

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

export function JudgeCalibrationPanel({
  versions,
  judgeModels,
  runs,
  onSaveRun,
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
  const [datasetVersionId, setDatasetVersionId] = useState("");
  const selectedVersion =
    usableVersions.find((item) => item.id === datasetVersionId) ??
    usableVersions.at(-1);
  const [judgeModelId, setJudgeModelId] = useState("");
  const selectedJudge =
    judgeModels.find((item) => item.id === judgeModelId) ?? judgeModels[0];
  const [criteria, setCriteria] = useState(DEFAULT_CRITERIA);
  const [concurrency, setConcurrency] = useState(3);
  const [confirming, setConfirming] = useState(false);
  const [largeRunConfirmation, setLargeRunConfirmation] = useState("");
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ completed: 0, total: 0 });
  const [selectedRunId, setSelectedRunId] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const selectedRun =
    sortedRuns.find((item) => item.id === selectedRunId) ?? sortedRuns[0];
  const callCount = selectedVersion?.cases.length ?? 0;
  const requiresTypedConfirmation = callCount >= 100;
  const canConfirm =
    !requiresTypedConfirmation || largeRunConfirmation.trim() === String(callCount);
  const disagreements = selectedRun
    ? selectedRun.results.filter(
        (item) =>
          item.status === "error" || item.humanLabel !== item.judgeLabel
      )
    : [];

  function openConfirmation() {
    if (!selectedVersion) {
      setError("请先发布至少一个人工黄金集版本");
      return;
    }
    if (!selectedJudge) {
      setError("没有可用的文本 Judge，请先在接口创建与管理中配置");
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
    if (!selectedVersion || !selectedJudge || !canConfirm || running) return;
    setConfirming(false);
    setRunning(true);
    setMessage("");
    setError("");
    setProgress({ completed: 0, total: selectedVersion.cases.length });
    try {
      const run = await runJudgeCalibration({
        datasetVersion: selectedVersion,
        judgeModelId: selectedJudge.id,
        judgeModelName: selectedJudge.name,
        criteria,
        concurrency,
        onProgress: (completed, total) => setProgress({ completed, total }),
      });
      onSaveRun(run);
      setSelectedRunId(run.id);
      setMessage(
        `校准完成：成功 ${run.metrics.completedCases} 条，失败 ${run.metrics.errorCases} 条。`
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
            <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
              Judge
              <select
                aria-label="校准 Judge"
                value={selectedJudge?.id ?? ""}
                onChange={(event) => setJudgeModelId(event.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
              >
                {judgeModels.length === 0 && <option value="">暂无可用 Judge</option>}
                {judgeModels.map((model) => (
                  <option key={model.id} value={model.id}>{model.name}</option>
                ))}
              </select>
            </label>
          </div>
          <label className="mt-3 block text-xs font-medium text-slate-600 dark:text-slate-300">
            校准判定标准
            <textarea
              aria-label="校准判定标准"
              value={criteria}
              onChange={(event) => setCriteria(event.target.value)}
              rows={4}
              className="mt-1 w-full resize-y rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm leading-6 text-slate-900 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
            />
          </label>
          <label className="mt-3 block text-xs font-medium text-slate-600 dark:text-slate-300">
            Judge 并发
            <select
              aria-label="Judge 校准并发"
              value={concurrency}
              onChange={(event) => setConcurrency(Number(event.target.value))}
              className="mt-1 w-28 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
            >
              {[1, 2, 3, 4, 5].map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
          </label>

          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
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
            disabled={running || !selectedVersion || !selectedJudge}
            className="mt-4 w-full rounded-lg bg-cyan-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-cyan-800 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {running ? `校准中 ${progress.completed}/${progress.total}` : "预览并启动校准"}
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
                    {run.goldenDatasetName} v{run.goldenDatasetVersion} · {formatDateTime(run.finishTime)}
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
                <span className="rounded-full bg-slate-100 px-2 py-1 dark:bg-slate-800">{selectedRun.metrics.totalCases} 次调用</span>
              </div>
              <MetricsCards metrics={selectedRun.metrics} />

              <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
                <table aria-label="Judge 校准混淆矩阵" className="w-full text-center text-xs">
                  <thead className="bg-slate-50 text-slate-500 dark:bg-slate-800">
                    <tr><th className="px-3 py-2 text-left">人工真值</th><th className="px-3 py-2">Judge pass</th><th className="px-3 py-2">Judge fail</th></tr>
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
                  <p className="mt-2 rounded-lg bg-emerald-50 px-3 py-4 text-center text-xs text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">所有成功 Case 均与人工标签一致。</p>
                ) : (
                  <div className="mt-2 max-h-72 space-y-2 overflow-y-auto pr-1">
                    {disagreements.slice(0, 100).map((item) => (
                      <article key={item.caseId} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-950/50">
                        <div className="flex flex-wrap items-center justify-between gap-2"><span className="font-mono text-slate-600 dark:text-slate-300">{item.caseId}</span><span className={item.status === "error" ? "text-amber-700 dark:text-amber-300" : "text-red-700 dark:text-red-300"}>{item.status === "error" ? "调用失败" : `人工 ${item.humanLabel} / Judge ${item.judgeLabel}`}</span></div>
                        <p className="mt-1 leading-5 text-slate-600 dark:text-slate-400">{item.error ?? item.reason}</p>
                        {item.confidence !== undefined && <p className="mt-1 text-[11px] text-slate-500">Judge 置信度 {(item.confidence * 100).toFixed(1)}%</p>}
                      </article>
                    ))}
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

      {confirming && selectedVersion && selectedJudge && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4" role="dialog" aria-modal="true" aria-label="确认启动 Judge 校准">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl dark:bg-slate-900">
            <p className="font-mono text-xs font-semibold uppercase tracking-[0.16em] text-cyan-700 dark:text-cyan-300">Cost confirmation</p>
            <h3 className="mt-2 text-lg font-bold text-slate-900 dark:text-white">确认启动 Judge 校准</h3>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-cyan-50 p-3 dark:bg-cyan-500/10"><p className="text-xs text-cyan-700 dark:text-cyan-300">Judge 调用</p><p className="mt-1 text-xl font-bold text-cyan-800 dark:text-cyan-200">{callCount} 次</p></div>
              <div className="rounded-xl bg-emerald-50 p-3 dark:bg-emerald-500/10"><p className="text-xs text-emerald-700 dark:text-emerald-300">被测模型调用</p><p className="mt-1 text-xl font-bold text-emerald-800 dark:text-emerald-200">0 次</p></div>
            </div>
            <dl className="mt-4 space-y-2 text-xs text-slate-600 dark:text-slate-300"><div className="flex justify-between gap-3"><dt>黄金集</dt><dd className="text-right font-medium">{selectedVersion.name} v{selectedVersion.version}</dd></div><div className="flex justify-between gap-3"><dt>Judge</dt><dd className="text-right font-medium">{selectedJudge.name}</dd></div><div className="flex justify-between gap-3"><dt>并发</dt><dd className="font-medium">{concurrency}</dd></div></dl>
            <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">确认后会立即产生 Judge 模型调用费用。人工标签不会发送给 Judge。</p>
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
