import type {
  ResultItem,
  ResultRow,
  TargetConfig,
  TaskInput,
  TaskRunPair,
} from "@/types";

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
  existingResults: ResultRow[] = [],
  runPairs?: TaskRunPair[]
): ResultRow[] {
  const targetById = new Map(targetConfigs.map((target) => [target.id, target]));
  const existingByInput = new Map(
    existingResults.map((row) => [
      row.inputId,
      new Map(row.items.map((item) => [item.targetId, item])),
    ])
  );

  const requestedTargetsByInput = runPairs
    ? runPairs.reduce<Map<string, Set<string>>>((result, pair) => {
        const targets = result.get(pair.inputId) ?? new Set<string>();
        targets.add(pair.targetId);
        result.set(pair.inputId, targets);
        return result;
      }, new Map())
    : null;

  return inputs.flatMap((input) => {
    const requestedTargetIds = requestedTargetsByInput
      ? targetIds.filter((targetId) =>
          requestedTargetsByInput.get(input.id)?.has(targetId)
        )
      : targetIds;
    if (requestedTargetIds.length === 0) return [];

    return [
      {
        inputId: input.id,
        items: requestedTargetIds.map((targetId) => {
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
      },
    ];
  });
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
