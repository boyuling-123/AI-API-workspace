"use client";

import { useState } from "react";
import type { ResultRow, TargetConfig, TaskInput } from "@/types";
import { RUNTIME_CONFIG } from "@/config/runtime";
import type { RunMode, RunStatus } from "@/hooks/useTaskRunner";
import { CostConfirmDialog } from "./CostConfirmDialog";
import { TrialResultModal } from "./TrialResultModal";

interface RunPanelProps {
  inputs: TaskInput[];
  targetIds: string[];
  /** 所选目标的完整配置，用于判断是否含生图目标并估算费用。 */
  selectedTargets: TargetConfig[];
  runStatus: RunStatus;
  lastRunMode: RunMode;
  /** v4.3 增量1：试运行结果（在浮窗展示，不落历史）。 */
  trialResults: ResultRow[];
  onRunTrial: (inputs: TaskInput[], targetIds: string[], concurrency: number) => void;
  onRunBatch: (inputs: TaskInput[], targetIds: string[], concurrency: number) => void;
  onCancel: () => void;
}

/** 生图目标：仅 contentKind==='image'。只有这类目标产生生图费用（multimodal 出文字，不算）。 */
function isImageTarget(target: TargetConfig): boolean {
  return (target.contentKind ?? target.capability) === "image";
}

/** 从目标的 num_images 入参默认值推断每次生成图片数，取所选目标的最大值（至少 1）。 */
function inferImagesPerCall(targets: TargetConfig[]): number {
  let maxImages = 1;
  for (const target of targets) {
    const def = (target.inputParams ?? []).find((param) => param.name === "num_images");
    const value = Number(def?.defaultValue);
    if (Number.isFinite(value) && value > maxImages) {
      maxImages = value;
    }
  }
  return maxImages;
}

export function RunPanel({
  inputs,
  targetIds,
  selectedTargets,
  runStatus,
  lastRunMode,
  trialResults,
  onRunTrial,
  onRunBatch,
  onCancel,
}: RunPanelProps) {
  const [concurrency, setConcurrency] = useState<number>(
    RUNTIME_CONFIG.defaultConcurrency
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
  const canRun =
    runStatus !== "running" &&
    validInputs.length > 0 &&
    targetIds.length > 0;
  const isRunning = runStatus === "running";

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
    if (mode === "trial") {
      // 记录本次试运行输入并打开浮窗；结果由 trialResults 实时回填展示，不落历史。
      setTrialInputs(runInputs.slice(0, 1));
      setTrialModalOpen(true);
      onRunTrial(runInputs, targetIds, concurrency);
    } else {
      onRunBatch(runInputs, targetIds, concurrency);
    }
  }

  function confirmPendingRun() {
    if (pendingRun) {
      dispatchRun(pendingRun.mode, pendingRun.runInputs);
    }
    setPendingRun(null);
  }

  const statusLabel = canRun
    ? "准备就绪"
    : isRunning
      ? "运行中…"
      : "等待配置";
  const statusDetail = canRun
    ? `${targetIds.length} 个目标 · ${validInputs.length > 1 ? "批量" : "单条"}输入 · 预计 ${totalCalls} 次调用`
    : isRunning
      ? `正在执行 ${lastRunMode === "trial" ? "试运行" : "批量运行"}…`
      : "";

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-4 rounded-xl bg-brand-700 px-5 py-3 shadow-card dark:bg-brand-800">
        {/* 左侧状态文案 */}
        <div className="flex-1">
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
            disabled={isRunning}
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

        {/* 取消 */}
        {isRunning && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-red-400 px-3 py-2 text-sm font-medium text-red-200 transition-colors duration-150 hover:bg-red-500/20"
          >
            取消
          </button>
        )}
      </div>

      {validInputs.length === 0 && (
        <p className="text-xs text-amber-600 dark:text-amber-400">
          请先在输入区填写至少一条有效输入
        </p>
      )}
      {targetIds.length === 0 && (
        <p className="text-xs text-amber-600 dark:text-amber-400">
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
