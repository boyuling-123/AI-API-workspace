"use client";

import { useMemo } from "react";
import type { EvaluatorVersion } from "@/types";
import {
  compareEvaluatorVersions,
  EVALUATOR_IMPACT_LABELS,
  type EvaluatorTextDiffLine,
} from "@/lib/evaluatorVersionDiff";

interface EvaluatorVersionDiffPanelProps {
  activeVersion: EvaluatorVersion;
  familyVersions: EvaluatorVersion[];
  compareVersionId: string;
  nextVersion: number;
  restoreDisabled: boolean;
  onCompareVersionChange: (versionId: string) => void;
  onRestore: () => void;
}

interface VisibleDiffLine {
  line?: EvaluatorTextDiffLine;
  omitted?: number;
  sourceIndex: number;
}

function buildVisibleDiffLines(
  lines: EvaluatorTextDiffLine[]
): VisibleDiffLine[] {
  if (lines.length <= 160) {
    return lines.map((line, sourceIndex) => ({ line, sourceIndex }));
  }

  const visibleIndexes = new Set<number>();
  lines.forEach((line, index) => {
    if (line.kind === "unchanged") return;
    for (let offset = -2; offset <= 2; offset += 1) {
      const candidate = index + offset;
      if (candidate >= 0 && candidate < lines.length) {
        visibleIndexes.add(candidate);
      }
    }
  });
  const orderedIndexes = Array.from(visibleIndexes).sort((left, right) => left - right);
  if (orderedIndexes.length === 0) return [];

  const boundedIndexes = orderedIndexes.slice(0, 160);
  const visible: VisibleDiffLine[] = [];
  let previousIndex = -1;
  for (const index of boundedIndexes) {
    if (index > previousIndex + 1) {
      visible.push({
        omitted: index - previousIndex - 1,
        sourceIndex: previousIndex + 1,
      });
    }
    visible.push({ line: lines[index], sourceIndex: index });
    previousIndex = index;
  }
  if (previousIndex < lines.length - 1) {
    visible.push({
      omitted: lines.length - previousIndex - 1,
      sourceIndex: previousIndex + 1,
    });
  }
  return visible;
}

function lineStyle(kind: EvaluatorTextDiffLine["kind"]): string {
  if (kind === "added") return "bg-emerald-50 text-emerald-950";
  if (kind === "removed") return "bg-rose-50 text-rose-950";
  return "bg-white text-slate-600";
}

