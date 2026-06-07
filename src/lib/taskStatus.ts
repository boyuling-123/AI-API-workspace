import type { ResultRow, Task } from "@/types";

/**
 * 由所有结果行聚合整个任务的最终状态。
 * - 被取消（有 interrupted）-> cancelled
 * - 全部成功 -> done
 * - 全部失败 -> error
 * - 成功与失败混合 -> partial
 */
export function computeTaskStatus(
  results: ResultRow[],
  wasCancelled: boolean
): Task["status"] {
  if (wasCancelled) {
    return "cancelled";
  }

  const allItems = results.flatMap((row) => row.items);
  if (allItems.length === 0) {
    return "idle";
  }

  const successCount = allItems.filter(
    (item) => item.status === "success"
  ).length;
  if (successCount === allItems.length) {
    return "done";
  }
  if (successCount === 0) {
    return "error";
  }
  return "partial";
}

export const TASK_STATUS_META: Record<
  Task["status"],
  { label: string; className: string }
> = {
  idle: { label: "未运行", className: "bg-gray-100 text-gray-500" },
  running: { label: "运行中", className: "bg-blue-100 text-blue-600" },
  done: { label: "完成", className: "bg-green-100 text-green-600" },
  partial: { label: "部分完成", className: "bg-amber-100 text-amber-600" },
  error: { label: "失败", className: "bg-red-100 text-red-600" },
  cancelled: { label: "已取消", className: "bg-gray-100 text-gray-500" },
};
