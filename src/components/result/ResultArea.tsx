"use client";

import { useState } from "react";
import type { ResultRow, TaskInput } from "@/types";
import type { ExportEvaluationData } from "@/services/excel";
import { exportResultsToExcel } from "@/services/excel";
import { ResultFlatTable } from "./ResultFlatTable";
import { ImageLightbox } from "./ImageLightbox";

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

  if (results.length === 0) {
    return null;
  }

  const handleExport = () => {
    exportResultsToExcel({ projectName, inputs, results, targetIds, evaluations });
  };

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-white p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">结果对比</h2>
        <button
          type="button"
          onClick={handleExport}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm transition hover:bg-gray-50"
        >
          导出 Excel
        </button>
      </div>

      <ResultFlatTable
        rows={results}
        inputs={inputs}
        onImageClick={setLightboxSrc}
      />

      <ImageLightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />
    </section>
  );
}
