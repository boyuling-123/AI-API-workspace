"use client";

import { useState } from "react";
import type {
  ContentMode,
  ResultRow,
  RunPolicy,
  TargetConfig,
  Task,
  TaskInput,
} from "@/types";
import { RUNTIME_CONFIG } from "@/config/runtime";
import type { RunMode, RunStatus } from "@/hooks/useTaskRunner";
import type { RunProgress } from "@/lib/batchCheckpoint";
import { CostConfirmDialog } from "./CostConfirmDialog";
import { TrialResultModal } from "./TrialResultModal";
import { normalizeRunPolicy } from "@/lib/runPolicy";

interface RunPanelProps {
  inputs: TaskInput[];
  contentMode: ContentMode;
  targetIds: string[];
  /** 所选目标的完整配置，用于判断是否含生图目标并估算费用。 */
  selectedTargets: TargetConfig[];
  runStatus: RunStatus;
  lastRunMode: RunMode;
  /** v4.3 增量1：试运行结果（在浮窗展示，不落历史）。 */
  trialResults: ResultRow[];
  progress: RunProgress;
  resumableTask: Task | null;
  onRunTrial: (
    inputs: TaskInput[],
    targetIds: string[],
    concurrency: number,
    runPolicy: RunPolicy
  ) => void;
  onRunBatch: (
    inputs: TaskInput[],
    targetIds: string[],
    concurrency: number,
    contentMode: ContentMode,
    runPolicy: RunPolicy
  ) => void;
  onResumeBatch: (task: Task) => void;
  onAbandonBatch: (task: Task) => void;
  onPause: () => void;
  onCancel: () => void;
}

/** 生图目标：仅 contentKind==='image'。只有这类目标产生生图费用（multimodal 出文字，不算）。 */
function isImageTarget(target: TargetConfig): boolean {
  return target.contentKind === "image";
}

/** 从目标的 num_images 入参默认值推断每次生成图片数，取所选目标的最大值（至少 1）。 */
function inferImagesPerCall(targets: TargetConfig[]): number {
  let maxImages = 1;
  for (const target of targets) {
    const def = target.inputParams.find((param) => param.name === "num_images");
    const value = Number(def?.defaultValue);
    if (Number.isFinite(value) && value > maxImages) {
      maxImages = value;
    }
  }
  return maxImages;
}

