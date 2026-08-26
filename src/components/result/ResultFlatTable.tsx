"use client";

import { useState } from "react";
import type { ResultItem, ResultRow, TaskInput } from "@/types";
import { LatencyText, StatusTag, TargetTypeTag } from "./resultShared";

interface ResultFlatTableProps {
  rows: ResultRow[];
  inputs: TaskInput[];
  onImageClick: (src: string) => void;
}

const TEXT_TRUNCATE_LENGTH = 120;

/**
 * 需求三·结果对比表格：每个「输入 × 目标」组合占一行。
 * 列：输入(入参) | 出参 | 使用的模型/算法 | 状态 | 用时。
 * 行数 = 输入条数 × 该批次目标数。
 */
export function ResultFlatTable({
  rows,
  inputs,
  onImageClick,
}: ResultFlatTableProps) {
  const inputById = new Map(inputs.map((input) => [input.id, input]));

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200">
      <table className="w-full text-left text-sm">
        <thead className="bg-gray-50 text-xs text-gray-500">
          <tr>
            <th className="w-16 px-3 py-2">#</th>
            <th className="px-3 py-2">输入（入参）</th>
            <th className="px-3 py-2">出参</th>
            <th className="w-40 px-3 py-2">使用的模型 / 算法</th>
            <th className="w-24 px-3 py-2">状态</th>
            <th className="w-20 px-3 py-2">用时</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => {
            const input = inputById.get(row.inputId);
            return row.items.map((item, itemIndex) => (
              <FlatRow
                key={`${row.inputId}-${item.targetId}`}
                inputLabel={`第${rowIndex + 1}条输入`}
                isFirstOfGroup={itemIndex === 0}
                groupSize={row.items.length}
                input={input}
                item={item}
                onImageClick={onImageClick}
              />
            ));
          })}
        </tbody>
      </table>
    </div>
  );
}

interface FlatRowProps {
  inputLabel: string;
  isFirstOfGroup: boolean;
  groupSize: number;
  input?: TaskInput;
  item: ResultItem;
  onImageClick: (src: string) => void;
}

function FlatRow({
  inputLabel,
  isFirstOfGroup,
  groupSize,
  input,
  item,
  onImageClick,
}: FlatRowProps) {
  return (
    <tr className="border-t border-gray-100 align-top hover:bg-gray-50">
      {isFirstOfGroup ? (
        <>
          <td
            rowSpan={groupSize}
            className="border-r border-gray-100 px-3 py-2.5 font-medium text-gray-500"
          >
            {inputLabel}
          </td>
          <td
            rowSpan={groupSize}
            className="border-r border-gray-100 px-3 py-2.5"
          >
            <InputCell input={input} />
          </td>
        </>
      ) : null}
      <td className="px-3 py-2.5">
        <OutputCell item={item} onImageClick={onImageClick} />
      </td>
      <td className="px-3 py-2.5">
        <div className="flex items-center gap-1.5">
          <span className="text-gray-800">{item.targetName}</span>
          <TargetTypeTag contentKind={item.contentKind} />
        </div>
      </td>
      <td className="px-3 py-2.5">
        <StatusTag status={item.status} />
      </td>
      <td className="px-3 py-2.5">
        {item.status === "success" ? (
          <LatencyText latencyMs={item.latencyMs} />
        ) : (
          <span className="text-xs text-gray-400">-</span>
        )}
      </td>
    </tr>
  );
}

function InputCell({ input }: { input?: TaskInput }) {
  if (!input) {
    return <span className="text-xs text-gray-400">（无输入）</span>;
  }

  const extraEntries = input.extraFields
    ? Object.entries(input.extraFields).filter(
        ([, value]) => value !== undefined && value !== ""
      )
    : [];

  return (
    <div className="flex max-w-xs flex-col gap-1.5">
      {input.prompt ? (
        <span className="whitespace-pre-wrap break-words text-gray-800">
          {input.prompt}
        </span>
      ) : (
        <span className="text-xs text-gray-400">（无 prompt）</span>
      )}
      {input.images && input.images.length > 0 && (
        <span className="text-xs text-gray-400">
          含图片 {input.images.length} 张
        </span>
      )}
      {extraEntries.length > 0 && (
        <div className="flex flex-col gap-0.5">
          {extraEntries.map(([key, value]) => (
            <span key={key} className="text-xs text-gray-500">
              <span className="text-gray-400">{key}:</span>{" "}
              {String(value).slice(0, 40)}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

interface OutputCellProps {
  item: ResultItem;
  onImageClick: (src: string) => void;
}

function OutputCell({ item, onImageClick }: OutputCellProps) {
  const [expanded, setExpanded] = useState(false);

  if (item.status === "pending" || item.status === "running") {
    return (
      <span className="text-xs text-gray-400">
        {item.status === "pending" ? "排队中…" : "请求中…"}
      </span>
    );
  }

  if (item.status === "error" || item.status === "interrupted") {
    return (
      <span className="text-xs text-red-600">{item.error ?? "调用失败"}</span>
    );
  }

  const hasImages = item.outputImages && item.outputImages.length > 0;
  const text = item.outputText ?? "";
  const needsTruncate = text.length > TEXT_TRUNCATE_LENGTH;
  const displayText =
    needsTruncate && !expanded ? `${text.slice(0, TEXT_TRUNCATE_LENGTH)}…` : text;

  return (
    <div className="flex max-w-md flex-col gap-2">
      {text && (
        <div className="flex flex-col items-start gap-1">
          <span className="whitespace-pre-wrap break-words text-gray-800">
            {displayText}
          </span>
          {needsTruncate && (
            <button
              type="button"
              onClick={() => setExpanded((prev) => !prev)}
              className="text-xs text-blue-600 hover:underline"
            >
              {expanded ? "收起" : "展开"}
            </button>
          )}
        </div>
      )}
      {hasImages && (
        <div className="flex flex-wrap gap-2">
          {item.outputImages!.map((src, index) => (
            // eslint-disable-next-line @next/next/no-img-element -- Output may use a data URL or an arbitrary user endpoint.
            <img
              key={`${item.targetId}-img-${index}`}
              src={src}
              alt={`输出图 ${index + 1}`}
              className="h-16 w-16 cursor-zoom-in rounded border border-gray-200 object-cover transition hover:opacity-80"
              onClick={() => onImageClick(src)}
            />
          ))}
        </div>
      )}
      {!text && !hasImages && (
        <span className="text-xs text-gray-400">（无输出）</span>
      )}
    </div>
  );
}
