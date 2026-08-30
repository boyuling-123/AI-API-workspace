import type { EvalDimension, EvaluatorVersion } from "@/types";
import {
  cloneEvaluatorVersionDraft,
  createEvaluatorVersion,
  isEvaluatorVersionIntact,
} from "@/lib/evaluatorVersion";

const MAX_LCS_CELLS = 250_000;

export type EvaluatorImpactScope =
  | "prompt"
  | "scoring"
  | "judge_model"
  | "reference"
  | "task_scope";

export const EVALUATOR_IMPACT_LABELS: Record<
  EvaluatorImpactScope,
  string
> = {
  prompt: "裁判指令会变化",
  scoring: "评分口径与结果可比性会变化",
  judge_model: "裁判模型会变化",
  reference: "评价模式或标准答案覆盖会变化",
  task_scope: "适用任务范围会变化",
};

export interface EvaluatorTextDiffLine {
  kind: "unchanged" | "added" | "removed";
  value: string;
  oldLine?: number;
  newLine?: number;
}

export interface EvaluatorFieldChange {
  key: string;
  label: string;
  before: string;
  after: string;
  impact: EvaluatorImpactScope;
}

export interface EvaluatorDimensionChange {
  kind: "added" | "removed" | "modified";
  name: string;
  changedFields: string[];
}

export interface EvaluatorVersionDiff {
  baseVersionId: string;
  targetVersionId: string;
  fieldChanges: EvaluatorFieldChange[];
  dimensionChanges: EvaluatorDimensionChange[];
  prompt: {
    changed: boolean;
    addedLineCount: number;
    removedLineCount: number;
    lines: EvaluatorTextDiffLine[];
  };
  impactScopes: EvaluatorImpactScope[];
  hasChanges: boolean;
}

export interface RestoreEvaluatorVersionInput {
  sourceVersion: EvaluatorVersion;
  existingVersions: EvaluatorVersion[];
  id?: string;
  createTime?: number;
  createdBy: string;
  changeNote?: string;
  applicableTaskId: string;
}

interface RawDiffLine {
  kind: EvaluatorTextDiffLine["kind"];
  value: string;
}

function normalizeLines(value: string): string[] {
  return value.replace(/\r\n?/g, "\n").split("\n");
}

function numberDiffLines(lines: RawDiffLine[]): EvaluatorTextDiffLine[] {
  let oldLine = 1;
  let newLine = 1;
  return lines.map((line) => {
    if (line.kind === "unchanged") {
      const numbered = { ...line, oldLine, newLine };
      oldLine += 1;
      newLine += 1;
      return numbered;
    }
    if (line.kind === "removed") {
      const numbered = { ...line, oldLine };
      oldLine += 1;
      return numbered;
    }
    const numbered = { ...line, newLine };
    newLine += 1;
    return numbered;
  });
}

function buildBoundedReplacementDiff(
  before: string[],
  after: string[]
): RawDiffLine[] {
  let prefixLength = 0;
  while (
    prefixLength < before.length &&
    prefixLength < after.length &&
    before[prefixLength] === after[prefixLength]
  ) {
    prefixLength += 1;
  }

  let suffixLength = 0;
  while (
    suffixLength < before.length - prefixLength &&
    suffixLength < after.length - prefixLength &&
    before[before.length - suffixLength - 1] ===
      after[after.length - suffixLength - 1]
  ) {
    suffixLength += 1;
  }

  const prefix = before.slice(0, prefixLength).map((value) => ({
    kind: "unchanged" as const,
    value,
  }));
  const removed = before
    .slice(prefixLength, before.length - suffixLength)
    .map((value) => ({ kind: "removed" as const, value }));
  const added = after
    .slice(prefixLength, after.length - suffixLength)
    .map((value) => ({ kind: "added" as const, value }));
  const suffix = before
    .slice(before.length - suffixLength)
    .map((value) => ({ kind: "unchanged" as const, value }));
  return [...prefix, ...removed, ...added, ...suffix];
}

