import type {
  ResultRow,
  TargetConfig,
  Task,
  TaskRerun,
  TaskRunPair,
} from "@/types";

export interface CaseNumberSelection {
  caseNumbers: number[];
  errors: string[];
}

export interface RerunPlanPreview {
  rerun: TaskRerun;
  inputIds: string[];
  targetIds: string[];
  unavailableTargetIds: string[];
  unavailablePairCount: number;
  reusedPairCount: number;
}

/** 解析面向用户的 1-based Case 表达式，例如 `1,3,8-12`。 */
export function parseCaseNumberExpression(
  expression: string,
  totalCases: number
): CaseNumberSelection {
  const normalized = expression
    .trim()
    .replace(/\s+/g, "")
    .replace(/，/g, ",")
    .replace(/[–—~～]/g, "-");
  if (!normalized) {
    return { caseNumbers: [], errors: ["请输入至少一个 Case 序号"] };
  }

  const selected = new Set<number>();
  const errors: string[] = [];
  for (const token of normalized.split(",")) {
    if (!token) {
      errors.push("序号之间不能有空项");
      continue;
    }
    const match = /^(\d+)(?:-(\d+))?$/.exec(token);
    if (!match) {
      errors.push(`无法识别“${token}”`);
      continue;
    }

    const start = Number(match[1]);
    const end = Number(match[2] ?? match[1]);
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end)) {
      errors.push(`“${token}”超出可支持的序号范围`);
      continue;
    }
    if (start > end) {
      errors.push(`“${token}”的起始序号不能大于结束序号`);
      continue;
    }
    if (start < 1 || end > totalCases) {
      errors.push(`“${token}”超出 1-${totalCases} 的范围`);
      continue;
    }
    for (let caseNumber = start; caseNumber <= end; caseNumber += 1) {
      selected.add(caseNumber);
    }
  }

  return {
    caseNumbers: Array.from(selected).sort((a, b) => a - b),
    errors: Array.from(new Set(errors)),
  };
}

export function buildFailedRerunPlan(
  task: Task,
  availableTargetIds: string[]
): RerunPlanPreview {
  const available = new Set(availableTargetIds);
  const validInputIds = new Set(task.inputs.map((input) => input.id));
  const sourceTargetIds = new Set(task.targetIds);
  const pairs: TaskRunPair[] = [];
  const unavailableTargets = new Set<string>();
  let unavailablePairCount = 0;

  for (const row of task.results) {
    if (!validInputIds.has(row.inputId)) continue;
    for (const item of row.items) {
      if (item.status !== "error" || !sourceTargetIds.has(item.targetId)) {
        continue;
      }
      if (!available.has(item.targetId)) {
        unavailableTargets.add(item.targetId);
        unavailablePairCount += 1;
        continue;
      }
      pairs.push({ inputId: row.inputId, targetId: item.targetId });
    }
  }

  return createPreview(task, "failed", pairs, unavailableTargets, unavailablePairCount);
}

export function buildSelectedCasesRerunPlan(
  task: Task,
  selectedInputIds: string[],
  availableTargetIds: string[]
): RerunPlanPreview {
  const selected = new Set(selectedInputIds);
  const available = new Set(availableTargetIds);
  const inputIds = task.inputs
    .filter((input) => selected.has(input.id))
    .map((input) => input.id);
  const targetIds = task.targetIds.filter((targetId) => available.has(targetId));
  const unavailableTargetIds = task.targetIds.filter(
    (targetId) => !available.has(targetId)
  );
  const pairs = inputIds.flatMap((inputId) =>
    targetIds.map((targetId) => ({ inputId, targetId }))
  );

  return createPreview(
    task,
    "selected_cases",
    pairs,
    new Set(unavailableTargetIds),
    inputIds.length * unavailableTargetIds.length
  );
}