export function EvaluatorVersionDiffPanel({
  activeVersion,
  familyVersions,
  compareVersionId,
  nextVersion,
  restoreDisabled,
  onCompareVersionChange,
  onRestore,
}: EvaluatorVersionDiffPanelProps) {
  const sortedVersions = [...familyVersions].sort(
    (left, right) => right.version - left.version
  );
  const comparisonCandidates = sortedVersions.filter(
    (version) => version.id !== activeVersion.id
  );
  const comparisonVersion =
    comparisonCandidates.find((version) => version.id === compareVersionId) ??
    comparisonCandidates[0];
  const latestVersion = sortedVersions[0];
  const canRestore = latestVersion?.id !== activeVersion.id;
  const comparison = useMemo(() => {
    if (!comparisonVersion) return null;
    try {
      return {
        diff: compareEvaluatorVersions(comparisonVersion, activeVersion),
        error: "",
      };
    } catch (error) {
      return {
        diff: null,
        error:
          error instanceof Error ? error.message : "Evaluator 版本 Diff 失败",
      };
    }
  }, [activeVersion, comparisonVersion]);
  const visiblePromptLines = comparison?.diff
    ? buildVisibleDiffLines(comparison.diff.prompt.lines)
    : [];

  if (!comparisonVersion) {
    return (
      <p className="rounded-lg border border-dashed border-slate-300 bg-white/70 px-3 py-2 text-xs text-slate-600">
        保存第二个版本后即可查看结构化差异和 Prompt 文本 Diff。
      </p>
    );
  }

  return (
    <section
      aria-label="Evaluator 版本差异与恢复"
      className="flex flex-col gap-3 rounded-xl border border-slate-300 bg-slate-950 p-4 text-slate-100 shadow-sm"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4 className="text-sm font-semibold">版本差异与安全恢复</h4>
          <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-300">
            Diff 完全在本地计算，不调用 Judge。恢复会把当前历史快照追加为新版本，不覆盖任何旧版本或评价记录。
          </p>
        </div>
        <span className="rounded-full bg-cyan-300 px-2.5 py-1 text-[11px] font-bold text-slate-950">
          v{comparisonVersion.version} → v{activeVersion.version}
        </span>
      </div>

      <label className="flex flex-col gap-1 text-xs font-medium text-slate-200">
        Diff 基线版本
        <select
          aria-label="Evaluator Diff 基线版本"
          value={comparisonVersion.id}
          onChange={(event) => onCompareVersionChange(event.target.value)}
          className="rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white"
        >
          {comparisonCandidates.map((version) => (
            <option key={version.id} value={version.id}>
              {version.name} v{version.version} · {version.createdBy}
            </option>
          ))}
        </select>
      </label>

      {comparison?.error && (
        <p role="alert" className="rounded-md bg-rose-950 px-3 py-2 text-xs text-rose-100">
          {comparison.error}
        </p>
      )}

      {comparison?.diff && (
        <>
          <div className="flex flex-wrap gap-2" aria-label="Diff 影响范围">
            {comparison.diff.impactScopes.length > 0 ? (
              comparison.diff.impactScopes.map((scope) => (
                <span
                  key={scope}
                  className="rounded-full border border-amber-300/40 bg-amber-300/10 px-2.5 py-1 text-[11px] font-semibold text-amber-100"
                >
                  {EVALUATOR_IMPACT_LABELS[scope]}
                </span>
              ))
            ) : (
              <span className="rounded-full border border-emerald-300/40 bg-emerald-300/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-100">
                执行定义完全一致
              </span>
            )}
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <div className="rounded-lg border border-slate-700 bg-slate-900 p-3">
              <div className="flex items-center justify-between gap-2">
                <h5 className="text-xs font-semibold text-white">结构化差异</h5>
                <span className="text-[11px] text-slate-400">
                  {comparison.diff.fieldChanges.length +
                    comparison.diff.dimensionChanges.length}{" "}
                  项
                </span>
              </div>
              {comparison.diff.fieldChanges.length === 0 &&
              comparison.diff.dimensionChanges.length === 0 ? (
                <p className="mt-3 text-xs text-slate-400">结构字段无变化。</p>
              ) : (
                <ul className="mt-3 flex flex-col gap-2 text-xs">
                  {comparison.diff.fieldChanges.map((change) => (
                    <li key={change.key} className="rounded-md bg-slate-800 px-3 py-2">
                      <p className="font-semibold text-cyan-200">{change.label}</p>
                      <p className="mt-1 break-words text-rose-200">- {change.before}</p>
                      <p className="mt-1 break-words text-emerald-200">+ {change.after}</p>
                    </li>
                  ))}
                  {comparison.diff.dimensionChanges.map((change) => (
                    <li
                      key={`${change.kind}-${change.name}`}
                      className="rounded-md bg-slate-800 px-3 py-2"
                    >
                      <span className="font-semibold text-cyan-200">
                        {change.kind === "added"
                          ? "新增维度"
                          : change.kind === "removed"
                            ? "删除维度"
                            : "修改维度"}
                      </span>
                      <span className="ml-2 text-white">{change.name}</span>
                      {change.changedFields.length > 0 && (
                        <p className="mt-1 text-slate-300">
                          {change.changedFields.join("、")}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="overflow-hidden rounded-lg border border-slate-700 bg-white text-slate-900">
              <div className="flex items-center justify-between bg-slate-900 px-3 py-2 text-xs text-white">
                <h5 className="font-semibold">Prompt 文本 Diff</h5>
                <span className="font-mono text-[11px]">
                  <span className="text-emerald-300">
                    +{comparison.diff.prompt.addedLineCount}
                  </span>{" "}
                  <span className="text-rose-300">
                    -{comparison.diff.prompt.removedLineCount}
                  </span>
                </span>
              </div>
              {!comparison.diff.prompt.changed ? (
                <p className="px-3 py-4 text-xs text-slate-500">Prompt 文本无变化。</p>
              ) : (
                <div className="max-h-72 overflow-auto font-mono text-[11px] leading-5">
                  {visiblePromptLines.map((item) =>
                    item.line ? (
                      <div
                        key={`${item.sourceIndex}-${item.line.kind}`}
                        className={`grid grid-cols-[2.5rem_2.5rem_1rem_minmax(0,1fr)] border-t border-slate-100 ${lineStyle(item.line.kind)}`}
                      >
                        <span className="px-1 text-right text-slate-400">
                          {item.line.oldLine ?? ""}
                        </span>
                        <span className="px-1 text-right text-slate-400">
                          {item.line.newLine ?? ""}
                        </span>
                        <span className="text-center font-bold">
                          {item.line.kind === "added"
                            ? "+"
                            : item.line.kind === "removed"
                              ? "-"
                              : " "}
                        </span>
                        <span className="whitespace-pre-wrap break-words pr-2">
                          {item.line.value || " "}
                        </span>
                      </div>
                    ) : (
                      <div
                        key={`omitted-${item.sourceIndex}`}
                        className="bg-slate-100 px-3 py-1 text-center text-[10px] text-slate-500"
                      >
                        省略 {item.omitted} 行内容
                      </div>
                    )
                  )}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-300/30 bg-amber-300/10 px-3 py-2.5">
        <p className="max-w-2xl text-xs leading-5 text-amber-50">
          {canRestore
            ? `将 ${activeVersion.name} v${activeVersion.version} 的完整执行定义追加为 v${nextVersion}；作者、恢复说明与当前适用任务会写入新版本。`
            : "当前选中版本已是家族最新版，无需恢复。"}
        </p>
        {canRestore && (
          <button
            type="button"
            onClick={onRestore}
            disabled={restoreDisabled}
            className="rounded-md bg-amber-300 px-3 py-2 text-xs font-bold text-slate-950 hover:bg-amber-200 disabled:cursor-not-allowed disabled:bg-slate-600 disabled:text-slate-300"
          >
            恢复 v{activeVersion.version} 为新版本 v{nextVersion}
          </button>
        )}
      </div>
    </section>
  );
}
