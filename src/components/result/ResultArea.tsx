"use client";

import { useState } from "react";
import type { ResultRow, RunErrorType, TaskInput } from "@/types";
import type { ExportEvaluationData } from "@/services/excel";
import { exportResultsToExcel } from "@/services/excel";
import { ResultFlatTable } from "./ResultFlatTable";
import { ImageLightbox } from "./ImageLightbox";
import { RUN_ERROR_LABELS } from "@/lib/runError";

interface ResultAreaProps {
  results: ResultRow[];
  inputs: TaskInput[];
  targetIds: string[];
  projectName: string;
  /** M9 评价结果，存在时导出会追加评分列。 */
  evaluations?: ExportEvaluationData[];
}

/** 结果对比区：统一用「输入×目标」扁平表格展示。 */
export function ResultArea({
  results,
  inputs,
  targetIds,
  projectName,
  evaluations,
}: ResultAreaProps) {
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [filter, setFilter] = useState<ResultFilter>("all");

  if (results.length === 0) {
    return null;
  }

  const handleExport = () => {
    exportResultsToExcel({ projectName, inputs, results, targetIds, evaluations });
  };

  const availableErrorTypes = Array.from(
    new Set(
      results.flatMap((row) =>
        row.items.flatMap((item) => (item.errorType ? [item.errorType] : []))
      )
    )
  );
  const filteredResults = filterResultRows(results, filter);

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold">结果对比</h2>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-xs text-gray-500">
            结果筛选
            <select
              value={filter}
              onChange={(event) => setFilter(event.target.value as ResultFilter)}
              className="rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-700"
            >
              <option value="all">全部结果</option>
              <option value="success">仅成功</option>
              <option value="interrupted">仅中断</option>
              {availableErrorTypes.map((errorType) => (
                <option key={errorType} value={errorType}>
                  {RUN_ERROR_LABELS[errorType]}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={handleExport}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm transition hover:bg-gray-50"
          >
            导出 Excel
          </button>
        </div>
      </div>

      {filteredResults.length > 0 ? (
        <ResultFlatTable
          rows={filteredResults}
          inputs={inputs}
          onImageClick={setLightboxSrc}
        />
      ) : (
        <p className="rounded-md border border-dashed border-gray-200 px-3 py-6 text-center text-sm text-gray-400">
          当前筛选条件下没有结果。
        </p>
      )}

      <ImageLightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />
    </section>
  );
}

type ResultFilter = "all" | "success" | "interrupted" | RunErrorType;

function filterResultRows(rows: ResultRow[], filter: ResultFilter): ResultRow[] {
  if (filter === "all") return rows;
  return rows.flatMap((row) => {
    const items = row.items.filter((item) =>
      filter === "success" || filter === "interrupted"
        ? item.status === filter
        : item.errorType === filter
    );
    return items.length > 0 ? [{ ...row, items }] : [];
  });
}