function buildLineDiff(beforeText: string, afterText: string) {
  const before = normalizeLines(beforeText);
  const after = normalizeLines(afterText);
  let rawLines: RawDiffLine[];

  if (before.length * after.length > MAX_LCS_CELLS) {
    rawLines = buildBoundedReplacementDiff(before, after);
  } else {
    const table = Array.from(
      { length: before.length + 1 },
      () => new Uint32Array(after.length + 1)
    );
    for (let beforeIndex = before.length - 1; beforeIndex >= 0; beforeIndex -= 1) {
      for (let afterIndex = after.length - 1; afterIndex >= 0; afterIndex -= 1) {
        table[beforeIndex][afterIndex] =
          before[beforeIndex] === after[afterIndex]
            ? table[beforeIndex + 1][afterIndex + 1] + 1
            : Math.max(
                table[beforeIndex + 1][afterIndex],
                table[beforeIndex][afterIndex + 1]
              );
      }
    }

    rawLines = [];
    let beforeIndex = 0;
    let afterIndex = 0;
    while (beforeIndex < before.length || afterIndex < after.length) {
      if (
        beforeIndex < before.length &&
        afterIndex < after.length &&
        before[beforeIndex] === after[afterIndex]
      ) {
        rawLines.push({ kind: "unchanged", value: before[beforeIndex] });
        beforeIndex += 1;
        afterIndex += 1;
      } else if (
        beforeIndex < before.length &&
        (afterIndex >= after.length ||
          table[beforeIndex + 1][afterIndex] >=
            table[beforeIndex][afterIndex + 1])
      ) {
        rawLines.push({ kind: "removed", value: before[beforeIndex] });
        beforeIndex += 1;
      } else {
        rawLines.push({ kind: "added", value: after[afterIndex] });
        afterIndex += 1;
      }
    }
  }

  const lines = numberDiffLines(rawLines);
  return {
    changed: rawLines.some((line) => line.kind !== "unchanged"),
    addedLineCount: rawLines.filter((line) => line.kind === "added").length,
    removedLineCount: rawLines.filter((line) => line.kind === "removed").length,
    lines,
  };
}

function displayValue(value: string | undefined): string {
  if (!value) return "未设置";
  return value.length > 160 ? `${value.slice(0, 157)}...` : value;
}

function dimensionKey(dimension: EvalDimension): string {
  return dimension.name.trim().replace(/\s+/g, " ").toLowerCase();
}

function changedDimensionFields(
  before: EvalDimension,
  after: EvalDimension
): string[] {
  const fields: Array<[keyof EvalDimension, string]> = [
    ["name", "维度名称"],
    ["desc", "维度定义"],
    ["scoreLevels", "评分锚点"],
    ["evidenceRequirements", "证据要求"],
    ["judgeInstruction", "判断规则"],
    ["weight", "权重"],
    ["vetoThreshold", "一票否决阈值"],
  ];
  return fields
    .filter(([key]) => JSON.stringify(before[key]) !== JSON.stringify(after[key]))
    .map(([, label]) => label);
}

function buildDimensionChanges(
  before: EvalDimension[],
  after: EvalDimension[]
): EvaluatorDimensionChange[] {
  const beforeMap = new Map(before.map((item) => [dimensionKey(item), item]));
  const afterMap = new Map(after.map((item) => [dimensionKey(item), item]));
  const changes: EvaluatorDimensionChange[] = [];

  for (const item of before) {
    const next = afterMap.get(dimensionKey(item));
    if (!next) {
      changes.push({ kind: "removed", name: item.name, changedFields: [] });
      continue;
    }
    const changedFields = changedDimensionFields(item, next);
    if (changedFields.length > 0) {
      changes.push({ kind: "modified", name: next.name, changedFields });
    }
  }
  for (const item of after) {
    if (!beforeMap.has(dimensionKey(item))) {
      changes.push({ kind: "added", name: item.name, changedFields: [] });
    }
  }
  return changes;
}