/** 返回与源任务内容和输入兼容、可运行且尚未加入源任务的目标。 */
export function getCompatibleNewTargets(
  task: Task,
  targets: TargetConfig[]
): TargetConfig[] {
  const sourceTargetIds = new Set(task.targetIds);
  const hasImageInput = task.inputs.some((input) => input.images.length > 0);

  return targets.filter((target) => {
    if (sourceTargetIds.has(target.id)) return false;
    if (!target.preset && target.status !== "tested_ok") return false;
    if (task.contentMode === "image") return target.contentKind === "image";
    if (target.contentKind === "image") return false;
    return !hasImageInput || target.contentKind === "multimodal";
  });
}

export function buildNewTargetsRerunPlan(
  task: Task,
  selectedInputIds: string[],
  selectedTargetIds: string[],
  availableNewTargetIds: string[]
): RerunPlanPreview {
  const selectedInputs = new Set(selectedInputIds);
  const inputIds = task.inputs
    .filter((input) => selectedInputs.has(input.id))
    .map((input) => input.id);
  const sourceTargetIds = new Set(task.targetIds);
  const available = new Set(availableNewTargetIds);
  const targetIds = Array.from(new Set(selectedTargetIds)).filter(
    (targetId) => available.has(targetId) && !sourceTargetIds.has(targetId)
  );
  const unavailableTargetIds = Array.from(new Set(selectedTargetIds)).filter(
    (targetId) => !available.has(targetId) || sourceTargetIds.has(targetId)
  );
  const pairs = inputIds.flatMap((inputId) =>
    targetIds.map((targetId) => ({ inputId, targetId }))
  );
  const selectedInputIdSet = new Set(inputIds);
  const sourceTargetIdSet = new Set(task.targetIds);
  const reusedPairCount = task.results.reduce(
    (count, row) =>
      count +
      (selectedInputIdSet.has(row.inputId)
        ? row.items.filter(
            (item) =>
              sourceTargetIdSet.has(item.targetId) &&
              (item.status === "success" || item.status === "error")
          ).length
        : 0),
    0
  );

  return createPreview(
    task,
    "new_targets",
    pairs,
    new Set(unavailableTargetIds),
    inputIds.length * unavailableTargetIds.length,
    reusedPairCount
  );
}

/** 为新增目标任务复制终态历史结果；复制后来源可在 UI 和导出中追溯。 */
export function buildHistoricalResultSeed(
  task: Task,
  selectedInputIds: string[]
): ResultRow[] {
  const selected = new Set(selectedInputIds);
  const sourceTargetIds = new Set(task.targetIds);
  return task.results.flatMap((row) => {
    if (!selected.has(row.inputId)) return [];
    const items = row.items
      .filter(
        (item) =>
          sourceTargetIds.has(item.targetId) &&
          (item.status === "success" || item.status === "error")
      )
      .map((item) => ({ ...item, reusedFromTaskId: task.id }));
    return items.length > 0 ? [{ inputId: row.inputId, items }] : [];
  });
}

function createPreview(
  task: Task,
  scope: TaskRerun["scope"],
  rawPairs: TaskRunPair[],
  unavailableTargets: Set<string>,
  unavailablePairCount: number,
  reusedPairCount = 0
): RerunPlanPreview {
  const pairKeys = new Set<string>();
  const pairs = rawPairs.filter((pair) => {
    const key = `${pair.inputId}\u0000${pair.targetId}`;
    if (pairKeys.has(key)) return false;
    pairKeys.add(key);
    return true;
  });
  const pairInputIds = new Set(pairs.map((pair) => pair.inputId));
  const pairTargetIds = new Set(pairs.map((pair) => pair.targetId));
  const inputIds = task.inputs
    .map((input) => input.id)
    .filter((inputId) => pairInputIds.has(inputId));
  const targetIds = [
    ...task.targetIds.filter((targetId) => pairTargetIds.has(targetId)),
    ...pairs
      .map((pair) => pair.targetId)
      .filter(
        (targetId, index, ordered) =>
          !task.targetIds.includes(targetId) &&
          ordered.indexOf(targetId) === index
      ),
  ];

  return {
    rerun: {
      sourceTaskId: task.id,
      scope,
      pairs,
      selectedInputIds: inputIds,
    },
    inputIds,
    targetIds,
    unavailableTargetIds: Array.from(unavailableTargets),
    unavailablePairCount,
    reusedPairCount,
  };
}
