"use client";

import { useMemo, useState } from "react";
import type { EvaluationRecord, ResultItem, Task, TaskInput } from "@/types";
import { formatDateTime } from "@/lib/datetime";
import { exportResultsToExcel } from "@/services/excel";
import { ImageLightbox } from "@/components/result/ImageLightbox";

interface EvalHistoryPanelProps {
  /** 唯一数据来源：Project.evaluations（v4.3 增量2）。 */
  evaluations: EvaluationRecord[];
  /** 用于回查来源批次的入参/出参（按 sourceTaskId 关联）。 */
  tasks: Task[];
  projectName: string;
  onDelete: (evaluationId: string) => void;
}

const TEXT_TRUNCATE_LENGTH = 120;

/**
 * 板块⑤「AI 评价结果与历史」（v4.3 增量2）：历史仓库，可随便进。
 * 上方历史评价列表（时间倒序），下方点「查看」展开详情表格（入参/出参/模型/评分/评价 + 总结推荐）。
 */
export function EvalHistoryPanel({
  evaluations,
  tasks,
  projectName,
  onDelete,
}: EvalHistoryPanelProps) {
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  const sorted = useMemo(
    () => [...evaluations].sort((a, b) => b.createTime - a.createTime),
    [evaluations]
  );

  const taskById = useMemo(
    () => new Map(tasks.map((task) => [task.id, task])),
    [tasks]
  );

  const viewingRecord = viewingId
    ? sorted.find((record) => record.id === viewingId) ?? null
    : null;
  const viewingTask = viewingRecord
    ? taskById.get(viewingRecord.sourceTaskId) ?? null
    : null;

  const handleView = (id: string) => {
    setViewingId((current) => (current === id ? null : id));
  };

  const handleDelete = (id: string) => {
    if (viewingId === id) setViewingId(null);
    onDelete(id);
  };

  const handleExport = (record: EvaluationRecord) => {
    const task = taskById.get(record.sourceTaskId);
    if (!task) return;
    exportResultsToExcel({
      projectName,
      inputs: task.inputs,
      results: task.results,
      targetIds: task.targetIds,
      dimensions: record.dimensions,
      evaluations: record.results.map((item) => ({
        inputId: item.inputId,
        scores: item.scores.map((score) => ({
          targetId: score.targetId,
          dimensionScores: score.dimensionScores,
          overallComment: score.overallComment,
        })),
        summary: item.summary,
        recommendation: item.recommendation,
      })),
      fileNamePrefix: "AI评价",
    });
  };

  return (
    <>
      <section className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-white p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">
            历史评价（{evaluations.length}）
          </h2>
        </div>

        {evaluations.length === 0 ? (
          <p className="rounded-md border border-dashed border-gray-200 px-3 py-6 text-center text-sm text-gray-400">
            还没有评价记录。前往「跑批历史」选择批次「去AI评测」，完成后会自动归档到这里。
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-gray-100">
            {sorted.map((record) => {
              const task = taskById.get(record.sourceTaskId);
              const isViewing = record.id === viewingId;
              return (
                <li
                  key={record.id}
                  className={`flex items-center gap-3 py-2.5 ${
                    isViewing ? "bg-blue-50/50" : ""
                  }`}
                >
                  <span className="text-xs text-gray-500">
                    {formatDateTime(record.createTime)}
                  </span>
                  <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600">
                    来源：
                    {task
                      ? `${formatDateTime(task.createTime)}（${task.runMode === "single" ? "单条" : "批量"}）`
                      : "批次已删除"}
                  </span>
                  <span className="text-xs text-gray-500">
                    裁判：{resolveModelName(record, task)}
                  </span>
                  <span className="text-xs text-gray-500">
                    {record.count} 条
                  </span>

                  <div className="ml-auto flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleView(record.id)}
                      className="rounded-md border border-gray-300 px-2.5 py-1 text-xs transition hover:bg-gray-50"
                    >
                      {isViewing ? "查看中" : "查看"}
                    </button>
                    <button
                      type="button"
                      disabled={!task}
                      onClick={() => handleExport(record)}
                      className="rounded-md border border-gray-300 px-2.5 py-1 text-xs transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      导出Excel
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(record.id)}
                      className="rounded-md border border-red-200 px-2.5 py-1 text-xs text-red-600 transition hover:bg-red-50"
                    >
                      删除
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {viewingRecord ? (
        viewingTask ? (
          <EvalDetailTable
            record={viewingRecord}
            task={viewingTask}
            onImageClick={setLightboxSrc}
          />
        ) : (
          <div className="rounded-lg border border-dashed border-slate-200 p-8 text-center text-sm text-slate-400">
            来源批次已删除，无法展示该次评价的入参/出参详情。
          </div>
        )
      ) : (
        <div className="rounded-lg border border-dashed border-slate-200 p-8 text-center text-sm text-slate-400">
          点击上方某条评价记录的「查看」，在此展开评价详情。
        </div>
      )}

      <ImageLightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />
    </>
  );
}

/** 裁判模型展示名：优先从来源批次结果里按 evalModelId 找 targetName，回退 id。 */
function resolveModelName(record: EvaluationRecord, task?: Task): string {
  if (task) {
    for (const row of task.results) {
      const item = row.items.find((it) => it.targetId === record.evalModelId);
      if (item?.targetName) return item.targetName;
    }
  }
  return record.evalModelId;
}

interface EvalDetailTableProps {
  record: EvaluationRecord;
  task: Task;
  onImageClick: (src: string) => void;
}

/**
 * 评价详情表格（v4.5 多维度）：每「输入×目标」一行，列：# | 模型/算法 | 入参 | 出参 |
 * 各维度评分（每维度一列，hover 看理由） | 总体点评。表格末尾附该次评价的总结/推荐。无总分列。
 */
function EvalDetailTable({ record, task, onImageClick }: EvalDetailTableProps) {
  const dimensions = record.dimensions ?? [];

  const inputById = useMemo(
    () => new Map(task.inputs.map((input) => [input.id, input])),
    [task.inputs]
  );
  // 按 inputId+targetId 查该目标的多维度评分 + 总体点评。
  const scoreLookup = useMemo(() => {
    const map = new Map<
      string,
      {
        dimensionScores: { dimension: string; score: number; comment: string }[];
        overallComment?: string;
      }
    >();
    for (const item of record.results) {
      for (const score of item.scores) {
        map.set(`${item.inputId}__${score.targetId}`, {
          dimensionScores: score.dimensionScores,
          overallComment: score.overallComment,
        });
      }
    }
    return map;
  }, [record.results]);

  // 仅展示被评价过的输入（按 record.results 顺序），关联来源批次结果取出参。
  const resultByInputId = useMemo(
    () => new Map(task.results.map((row) => [row.inputId, row])),
    [task.results]
  );

  const evaluatedInputIds = record.results.map((item) => item.inputId);
  const dimensionColSpan = dimensions.length + 1; // 维度列 + 总体点评列

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-white p-5">
      <h2 className="text-base font-semibold">评价详情（按维度）</h2>

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500">
            <tr>
              <th className="w-16 px-3 py-2">#</th>
              <th className="w-40 px-3 py-2">使用的模型 / 算法</th>
              <th className="px-3 py-2">输入（入参）</th>
              <th className="px-3 py-2">出参</th>
              {dimensions.map((dimension) => (
                <th
                  key={dimension.name}
                  className="whitespace-nowrap px-3 py-2"
                  title={
                    dimension.desc
                      ? `${dimension.name}：${dimension.desc}`
                      : dimension.name
                  }
                >
                  {dimension.name}
                </th>
              ))}
              <th className="px-3 py-2">总体点评</th>
            </tr>
          </thead>
          <tbody>
            {evaluatedInputIds.map((inputId, rowIndex) => {
              const input = inputById.get(inputId);
              const row = resultByInputId.get(inputId);
              const items = row?.items ?? [];
              if (items.length === 0) {
                return (
                  <tr key={inputId} className="border-t border-gray-100">
                    <td className="px-3 py-2.5 text-gray-500">
                      第{rowIndex + 1}条
                    </td>
                    <td className="px-3 py-2.5 text-xs text-gray-400">—</td>
                    <td className="px-3 py-2.5">
                      <InputCell input={input} />
                    </td>
                    <td
                      colSpan={dimensionColSpan + 1}
                      className="px-3 py-2.5 text-xs text-gray-400"
                    >
                      （该输入无结果数据）
                    </td>
                  </tr>
                );
              }
              return items.map((item, itemIndex) => {
                const lookup = scoreLookup.get(`${inputId}__${item.targetId}`);
                const dimScoreByName = new Map(
                  (lookup?.dimensionScores ?? []).map((dim) => [
                    dim.dimension,
                    dim,
                  ])
                );
                return (
                  <tr
                    key={`${inputId}-${item.targetId}`}
                    className="border-t border-gray-100 align-top hover:bg-gray-50"
                  >
                    {itemIndex === 0 ? (
                      <td
                        rowSpan={items.length}
                        className="border-r border-gray-100 px-3 py-2.5 font-medium text-gray-500"
                      >
                        第{rowIndex + 1}条
                      </td>
                    ) : null}
                    <td className="px-3 py-2.5 text-gray-800">
                      {item.targetName}
                    </td>
                    {itemIndex === 0 ? (
                      <td
                        rowSpan={items.length}
                        className="border-r border-gray-100 px-3 py-2.5"
                      >
                        <InputCell input={input} />
                      </td>
                    ) : null}
                    <td className="px-3 py-2.5">
                      <OutputCell item={item} onImageClick={onImageClick} />
                    </td>
                    {dimensions.map((dimension) => {
                      const cell = dimScoreByName.get(dimension.name);
                      return (
                        <td
                          key={dimension.name}
                          className="px-3 py-2.5"
                          title={cell?.comment || ""}
                        >
                          {cell ? (
                            <span className="font-semibold text-blue-600">
                              {cell.score.toFixed(1)}
                              {cell.comment && (
                                <span className="ml-1 cursor-help font-normal text-gray-300 hover:text-gray-500">
                                  ⓘ
                                </span>
                              )}
                            </span>
                          ) : (
                            <span className="text-xs text-gray-400">-</span>
                          )}
                        </td>
                      );
                    })}
                    <td className="px-3 py-2.5">
                      <span className="whitespace-pre-wrap break-words text-xs text-gray-600">
                        {lookup?.overallComment || (
                          <span className="text-gray-400">—</span>
                        )}
                      </span>
                    </td>
                  </tr>
                );
              });
            })}
          </tbody>
        </table>
      </div>

      {/* 各输入的总结 / 推荐 */}
      <div className="flex flex-col gap-2">
        {record.results.map((item, index) => {
          if (!item.summary && !item.recommendation) return null;
          return (
            <div
              key={item.inputId}
              className="rounded-md border border-gray-100 bg-gray-50/60 px-3 py-2 text-xs"
            >
              <span className="font-medium text-gray-600">
                第{index + 1}条结论：
              </span>
              {item.summary && (
                <span className="text-gray-700">{item.summary}</span>
              )}
              {item.recommendation && (
                <span className="ml-1 text-gray-700">
                  推荐：{item.recommendation}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </section>
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

  if (item.status === "error" || item.status === "interrupted") {
    return (
      <span className="text-xs text-red-600">{item.error ?? "调用失败"}</span>
    );
  }

  const hasImages = item.outputImages && item.outputImages.length > 0;
  const text = item.outputText ?? "";
  const needsTruncate = text.length > TEXT_TRUNCATE_LENGTH;
  const displayText =
    needsTruncate && !expanded
      ? `${text.slice(0, TEXT_TRUNCATE_LENGTH)}…`
      : text;

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
