"use client";

import { useState } from "react";
import type { ResultRow, TaskInput } from "@/types";
import { computeRowStatus, ROW_STATUS_META } from "@/lib/rowStatus";
import {
  LatencyText,
  ResultItemBody,
  StatusTag,
  TargetTypeTag,
} from "./resultShared";

interface ResultTableProps {
  rows: ResultRow[];
  inputs: TaskInput[];
  onImageClick: (src: string) => void;
}

/** 批量模式：表格视图，每行一条输入，可展开查看各目标详细输出。 */
export function ResultTable({ rows, inputs, onImageClick }: ResultTableProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const inputById = new Map(inputs.map((input) => [input.id, input]));

  const toggle = (inputId: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(inputId)) {
        next.delete(inputId);
      } else {
        next.add(inputId);
      }
      return next;
    });
  };

  return (
    <div className="overflow-hidden rounded-lg border border-gray-200">
      <table className="w-full text-left text-sm">
        <thead className="bg-gray-50 text-xs text-gray-500">
          <tr>
            <th className="w-10 px-3 py-2"></th>
            <th className="w-12 px-3 py-2">#</th>
            <th className="px-3 py-2">输入 Prompt</th>
            <th className="w-28 px-3 py-2">状态</th>
            <th className="w-20 px-3 py-2">目标数</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => {
            const status = computeRowStatus(row.items);
            const meta = ROW_STATUS_META[status];
            const expanded = expandedIds.has(row.inputId);
            const prompt = inputById.get(row.inputId)?.prompt ?? "";

            return (
              <RowGroup
                key={row.inputId}
                rowIndex={rowIndex}
                row={row}
                prompt={prompt}
                statusLabel={meta.label}
                statusClassName={meta.className}
                expanded={expanded}
                onToggle={() => toggle(row.inputId)}
                onImageClick={onImageClick}
              />
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

interface RowGroupProps {
  rowIndex: number;
  row: ResultRow;
  prompt: string;
  statusLabel: string;
  statusClassName: string;
  expanded: boolean;
  onToggle: () => void;
  onImageClick: (src: string) => void;
}

function RowGroup({
  rowIndex,
  row,
  prompt,
  statusLabel,
  statusClassName,
  expanded,
  onToggle,
  onImageClick,
}: RowGroupProps) {
  return (
    <>
      <tr
        className="cursor-pointer border-t border-gray-100 hover:bg-gray-50"
        onClick={onToggle}
      >
        <td className="px-3 py-2 text-gray-400">{expanded ? "▾" : "▸"}</td>
        <td className="px-3 py-2 text-gray-400">{rowIndex + 1}</td>
        <td className="max-w-md truncate px-3 py-2 text-gray-800">
          {prompt || <span className="text-gray-400">（无文本）</span>}
        </td>
        <td className="px-3 py-2">
          <span className={`rounded-full px-2 py-0.5 text-xs ${statusClassName}`}>
            {statusLabel}
          </span>
        </td>
        <td className="px-3 py-2 text-gray-500">{row.items.length}</td>
      </tr>
      {expanded && (
        <tr className="border-t border-gray-100 bg-gray-50/50">
          <td colSpan={5} className="px-3 py-3">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {row.items.map((item) => (
                <div
                  key={item.targetId}
                  className="flex flex-col gap-2 rounded-md border border-gray-200 bg-white p-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">
                        {item.targetName}
                      </span>
                      <TargetTypeTag contentKind={item.contentKind} />
                    </div>
                    <StatusTag status={item.status} />
                  </div>
                  <ResultItemBody item={item} onImageClick={onImageClick} />
                  <LatencyText latencyMs={item.latencyMs} />
                </div>
              ))}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
