"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Task, TaskRerun, TaskRerunScope } from "@/types";
import {
  buildFailedRerunPlan,
  buildSelectedCasesRerunPlan,
  parseCaseNumberExpression,
} from "@/lib/rerunPlan";

interface RerunDialogProps {
  task: Task;
  availableTargetIds: string[];
  onConfirm: (task: Task, rerun: TaskRerun) => void;
  onCancel: () => void;
}

export function RerunDialog({
  task,
  availableTargetIds,
  onConfirm,
  onCancel,
}: RerunDialogProps) {
  const failedPreview = useMemo(
    () => buildFailedRerunPlan(task, availableTargetIds),
    [availableTargetIds, task]
  );
  const [scope, setScope] = useState<TaskRerunScope>(
    failedPreview.rerun.pairs.length > 0 ? "failed" : "selected_cases"
  );
  const [caseExpression, setCaseExpression] = useState("1");
  const cancelButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    cancelButtonRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onCancel]);

  const caseSelection = useMemo(
    () => parseCaseNumberExpression(caseExpression, task.inputs.length),
    [caseExpression, task.inputs.length]
  );
  const selectedInputIds = useMemo(
    () =>
      caseSelection.caseNumbers
        .map((caseNumber) => task.inputs[caseNumber - 1]?.id)
        .filter((inputId): inputId is string => Boolean(inputId)),
    [caseSelection.caseNumbers, task.inputs]
  );
  const selectedPreview = useMemo(
    () =>
      buildSelectedCasesRerunPlan(
        task,
        selectedInputIds,
        availableTargetIds
      ),
    [availableTargetIds, selectedInputIds, task]
  );
  const preview = scope === "failed" ? failedPreview : selectedPreview;
  const validationErrors =
    scope === "selected_cases" ? caseSelection.errors : [];
  const canConfirm =
    validationErrors.length === 0 && preview.rerun.pairs.length > 0;
  const inputIndexById = useMemo(
    () => new Map(task.inputs.map((input, index) => [input.id, index + 1])),
    [task.inputs]
  );
  const previewInputs = task.inputs
    .filter((input) => preview.inputIds.includes(input.id))
    .slice(0, 3);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="rerun-dialog-title"
        aria-describedby="rerun-dialog-description"
        className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-700 dark:bg-slate-900"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-mono text-xs font-semibold uppercase tracking-wider text-brand-600 dark:text-brand-400">
              Selective rerun
            </p>
            <h3
              id="rerun-dialog-title"
              className="mt-1 text-lg font-semibold text-slate-900 dark:text-white"
            >
              定向重跑
            </h3>
            <p
              id="rerun-dialog-description"
              className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-400"
            >
              先预览精确调用范围，再创建一条可追溯的新任务。原任务和原结果不会被覆盖。
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label="关闭定向重跑"
            className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>

        <fieldset className="mt-5 grid gap-3 sm:grid-cols-2">
          <legend className="sr-only">选择重跑范围</legend>
          <label
            className={`cursor-pointer rounded-xl border p-4 transition ${
              scope === "failed"
                ? "border-brand-500 bg-brand-50 dark:bg-brand-500/10"
                : "border-slate-200 hover:border-slate-300 dark:border-slate-700"
            }`}
          >
            <span className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
              <input
                type="radio"
                name="rerun-scope"
                value="failed"
                checked={scope === "failed"}
                onChange={() => setScope("failed")}
              />
              仅失败项
            </span>
            <span className="mt-2 block text-xs leading-5 text-slate-600 dark:text-slate-400">
              只重跑原任务中状态为失败的 Case 与目标组合，共 {failedPreview.rerun.pairs.length} 次可用调用。
            </span>
          </label>
          <label
            className={`cursor-pointer rounded-xl border p-4 transition ${
              scope === "selected_cases"
                ? "border-brand-500 bg-brand-50 dark:bg-brand-500/10"
                : "border-slate-200 hover:border-slate-300 dark:border-slate-700"
            }`}
          >
            <span className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
              <input
                type="radio"
                name="rerun-scope"
                value="selected_cases"
                checked={scope === "selected_cases"}
                onChange={() => setScope("selected_cases")}
              />
              指定 Case
            </span>
            <span className="mt-2 block text-xs leading-5 text-slate-600 dark:text-slate-400">
              选中的 Case 会重新运行原任务当前仍可用的全部目标。
            </span>
          </label>
        </fieldset>

        {scope === "selected_cases" && (
          <div className="mt-4">
            <label
              htmlFor="rerun-case-expression"
              className="text-sm font-medium text-slate-700 dark:text-slate-200"
            >
              Case 序号
            </label>
            <input
              id="rerun-case-expression"
              type="text"
              value={caseExpression}
              onChange={(event) => setCaseExpression(event.target.value)}
              placeholder="例如：1,3,8-12"
              aria-invalid={validationErrors.length > 0}
              aria-describedby="rerun-case-help rerun-case-errors"
              className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-sm text-slate-800 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
            <p
              id="rerun-case-help"
              className="mt-1.5 text-xs text-slate-600 dark:text-slate-400"
            >
              支持单个序号、逗号和连续范围；本任务共有 {task.inputs.length} 个 Case。
            </p>
            <div id="rerun-case-errors" aria-live="polite">
              {validationErrors.map((error) => (
                <p key={error} className="mt-1 text-xs text-red-600 dark:text-red-400">
                  {error}
                </p>
              ))}
            </div>
          </div>
        )}

        <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/60">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
              调用预览
            </span>
            <span className="font-mono text-lg font-bold text-brand-700 dark:text-brand-300">
              {preview.rerun.pairs.length} 次调用
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
            {preview.inputIds.length} 个 Case · {preview.targetIds.length} 个目标 · 沿用源任务的并发、QPS、超时和重试策略
          </p>

          {previewInputs.length > 0 && (
            <ul className="mt-3 space-y-1.5 border-t border-slate-200 pt-3 dark:border-slate-700">
              {previewInputs.map((input) => (
                <li
                  key={input.id}
                  className="flex gap-2 text-xs text-slate-600 dark:text-slate-300"
                >
                  <span className="shrink-0 font-mono text-slate-600 dark:text-slate-300">
                    #{inputIndexById.get(input.id)}
                  </span>
                  <span className="line-clamp-1">{input.prompt || "（空 prompt）"}</span>
                </li>
              ))}
              {preview.inputIds.length > previewInputs.length && (
                <li className="text-xs text-slate-400">
                  另有 {preview.inputIds.length - previewInputs.length} 个 Case
                </li>
              )}
            </ul>
          )}
        </div>

        {preview.unavailablePairCount > 0 && (
          <div
            role="status"
            className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300"
          >
            已排除 {preview.unavailablePairCount} 次不可用调用。相关目标当前已删除或未测试通过：{preview.unavailableTargetIds.join("、")}。
          </div>
        )}

        {!canConfirm && validationErrors.length === 0 && (
          <p className="mt-3 text-sm text-amber-700 dark:text-amber-300" role="status">
            当前范围没有可执行调用，请更换重跑方式或 Case 序号。
          </p>
        )}

        <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-xs leading-5 text-red-700 dark:bg-red-500/10 dark:text-red-300">
          确认后会立即调用当前模型或算法，可能产生费用；平台不会自动启动 AI 评价。
        </p>

        <div className="mt-5 flex justify-end gap-2">
          <button
            ref={cancelButtonRef}
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            取消
          </button>
          <button
            type="button"
            onClick={() => onConfirm(task, preview.rerun)}
            disabled={!canConfirm}
            className="rounded-lg bg-brand-600 px-5 py-2 text-sm font-semibold text-white shadow-card transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-slate-300 dark:disabled:bg-slate-700"
          >
            确认并开始重跑
          </button>
        </div>
      </div>
    </div>
  );
}
