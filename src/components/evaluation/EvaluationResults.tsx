"use client";

import { useMemo, useState } from "react";
import type { EvalDimension, ResultRow, TaskInput } from "@/types";
import type { EvaluateResultPerInput } from "@/services/evaluateService";
import { EvaluationEvidenceList } from "./EvaluationEvidenceList";

interface EvaluationResultsProps {
  evalResults: EvaluateResultPerInput[];
  inputs: TaskInput[];
  results: ResultRow[];
  /** 本次选定维度（v4.5），决定维度列与排序。 */
  dimensions: EvalDimension[];
}

function formatScore(score: number): string {
  return score.toFixed(1);
}

function formatWeightedScore(score: number): string {
  return score.toFixed(2);
}

/** 评分颜色：高分绿、中分黄、低分红，便于横向扫读。 */
function scoreClass(score: number): string {
  if (score >= 8) return "text-green-600";
  if (score >= 5) return "text-amber-600";
  return "text-red-600";
}

type SortDir = "none" | "desc" | "asc";

/**
 * 评价结果展示（M9；v4.5 多维度）：每条输入一张表，
 * 列 = [输入(sticky)] [目标(sticky)] [维度1..N] [总体点评]；
 * 横向滚动、首两列固定；每个维度列头可点击切换排序（默认→高到低→低到高），一次只按一个维度。
 * 维度评分单元格 hover 显示理由，并展示平台计算的加权分与否决结果。
 */
export function EvaluationResults({
  evalResults,
  inputs,
  dimensions,
}: EvaluationResultsProps) {
  const inputById = useMemo(
    () => new Map(inputs.map((input) => [input.id, input])),
    [inputs]
  );
  const inputIndexById = useMemo(
    () => new Map(inputs.map((input, index) => [input.id, index])),
    [inputs]
  );

  if (evalResults.length === 0 || dimensions.length === 0) {
    return null;
  }

  const ordered = [...evalResults].sort((left, right) => {
    const leftIndex = inputIndexById.get(left.inputId) ?? 0;
    const rightIndex = inputIndexById.get(right.inputId) ?? 0;
    return leftIndex - rightIndex;
  });

  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-sm font-semibold text-gray-700">
        评价结果（Judge 独立评分，平台按已确认策略汇总）
      </h3>
      {ordered.map((evaluation) => {
        const input = inputById.get(evaluation.inputId);
        const index = inputIndexById.get(evaluation.inputId) ?? 0;
        return (
          <PerInputTable
            key={evaluation.inputId}
            evaluation={evaluation}
            dimensions={dimensions}
            inputIndex={index}
            inputPrompt={input?.prompt ?? ""}
          />
        );
      })}
    </div>
  );
}

interface PerInputTableProps {
  evaluation: EvaluateResultPerInput;
  dimensions: EvalDimension[];
  inputIndex: number;
  inputPrompt: string;
}

