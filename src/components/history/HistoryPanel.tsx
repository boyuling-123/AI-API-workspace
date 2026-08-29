"use client";

import type { Task } from "@/types";
import { formatDateTime } from "@/lib/datetime";
import { TASK_STATUS_META } from "@/lib/taskStatus";
import { normalizeRunPolicy } from "@/lib/runPolicy";

interface HistoryPanelProps {
  tasks: Task[];
  viewingTaskId: string | null;
  onView: (task: Task) => void;
  onDelete: (taskId: string) => void;
  /** 需求三：点击「去AI评测」携带该批次跳转板块④。 */
  onEvaluate: (task: Task) => void;
}

/**
 * 历史任务面板（需求三）：倒序列出运行过的批次。
 * 点击某条 → 下方展开该批次结果对比；行内「去AI评测」携带批次跳转板块④。
 */
export function HistoryPanel({
  tasks,
  viewingTaskId,
  onView,
  onDelete,
  onEvaluate,
}: HistoryPanelProps) {
  const sortedTasks = [...tasks].sort((a, b) => b.createTime - a.createTime);

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-white p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">历史任务（{tasks.length}）</h2>
      </div>

      {tasks.length === 0 ? (
        <p className="rounded-md border border-dashed border-gray-200 px-3 py-6 text-center text-sm text-gray-400">
          还没有历史批次。先在「跑批」板块正式运行一次（试运行不落历史）。
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-gray-100">
          {sortedTasks.map((task) => {
            const meta = TASK_STATUS_META[task.status];
            const policy = normalizeRunPolicy(task.runPolicy);
            const isViewing = task.id === viewingTaskId;
            const isActive = task.status === "running" || task.status === "paused";
            return (
              <li
                key={task.id}
                className={`flex flex-wrap items-center gap-3 py-2.5 ${
                  isViewing ? "bg-blue-50/50" : ""
                }`}
              >
                <span className="text-xs text-gray-500">
                  {formatDateTime(task.createTime)}
                </span>
                <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600">
                  {task.runMode === "single" ? "单条" : "批量"}
                </span>
                <span className="text-xs text-gray-500">
                  {task.inputs.length} 输入 · {task.targetIds.length} 目标
                </span>
                {task.checkpoint && (
                  <span className="text-xs text-gray-500">
                    {task.checkpoint.completedCalls} / {task.checkpoint.totalCalls} 调用
                  </span>
                )}
                <span
                  className="text-xs text-gray-500"
                  title="该任务启动时保存的运行策略"
                >
                  并发 {task.concurrency} · QPS {policy.qps || "不限速"} · 超时{" "}
                  {Math.round(policy.timeoutMs / 1_000)}s · 重试 {policy.retryLimit}
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs ${meta.className}`}
                >
                  {meta.label}
                </span>

                <div className="ml-auto flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onView(task)}
                    className="rounded-md border border-gray-300 px-2.5 py-1 text-xs transition hover:bg-gray-50"
                  >
                    {isViewing ? "查看中" : "查看结果"}
                  </button>
                  <button
                    type="button"
                    onClick={() => onEvaluate(task)}
                    disabled={isActive}
                    title={isActive ? "任务完成后才能启动 AI 评价" : undefined}
                    className="rounded-md border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs text-amber-700 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:border-gray-200 disabled:bg-gray-50 disabled:text-gray-400"
                  >
                    去AI评测
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(task.id)}
                    disabled={task.status === "running"}
                    title={task.status === "running" ? "请先暂停或终止任务" : undefined}
                    className="rounded-md border border-red-200 px-2.5 py-1 text-xs text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:border-gray-200 disabled:text-gray-400"
                  >
                    删除
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