export function RunPanel({
  inputs,
  contentMode,
  targetIds,
  selectedTargets,
  runStatus,
  lastRunMode,
  trialResults,
  progress,
  resumableTask,
  onRunTrial,
  onRunBatch,
  onResumeBatch,
  onAbandonBatch,
  onPause,
  onCancel,
}: RunPanelProps) {
  const [concurrency, setConcurrency] = useState<number>(
    RUNTIME_CONFIG.defaultConcurrency
  );
  const [qps, setQps] = useState<number>(RUNTIME_CONFIG.defaultQps);
  const [timeoutSeconds, setTimeoutSeconds] = useState<number>(
    RUNTIME_CONFIG.defaultRunTimeoutMs / 1_000
  );
  const [retryLimit, setRetryLimit] = useState<number>(
    RUNTIME_CONFIG.defaultRunRetryLimit
  );
  // 待确认的生图运行：null 表示无弹框；保存待执行的运行动作与入参。
  const [pendingRun, setPendingRun] = useState<{
    mode: RunMode;
    runInputs: TaskInput[];
  } | null>(null);
  // v4.3 增量1：试运行结果浮窗开关；试运行触发时打开。
  const [trialModalOpen, setTrialModalOpen] = useState(false);
  // 浮窗里展示的试运行输入（仅第 1 条）。
  const [trialInputs, setTrialInputs] = useState<TaskInput[]>([]);

  const validInputs = inputs.filter(
    (input) => input.prompt.trim() || input.images.length > 0
  );
  const isRunning = runStatus === "running";
  const hasPendingRecovery = !isRunning && resumableTask !== null;
  const resumablePolicy = resumableTask
    ? normalizeRunPolicy(resumableTask.runPolicy)
    : null;
  const displayedBatchTask =
    resumableTask &&
    (hasPendingRecovery || (isRunning && lastRunMode === "batch"))
      ? resumableTask
      : null;
  const canRun =
    !isRunning &&
    !hasPendingRecovery &&
    validInputs.length > 0 &&
    targetIds.length > 0;

  const totalCalls = validInputs.length * targetIds.length;

  const imageTargets = selectedTargets.filter(isImageTarget);
  const hasImageTarget = imageTargets.length > 0;
  const imageCallCount = validInputs.length * imageTargets.length;
  const imagesPerCall = inferImagesPerCall(imageTargets);

  // 运行入口：涉及生图目标则先弹费用确认框，否则直接执行。
  // trial 的「仅第 1 条」由 useTaskRunner.runTrial 内部 slice，这里统一传 validInputs。
  function attemptRun(mode: RunMode) {
    if (hasImageTarget) {
      setPendingRun({ mode, runInputs: validInputs });
      return;
    }
    dispatchRun(mode, validInputs);
  }

  function dispatchRun(mode: RunMode, runInputs: TaskInput[]) {
    const runPolicy = normalizeRunPolicy({
      qps,
      timeoutMs: timeoutSeconds * 1_000,
      retryLimit,
    });
    if (mode === "trial") {
      // 记录本次试运行输入并打开浮窗；结果由 trialResults 实时回填展示，不落历史。
      setTrialInputs(runInputs.slice(0, 1));
      setTrialModalOpen(true);
      onRunTrial(runInputs, targetIds, concurrency, runPolicy);
    } else {
      onRunBatch(runInputs, targetIds, concurrency, contentMode, runPolicy);
    }
  }

  function confirmPendingRun() {
    if (pendingRun) {
      dispatchRun(pendingRun.mode, pendingRun.runInputs);
    }
    setPendingRun(null);
  }

  const statusLabel = isRunning
    ? "运行中…"
    : hasPendingRecovery
      ? "等待处理已保存任务"
      : canRun
        ? "准备就绪"
        : "等待配置";
  const statusDetail = isRunning
    ? `正在执行 ${lastRunMode === "trial" ? "试运行" : "批量运行"} · 已完成 ${progress.completedCalls} / ${progress.totalCalls}`
    : hasPendingRecovery
      ? "请先继续剩余任务，或放弃并结束后再创建新批次。"
      : canRun
        ? `${targetIds.length} 个目标 · ${validInputs.length > 1 ? "批量" : "单条"}输入 · 预计 ${totalCalls} 次调用`
        : "";
  const progressPercent =
    progress.totalCalls > 0
      ? Math.round((progress.completedCalls / progress.totalCalls) * 100)
      : 0;

  return (
    <div className="flex flex-col gap-2">
      {!isRunning && resumableTask && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-amber-950 shadow-sm dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100">
          <div className="min-w-[220px] flex-1">
            <p className="text-sm font-semibold">发现可继续的批量任务</p>
            <p className="mt-0.5 text-xs text-amber-800 dark:text-amber-200">
              已保存 {resumableTask.checkpoint?.completedCalls ?? 0} /{" "}
              {resumableTask.checkpoint?.totalCalls ??
                resumableTask.inputs.length * resumableTask.targetIds.length}
              {resumableTask.status === "running"
                ? "，上次运行可能因刷新或关闭页面中断。"
                : "，继续后只执行剩余单元。"}
            </p>
            <p className="mt-1 text-[11px] text-amber-700 dark:text-amber-300">
              沿用原策略：并发 {resumableTask.concurrency} · QPS{" "}
              {resumablePolicy?.qps || "不限速"} · 超时{" "}
              {Math.round((resumablePolicy?.timeoutMs ?? 0) / 1_000)}s · 重试{" "}
              {resumablePolicy?.retryLimit ?? 0} 次
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onAbandonBatch(resumableTask)}
              className="rounded-lg border border-amber-400 px-3 py-2 text-sm font-medium text-amber-900 transition hover:bg-amber-100 dark:text-amber-100 dark:hover:bg-amber-500/20"
            >
              放弃并结束
            </button>
            <button
              type="button"
              onClick={() => onResumeBatch(resumableTask)}
              className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-600"
            >
              继续剩余任务
            </button>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-brand-500/20 bg-brand-700 px-5 py-4 shadow-card dark:bg-brand-800">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="font-mono text-xs font-semibold uppercase tracking-wide text-brand-200">
              批量运行控制台
            </p>
            <p className="mt-1 text-sm text-brand-100">
              先配好输入和测试目标，这里会统一发起试运行或批量运行。
            </p>
          </div>
          <span className="rounded-full bg-white/10 px-2.5 py-1 text-xs font-medium text-white">
            {displayedBatchTask
              ? `${displayedBatchTask.inputs.length} 条已保存输入 · ${displayedBatchTask.targetIds.length} 个目标`
              : `${validInputs.length} 条输入 · ${targetIds.length} 个目标`}
          </span>
        </div>
        {isRunning && lastRunMode === "batch" && progress.totalCalls > 0 && (
          <div
            className="mb-3 h-1.5 overflow-hidden rounded-full bg-white/15"
            role="progressbar"
            aria-label="批量任务进度"
            aria-valuemin={0}
            aria-valuemax={progress.totalCalls}
            aria-valuenow={progress.completedCalls}
          >
            <div
              className="h-full rounded-full bg-amber-400 transition-[width] duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        )}
        <div className="flex flex-wrap items-center gap-3">
        {/* 左侧状态文案 */}
        <div className="min-w-[180px] flex-1">
          <p className="text-sm font-semibold text-white">{statusLabel}</p>
          {statusDetail && (
            <p className="text-xs text-brand-200">{statusDetail}</p>
          )}
        </div>

        {/* 并发输入 */}
        <label className="flex items-center gap-2 text-xs text-brand-200">
          并发
          <input
            type="number"
            min={1}
            max={RUNTIME_CONFIG.maxConcurrency}
            value={concurrency}
            disabled={isRunning || hasPendingRecovery}
            onChange={(event) =>
              setConcurrency(
                clamp(
                  Number(event.target.value) || 1,
                  1,
                  RUNTIME_CONFIG.maxConcurrency
                )
              )
            }
            className="w-14 rounded-lg border border-brand-600 bg-brand-800 px-2 py-1.5 text-center font-mono text-sm text-white outline-none focus:border-brand-400 disabled:opacity-50 dark:bg-brand-900"
          />
        </label>

        {/* 试运行 */}
        <button
          type="button"
          disabled={!canRun}
          onClick={() => attemptRun("trial")}
          className="rounded-lg border border-brand-500 px-4 py-2 text-sm font-medium text-white transition-colors duration-150 hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-40"
        >
          试运行
        </button>

        {/* 批量运行（橙色主按钮） */}
        <button
          type="button"
          disabled={!canRun}
          onClick={() => attemptRun("batch")}
          className="flex items-center gap-2 rounded-lg bg-amber-500 px-5 py-2 text-sm font-semibold text-white shadow-card transition-colors duration-150 hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <svg
            className="h-4 w-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polygon points="5 3 19 12 5 21 5 3" />
          </svg>
          {validInputs.length > 1
            ? `批量运行`
            : "运行"}
        </button>

        {/* 暂停会保留检查点；终止则结束当前任务。 */}
        {isRunning && lastRunMode === "batch" && (
          <button
            type="button"
            onClick={onPause}
            className="rounded-lg border border-amber-300 px-3 py-2 text-sm font-medium text-amber-100 transition-colors duration-150 hover:bg-amber-500/20"
          >
            暂停
          </button>
        )}
        {isRunning && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-red-400 px-3 py-2 text-sm font-medium text-red-200 transition-colors duration-150 hover:bg-red-500/20"
          >
            终止
          </button>
        )}
        </div>
        <details className="group mt-3 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-brand-100">
          <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2 text-xs font-medium marker:hidden">
            <span className="flex items-center gap-1.5">
              高级运行策略
              <svg
                aria-hidden="true"
                className="h-3.5 w-3.5 transition-transform group-open:rotate-180"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path d="M5.25 7.5 10 12.25 14.75 7.5" />
              </svg>
            </span>
            <span className="font-mono text-brand-200">
              QPS {qps === 0 ? "不限速" : qps} · 超时 {timeoutSeconds}s ·
              失败重试 {retryLimit} 次
            </span>
          </summary>
          <div className="mt-3 grid gap-3 border-t border-white/10 pt-3 sm:grid-cols-3">
            <label className="flex flex-col gap-1 text-xs text-brand-200">
              QPS 上限
              <input
                aria-label="QPS 上限"
                type="number"
                min={0}
                max={RUNTIME_CONFIG.maxQps}
                value={qps}
                disabled={isRunning || hasPendingRecovery}
                onChange={(event) =>
                  setQps(
                    clamp(
                      Number(event.target.value) || 0,
                      0,
                      RUNTIME_CONFIG.maxQps
                    )
                  )
                }
                className="rounded-lg border border-brand-600 bg-brand-800 px-2 py-1.5 font-mono text-sm text-white outline-none focus:border-brand-400 disabled:opacity-50 dark:bg-brand-900"
              />
              <span className="text-[11px] text-brand-300">0 表示不限速</span>
            </label>
            <label className="flex flex-col gap-1 text-xs text-brand-200">
              单次超时（秒）
              <input
                aria-label="单次超时（秒）"
                type="number"
                min={RUNTIME_CONFIG.minRunTimeoutMs / 1_000}
                max={RUNTIME_CONFIG.maxRunTimeoutMs / 1_000}
                value={timeoutSeconds}
                disabled={isRunning || hasPendingRecovery}
                onChange={(event) =>
                  setTimeoutSeconds(
                    clamp(
                      Number(event.target.value) || 1,
                      RUNTIME_CONFIG.minRunTimeoutMs / 1_000,
                      RUNTIME_CONFIG.maxRunTimeoutMs / 1_000
                    )
                  )
                }
                className="rounded-lg border border-brand-600 bg-brand-800 px-2 py-1.5 font-mono text-sm text-white outline-none focus:border-brand-400 disabled:opacity-50 dark:bg-brand-900"
              />
              <span className="text-[11px] text-brand-300">每次尝试独立计时</span>
            </label>
            <label className="flex flex-col gap-1 text-xs text-brand-200">
              失败重试次数
              <input
                aria-label="失败重试次数"
                type="number"
                min={0}
                max={RUNTIME_CONFIG.maxRunRetryLimit}
                value={retryLimit}
                disabled={isRunning || hasPendingRecovery}
                onChange={(event) =>
                  setRetryLimit(
                    clamp(
                      Number(event.target.value) || 0,
                      0,
                      RUNTIME_CONFIG.maxRunRetryLimit
                    )
                  )
                }
                className="rounded-lg border border-brand-600 bg-brand-800 px-2 py-1.5 font-mono text-sm text-white outline-none focus:border-brand-400 disabled:opacity-50 dark:bg-brand-900"
              />
              <span className="text-[11px] text-brand-300">
                只重试限流、网络、超时与服务端错误
              </span>
            </label>
          </div>
        </details>
      </div>

      {!isRunning && !hasPendingRecovery && validInputs.length === 0 && (
        <p className="text-xs text-amber-800 dark:text-amber-400">
          请先在输入区填写至少一条有效输入
        </p>
      )}
      {!isRunning && !hasPendingRecovery && targetIds.length === 0 && (
        <p className="text-xs text-amber-800 dark:text-amber-400">
          请先在目标选择区勾选至少一个模型
        </p>
      )}

      <CostConfirmDialog
        open={pendingRun !== null}
        imageCallCount={
          pendingRun?.mode === "trial" ? imageTargets.length : imageCallCount
        }
        imagesPerCall={imagesPerCall}
        unitPriceYuan={RUNTIME_CONFIG.imageUnitPriceYuan}
        onConfirm={confirmPendingRun}
        onCancel={() => setPendingRun(null)}
      />

      {/* v4.3 增量1：试运行结果浮窗（纯预览，不落历史、不参与评价） */}
      <TrialResultModal
        open={trialModalOpen}
        onClose={() => setTrialModalOpen(false)}
        rows={trialResults}
        inputs={trialInputs}
        running={runStatus === "running" && lastRunMode === "trial"}
      />
    </div>
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