function PerInputTable({
  evaluation,
  dimensions,
  inputIndex,
  inputPrompt,
}: PerInputTableProps) {
  // 当前排序依据：维度名 + 方向。一次只按一个维度。
  const [sortDimension, setSortDimension] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("none");

  const cycleSort = (dimensionName: string) => {
    if (sortDimension !== dimensionName) {
      setSortDimension(dimensionName);
      setSortDir("desc");
      return;
    }
    // 同一列循环：desc → asc → none（默认）
    if (sortDir === "desc") {
      setSortDir("asc");
    } else if (sortDir === "asc") {
      setSortDir("none");
      setSortDimension(null);
    } else {
      setSortDir("desc");
    }
  };

  const scoreOf = (
    target: EvaluateResultPerInput["scores"][number],
    dimensionName: string
  ): number => {
    const matched = target.dimensionScores.find(
      (item) => item.dimension === dimensionName
    );
    return matched?.score ?? 0;
  };

  const sortedScores = useMemo(() => {
    if (!sortDimension || sortDir === "none") return evaluation.scores;
    const copy = [...evaluation.scores];
    copy.sort((left, right) => {
      const diff = scoreOf(left, sortDimension) - scoreOf(right, sortDimension);
      return sortDir === "desc" ? -diff : diff;
    });
    return copy;
  }, [evaluation.scores, sortDimension, sortDir]);
  const targetNames = useMemo(
    () =>
      new Map(
        evaluation.scores.map((target) => [target.targetId, target.targetName])
      ),
    [evaluation.scores]
  );

  const sortArrow = (dimensionName: string): string => {
    if (sortDimension !== dimensionName) return "↕";
    if (sortDir === "desc") return "↓";
    if (sortDir === "asc") return "↑";
    return "↕";
  };

  return (
    <div className="flex flex-col gap-2 rounded-md border border-gray-200 p-3">
      <div className="text-xs text-gray-500">
        输入 #{inputIndex + 1}：{inputPrompt.slice(0, 60) || "(无 prompt)"}
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse text-sm">
          <thead>
            <tr className="text-left text-xs text-gray-500">
              <th className="sticky left-0 z-10 w-[120px] min-w-[120px] max-w-[120px] border-b border-gray-200 bg-white px-3 py-2">
                输入
              </th>
              <th className="sticky left-[120px] z-10 w-[160px] min-w-[160px] max-w-[160px] border-b border-gray-200 bg-white px-3 py-2">
                目标
              </th>
              {dimensions.map((dimension) => (
                <th
                  key={dimension.name}
                  className="cursor-pointer select-none border-b border-gray-200 px-3 py-2 hover:bg-gray-50"
                  onClick={() => cycleSort(dimension.name)}
                  title={
                    dimension.desc
                      ? `${dimension.name}：${dimension.desc}`
                      : dimension.name
                  }
                >
                  <span className="inline-flex items-center gap-1 whitespace-nowrap">
                    {dimension.name}
                    {dimension.weight !== undefined
                      ? ` (${dimension.weight}%)`
                      : ""}
                    <span
                      className={
                        sortDimension === dimension.name
                          ? "text-blue-600"
                          : "text-gray-300"
                      }
                    >
                      {sortArrow(dimension.name)}
                    </span>
                  </span>
                </th>
              ))}
              <th className="border-b border-gray-200 px-3 py-2">加权分</th>
              <th className="border-b border-gray-200 px-3 py-2">策略结果</th>
              <th className="border-b border-gray-200 px-3 py-2">总体点评</th>
            </tr>
          </thead>
          <tbody>
            {sortedScores.map((target, rowIndex) => (
              <tr key={target.targetId} className="align-top">
                {rowIndex === 0 ? (
                  <td
                    rowSpan={sortedScores.length}
                    className="sticky left-0 z-10 w-[120px] min-w-[120px] max-w-[120px] border-b border-r border-gray-100 bg-white px-3 py-2 align-top text-xs text-gray-600"
                  >
                    <span className="line-clamp-4 break-words">
                      {inputPrompt.slice(0, 80) || "(无 prompt)"}
                    </span>
                  </td>
                ) : null}
                <td className="sticky left-[120px] z-10 w-[160px] min-w-[160px] max-w-[160px] whitespace-nowrap border-b border-r border-gray-100 bg-white px-3 py-2 font-medium text-gray-800">
                  {target.targetName}
                </td>
                {dimensions.map((dimension) => {
                  const cell = target.dimensionScores.find(
                    (item) => item.dimension === dimension.name
                  );
                  const score = cell?.score ?? 0;
                  return (
                    <td
                      key={dimension.name}
                      className="border-b border-gray-100 px-3 py-2"
                      title={cell?.comment || ""}
                    >
                      <div className="flex flex-col items-start">
                        <span>
                          <span className={`font-semibold ${scoreClass(score)}`}>
                            {formatScore(score)}
                          </span>
                          {cell?.comment && (
                            <span className="ml-1 cursor-help text-gray-300 hover:text-gray-500">
                              ⓘ
                            </span>
                          )}
                        </span>
                        <EvaluationEvidenceList
                          evidence={cell?.evidence}
                          targetNames={targetNames}
                          label={`输入 ${inputIndex + 1} ${target.targetName} ${dimension.name}`}
                        />
                      </div>
                    </td>
                  );
                })}
                <td className="border-b border-gray-100 px-3 py-2 font-semibold text-slate-700">
                  {target.weightedScore === undefined
                    ? "—"
                    : formatWeightedScore(target.weightedScore)}
                </td>
                <td
                  className={`border-b border-gray-100 px-3 py-2 text-xs font-semibold ${
                    target.vetoed ? "text-red-700" : "text-emerald-700"
                  }`}
                  title={target.vetoReasons?.join("；") ?? ""}
                >
                  {target.vetoed === undefined
                    ? "—"
                    : target.vetoed
                      ? "已否决"
                      : "未否决"}
                </td>
                <td className="border-b border-gray-100 px-3 py-2 text-xs text-gray-600">
                  {target.overallComment || "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {evaluation.summary && (
        <div className="text-sm">
          <span className="font-medium text-gray-700">总体结论：</span>
          <span className="text-gray-600">{evaluation.summary}</span>
        </div>
      )}
      {evaluation.recommendation && (
        <div className="rounded-md bg-blue-50 px-3 py-2 text-sm text-blue-700">
          <span className="font-medium">推荐：</span>
          {evaluation.recommendation}
        </div>
      )}
    </div>
  );
}
