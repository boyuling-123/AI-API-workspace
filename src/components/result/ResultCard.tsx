"use client";

import type { ResultRow } from "@/types";
import {
  LatencyText,
  ResultItemBody,
  StatusTag,
  TargetTypeTag,
} from "./resultShared";

interface ResultCardProps {
  row: ResultRow;
  onImageClick: (src: string) => void;
}

/** 单条模式：每个目标一列卡片并排对比。 */
export function ResultCard({ row, onImageClick }: ResultCardProps) {
  if (row.items.length === 0) {
    return null;
  }

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
      {row.items.map((item) => (
        <div
          key={item.targetId}
          className="flex flex-col gap-2 rounded-lg border border-gray-200 bg-white p-4"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">{item.targetName}</span>
              <TargetTypeTag contentKind={item.contentKind} />
            </div>
            <StatusTag status={item.status} />
          </div>
          <ResultItemBody item={item} onImageClick={onImageClick} />
          <div className="mt-auto pt-1">
            <LatencyText latencyMs={item.latencyMs} />
          </div>
        </div>
      ))}
    </div>
  );
}