export function compareEvaluatorVersions(
  base: EvaluatorVersion,
  target: EvaluatorVersion
): EvaluatorVersionDiff {
  if (!isEvaluatorVersionIntact(base) || !isEvaluatorVersionIntact(target)) {
    throw new Error("Evaluator 版本完整性校验失败，不能进行 Diff");
  }
  if (base.evaluatorId !== target.evaluatorId) {
    throw new Error("只能比较同一 Evaluator 家族的版本");
  }

  const fieldChanges: EvaluatorFieldChange[] = [];
  const addFieldChange = (
    key: string,
    label: string,
    before: string | undefined,
    after: string | undefined,
    impact: EvaluatorImpactScope
  ) => {
    if (before === after) return;
    fieldChanges.push({
      key,
      label,
      before: displayValue(before),
      after: displayValue(after),
      impact,
    });
  };

  addFieldChange(
    "evalModelId",
    "裁判模型",
    base.evalModelId,
    target.evalModelId,
    "judge_model"
  );
  addFieldChange(
    "userRequirement",
    "评测目标",
    base.userRequirement,
    target.userRequirement,
    "scoring"
  );
  addFieldChange(
    "evaluationMode",
    "评价模式",
    base.evaluationMode === "reference" ? "标准答案判分" : "横向对比",
    target.evaluationMode === "reference" ? "标准答案判分" : "横向对比",
    "reference"
  );
  addFieldChange(
    "expectedAnswerColumn",
    "标准答案字段",
    base.expectedAnswerColumn,
    target.expectedAnswerColumn,
    "reference"
  );
  addFieldChange(
    "applicableTaskId",
    "适用任务",
    base.applicableTaskId,
    target.applicableTaskId,
    "task_scope"
  );

  const dimensionChanges = buildDimensionChanges(
    base.dimensions,
    target.dimensions
  );
  const prompt = buildLineDiff(base.evalPrompt, target.evalPrompt);
  const impactScopes = new Set<EvaluatorImpactScope>(
    fieldChanges.map((change) => change.impact)
  );
  if (dimensionChanges.length > 0) impactScopes.add("scoring");
  if (prompt.changed) impactScopes.add("prompt");

  return {
    baseVersionId: base.id,
    targetVersionId: target.id,
    fieldChanges,
    dimensionChanges,
    prompt,
    impactScopes: Array.from(impactScopes),
    hasChanges:
      fieldChanges.length > 0 || dimensionChanges.length > 0 || prompt.changed,
  };
}

export function restoreEvaluatorVersion(
  input: RestoreEvaluatorVersionInput
): EvaluatorVersion {
  const storedSource = input.existingVersions.find(
    (version) => version.id === input.sourceVersion.id
  );
  if (
    !storedSource ||
    !isEvaluatorVersionIntact(input.sourceVersion) ||
    !isEvaluatorVersionIntact(storedSource) ||
    storedSource.integrityFingerprint !==
      input.sourceVersion.integrityFingerprint
  ) {
    throw new Error("恢复来源版本不存在或完整性校验失败");
  }
  const family = input.existingVersions.filter(
    (version) =>
      version.evaluatorId === storedSource.evaluatorId &&
      isEvaluatorVersionIntact(version)
  );
  const latestVersion = family.reduce(
    (latest, version) => (version.version > latest.version ? version : latest),
    family[0]
  );
  if (!latestVersion || latestVersion.id === storedSource.id) {
    throw new Error("当前版本已是最新版，无需恢复");
  }

  const customNote = input.changeNote?.trim();
  const changeNote = customNote
    ? `从 v${storedSource.version} 恢复：${customNote}`
    : `从 v${storedSource.version} 恢复`;
  return createEvaluatorVersion({
    ...cloneEvaluatorVersionDraft(storedSource),
    existingVersions: input.existingVersions,
    evaluatorId: storedSource.evaluatorId,
    id: input.id,
    name: storedSource.name,
    createTime: input.createTime,
    createdBy: input.createdBy,
    changeNote,
    applicableTaskId: input.applicableTaskId,
  });
}
