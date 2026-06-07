import type { ResultItem } from "@/types";

export type RowStatus = "idle" | "running" | "done" | "partial" | "error";

/**
 * 计算一行（同一输入下多个目标结果）的聚合状态：
 * - 有 pending/running -> running
 * - 全 success -> done
 * - 全 error/interrupted -> error
 * - 成功与失败混合 -> partial
 */
export function computeRowStatus(items: ResultItem[]): RowStatus {
  if (items.length === 0) {
    return "idle";
  }

  const hasInflight = items.some(
    (item) => item.status === "pending" || item.status === "running"
  );
  if (hasInflight) {
    return "running";
  }

  const successCount = items.filter((item) => item.status === "success").length;
  if (successCount === items.length) {
    return "done";
  }
  if (successCount === 0) {
    return "error";
  }
  return "partial";
}

export const ROW_STATUS_META: Record<
  RowStatus,
  { label: string; className: string }
> = {
  idle: { label: "未运行", className: "bg-gray-100 text-gray-500" },
  running: { label: "运行中", className: "bg-blue-100 text-blue-600" },
  done: { label: "完成", className: "bg-green-100 text-green-600" },
  partial: { label: "部分完成", className: "bg-amber-100 text-amber-600" },
  error: { label: "失败", className: "bg-red-100 text-red-600" },
};
