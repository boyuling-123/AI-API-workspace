import type { ResultItem, ResultRow, TargetConfig, TaskInput } from "@/types";

export interface RunProgress {
  completedCalls: number;
  totalCalls: number;
  remainingCalls: number;
  percent: number;
}

export function isCompletedResultItem(item: ResultItem | undefined): boolean {
  return item?.status === "success" || item?.status === "error";
}

/** Builds a stable Case x target matrix while preserving only terminal prior results. */
export function createCheckpointRows(
  inputs: TaskInput[],
  targetIds: string[],
  targetConfigs: TargetConfig[],
  existingResults: ResultRow[] = []
): ResultRow[] {
  const targetById = new Map(targetConfigs.map((target) => [target.id, target]));
  const existingByInput = new Map(
    existingResults.map((row) => [
      row.inputId,
      new Map(row.items.map((item) => [item.targetId, item])),
    ])
  );

  return inputs.map((input) => ({
    inputId: input.id,
    items: targetIds.map((targetId) => {
      const existing = existingByInput.get(input.id)?.get(targetId);
      if (isCompletedResultItem(existing)) {
        return existing!;
      }
      const target = targetById.get(targetId);
      return {
        targetId,
        targetName: target?.name ?? targetId,
        contentKind: target?.contentKind,
        status: "pending" as const,
      };
    }),
  }));
}

export function replaceCheckpointItem(
  rows: ResultRow[],
  inputId: string,
  item: ResultItem
): ResultRow[] {
  return rows.map((row) =>
    row.inputId === inputId
      ? {
          ...row,
          items: row.items.map((current) =>
            current.targetId === item.targetId ? item : current
          ),
        }
      : row
  );
}

export function getRunProgress(rows: ResultRow[]): RunProgress {
  const items = rows.flatMap((row) => row.items);
  const completedCalls = items.filter(isCompletedResultItem).length;
  const totalCalls = items.length;
  const remainingCalls = Math.max(0, totalCalls - completedCalls);
  return {
    completedCalls,
    totalCalls,
    remainingCalls,
    percent: totalCalls === 0 ? 0 : Math.round((completedCalls / totalCalls) * 100),
  };
}
