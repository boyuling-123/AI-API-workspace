"use client";

import { useMemo, useState } from "react";
import type {
  EvaluationRecord,
  EvaluationDimensionScore,
  EvaluationReviewEvent,
  EvaluatorVersion,
  ResultItem,
  Task,
  TaskInput,
} from "@/types";
import { formatDateTime } from "@/lib/datetime";
import { exportResultsToExcel } from "@/services/excel";
import { downloadEvaluationHtmlReport } from "@/services/evaluationHtmlReport";
import { ImageLightbox } from "@/components/result/ImageLightbox";
import { AUTO_EXPECTED_ANSWER_KEY } from "@/services/expectedAnswer";
import { isEvaluatorVersionIntact } from "@/lib/evaluatorVersion";
import { EvaluationLeaderboard } from "./EvaluationLeaderboard";
import { EvaluationCaseFilterPanel } from "./EvaluationCaseFilterPanel";
import { EvaluationHumanReviewPanel } from "./EvaluationHumanReviewPanel";
import { EvaluationEvidenceList } from "./EvaluationEvidenceList";
import {
  DEFAULT_DISAGREEMENT_THRESHOLD,
  DEFAULT_LOW_SCORE_THRESHOLD,
  EVALUATION_CASE_SIGNAL_LABELS,
  buildEvaluationCaseExportSelection,
  buildEvaluationCaseInsights,
  filterEvaluationCaseInsights,
  type EvaluationCaseInsight,
  type EvaluationCaseMatchMode,
  type EvaluationCaseSignal,
} from "@/lib/evaluationCaseFilter";
import {
  buildLatestEvaluationReviewMap,
  evaluationReviewKey,
  isEvaluationReviewEventIntact,
} from "@/lib/evaluationReview";

interface EvalHistoryPanelProps {
  /** 唯一数据来源：Project.evaluations（v4.3 增量2）。 */
  evaluations: EvaluationRecord[];
  evaluatorVersions: EvaluatorVersion[];
  reviewEvents: EvaluationReviewEvent[];
  /** 用于回查来源批次的入参/出参（按 sourceTaskId 关联）。 */
  tasks: Task[];
  projectName: string;
  onDelete: (evaluationId: string) => void;
  onAddDimensions: (record: EvaluationRecord, task: Task) => void;
  onSaveReview: (event: EvaluationReviewEvent) => void;
}

const TEXT_TRUNCATE_LENGTH = 120;

/**
 * 板块⑤「AI 评价结果与历史」（v4.3 增量2）：历史仓库，可随便进。
 * 上方历史评价列表（时间倒序），下方点「查看」展开详情表格（入参/出参/模型/评分/评价 + 总结推荐）。
 */
export function EvalHistoryPanel({
  evaluations,
  evaluatorVersions,
  reviewEvents,
  tasks,
  projectName,
  onDelete,
  onAddDimensions,
  onSaveReview,
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
  const evaluationById = useMemo(
    () => new Map(evaluations.map((record) => [record.id, record])),
    [evaluations]
  );
  const evaluatorVersionById = useMemo(
    () =>
      new Map(
        evaluatorVersions
          .filter(isEvaluatorVersionIntact)
          .map((version) => [version.id, version])
      ),
    [evaluatorVersions]
  );
  const corruptEvaluatorVersionIds = useMemo(
    () =>
      new Set(
        evaluatorVersions
          .filter((version) => !isEvaluatorVersionIntact(version))
          .map((version) => version.id)
      ),
    [evaluatorVersions]
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
          weightedScore: score.weightedScore,
          vetoed: score.vetoed,
          vetoReasons: score.vetoReasons,
          overallComment: score.overallComment,
        })),
        summary: item.summary,
        recommendation: item.recommendation,
      })),
      fileNamePrefix: "AI评价",
    });
  };

  const handleHtmlExport = (record: EvaluationRecord) => {
    const task = taskById.get(record.sourceTaskId);
    if (!task) return;
    downloadEvaluationHtmlReport({
      projectName,
      record,
      task,
      evaluatorVersions,
      reviewEvents,
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
              const sourceEvaluation = record.sourceEvaluationId
                ? evaluationById.get(record.sourceEvaluationId)
                : null;
              const evaluatorVersion = record.evaluatorVersionId
                ? evaluatorVersionById.get(record.evaluatorVersionId)
                : null;
              const isViewing = record.id === viewingId;
              return (
                <li
                  key={record.id}
                  className={`flex flex-wrap items-center gap-3 py-2.5 ${
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
                  <span
                    className={`rounded px-1.5 py-0.5 text-xs ${
                      evaluatorVersion
                        ? "bg-indigo-50 text-indigo-700"
                        : "bg-slate-100 text-slate-500"
                    }`}
                    title={record.evaluatorVersionId}
                  >
                    Evaluator：
                    {evaluatorVersion
                      ? `${evaluatorVersion.name} v${evaluatorVersion.version}`
                      : record.evaluatorVersionId
                        ? corruptEvaluatorVersionIds.has(
                            record.evaluatorVersionId
                          )
                          ? "版本损坏"
                          : "版本已删除"
                        : "未绑定版本"}
                  </span>
                  <span className="rounded bg-blue-50 px-1.5 py-0.5 text-xs text-blue-700">
                    {record.evaluationMode === "reference"
                      ? `标准答案${formatExpectedColumn(record.expectedAnswerColumn)}`
                      : "横向对比"}
                  </span>
                  {record.evaluationKind === "new_dimensions" && (
                    <span
                      title={record.sourceEvaluationId}
                      className="rounded bg-emerald-50 px-1.5 py-0.5 text-xs text-emerald-700"
                    >
                      新增维度 · 来源评价：
                      {sourceEvaluation
                        ? formatDateTime(sourceEvaluation.createTime)
                        : record.sourceEvaluationId
                          ? `${record.sourceEvaluationId.slice(0, 10)}（已删除）`
                          : "未知"}
                    </span>
                  )}
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
                      disabled={!task || record.results.length === 0}
                      onClick={() => task && onAddDimensions(record, task)}
                      className="rounded-md border border-emerald-200 px-2.5 py-1 text-xs text-emerald-700 transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      新增维度评价
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
                      disabled={!task}
                      onClick={() => handleHtmlExport(record)}
                      title="下载含原始结果、评价配置、Evaluator 版本与完整性校验的离线报告"
                      className="rounded-md border border-orange-200 bg-orange-50 px-2.5 py-1 text-xs font-medium text-orange-800 transition hover:bg-orange-100 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      导出HTML报告
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
            key={viewingRecord.id}
            record={viewingRecord}
            task={viewingTask}
            projectName={projectName}
            reviewEvents={reviewEvents}
            onImageClick={setLightboxSrc}
            onSaveReview={onSaveReview}
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

function formatExpectedColumn(column?: string): string {
  if (!column) return "";
  if (column === AUTO_EXPECTED_ANSWER_KEY) return "：自动识别";
  return `：${column}`;
}

interface EvalDetailTableProps {
  record: EvaluationRecord;
  task: Task;
  projectName: string;
  reviewEvents: EvaluationReviewEvent[];
  onImageClick: (src: string) => void;
  onSaveReview: (event: EvaluationReviewEvent) => void;
}

/**
 * 评价详情表格（v4.5 多维度）：每「输入×目标」一行，列：# | 模型/算法 | 入参 | 出参 |
 * 各维度评分（每维度一列，hover 看理由） | 加权分 | 策略结果 | 总体点评 | 人工复核。
 */
function EvalDetailTable({
  record,
  task,
  projectName,
  reviewEvents,
  onImageClick,
  onSaveReview,
}: EvalDetailTableProps) {
  const [selectedSignals, setSelectedSignals] = useState<
    EvaluationCaseSignal[]
  >([]);
  const [matchMode, setMatchMode] =
    useState<EvaluationCaseMatchMode>("any");
  const [lowScoreThreshold, setLowScoreThreshold] = useState(
    DEFAULT_LOW_SCORE_THRESHOLD
  );
  const [disagreementThreshold, setDisagreementThreshold] = useState(
    DEFAULT_DISAGREEMENT_THRESHOLD
  );
  const [reviewingTarget, setReviewingTarget] = useState<{
    inputId: string;
    targetId: string;
    sourceIndex: number;
  } | null>(null);
  const [reviewMessage, setReviewMessage] = useState("");
  const dimensions = record.dimensions ?? [];
  const detailsTargetId = `evaluation-case-details-${record.id}`;

  const inputById = useMemo(
    () => new Map(task.inputs.map((input) => [input.id, input])),
    [task.inputs]
  );
  // 按 inputId+targetId 查该目标的多维度评分 + 总体点评。
  const scoreLookup = useMemo(() => {
    const map = new Map<
      string,
      {
        dimensionScores: EvaluationDimensionScore[];
        weightedScore?: number;
        vetoed?: boolean;
        vetoReasons?: string[];
        overallComment?: string;
      }
    >();
    for (const item of record.results) {
      for (const score of item.scores) {
        map.set(`${item.inputId}__${score.targetId}`, {
          dimensionScores: score.dimensionScores,
          weightedScore: score.weightedScore,
          vetoed: score.vetoed,
          vetoReasons: score.vetoReasons,
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
  const leaderboardTargets = useMemo(() => {
    const targets = new Map<string, string>();
    for (const row of task.results) {
      for (const item of row.items) {
        if (!targets.has(item.targetId)) {
          targets.set(item.targetId, item.targetName || item.targetId);
        }
      }
    }
    return Array.from(targets, ([targetId, targetName]) => ({
      targetId,
      targetName,
    }));
  }, [task.results]);
  const targetNames = useMemo(
    () =>
      new Map(
        leaderboardTargets.map((target) => [
          target.targetId,
          target.targetName,
        ])
      ),
    [leaderboardTargets]
  );
  const caseInsights = useMemo(
    () =>
      buildEvaluationCaseInsights(record, task, {
        lowScore: lowScoreThreshold,
        disagreement: disagreementThreshold,
      }),
    [record, task, lowScoreThreshold, disagreementThreshold]
  );
  const visibleInsights = useMemo(
    () =>
      filterEvaluationCaseInsights(caseInsights, {
        signals: selectedSignals,
        matchMode,
      }),
    [caseInsights, selectedSignals, matchMode]
  );
  const evaluationByInputId = useMemo(
    () => new Map(record.results.map((item) => [item.inputId, item])),
    [record.results]
  );
  const visibleEvaluations = visibleInsights.flatMap((insight) => {
    const evaluation = evaluationByInputId.get(insight.inputId);
    return evaluation ? [evaluation] : [];
  });
  const visibleInsightByInputId = useMemo(
    () => new Map(visibleInsights.map((insight) => [insight.inputId, insight])),
    [visibleInsights]
  );
  const latestReviewByKey = useMemo(
    () => buildLatestEvaluationReviewMap(reviewEvents, record.id),
    [record.id, reviewEvents]
  );
  const invalidReviewCount = useMemo(
    () =>
      reviewEvents.filter(
        (event) =>
          event.evaluationId === record.id &&
          !isEvaluationReviewEventIntact(event)
      ).length,
    [record.id, reviewEvents]
  );
  const dimensionColSpan = dimensions.length + 4; // 维度列 + 加权分 + 策略结果 + 总体点评 + 人工复核

  const handleToggleSignal = (signal: EvaluationCaseSignal) => {
    setSelectedSignals((current) =>
      current.includes(signal)
        ? current.filter((item) => item !== signal)
        : [...current, signal]
    );
  };

  const handleClearFilters = () => {
    setSelectedSignals([]);
    setMatchMode("any");
    setLowScoreThreshold(DEFAULT_LOW_SCORE_THRESHOLD);
    setDisagreementThreshold(DEFAULT_DISAGREEMENT_THRESHOLD);
  };

  const handleFilteredExport = () => {
    const selection = buildEvaluationCaseExportSelection(
      record,
      task,
      visibleInsights.map((insight) => insight.inputId)
    );
    const selectedSignalSet = new Set(selectedSignals);
    exportResultsToExcel({
      projectName,
      inputs: selection.inputs,
      results: selection.results,
      targetIds: task.targetIds,
      dimensions: record.dimensions,
      evaluations: selection.evaluations,
      caseMetadata: visibleInsights.map((insight) => {
        const matchedSignals = insight.signals.filter(
          (signal) =>
            selectedSignalSet.size === 0 || selectedSignalSet.has(signal)
        );
        return {
          inputId: insight.inputId,
          matchedSignals: matchedSignals.map(
            (signal) => EVALUATION_CASE_SIGNAL_LABELS[signal]
          ),
          lowestWeightedScore: insight.lowestScore ?? undefined,
          scoreSpread: insight.scoreSpread ?? undefined,
          details: matchedSignals.flatMap((signal) => insight.details[signal]),
        };
      }),
      fileNamePrefix:
        selectedSignals.length > 0
          ? `AI评价_筛选${selection.evaluations.length}条`
          : "AI评价_全部Case",
    });
  };

  const handleSaveReview = (event: EvaluationReviewEvent) => {
    onSaveReview(event);
    setReviewMessage(
      `已保存 ${event.targetName} 的人工复核版本；AI 原始评分未被修改。`
    );
    setReviewingTarget(null);
  };

  return (
    <>
      <EvaluationLeaderboard
        key={record.id}
        record={record}
        detailsTargetId={detailsTargetId}
        targets={leaderboardTargets}
      />
      <section
        id={detailsTargetId}
        className="flex scroll-mt-4 flex-col gap-3 rounded-lg border border-gray-200 bg-white p-5"
      >
      <div>
        <h2 className="text-base font-semibold">评价详情（按维度）</h2>
        <p className="mt-1 text-xs text-slate-500">
          人工复核后，详情展示当前有效人工分并保留 AI 原分；排行榜继续使用 AI 原分。
        </p>
      </div>

      <EvaluationCaseFilterPanel
        insights={caseInsights}
        visibleCount={visibleInsights.length}
        selectedSignals={selectedSignals}
        matchMode={matchMode}
        lowScoreThreshold={lowScoreThreshold}
        disagreementThreshold={disagreementThreshold}
        onToggleSignal={handleToggleSignal}
        onMatchModeChange={setMatchMode}
        onLowScoreThresholdChange={(value) =>
          setLowScoreThreshold(clampFilterThreshold(value))
        }
        onDisagreementThresholdChange={(value) =>
          setDisagreementThreshold(clampFilterThreshold(value))
        }
        onClear={handleClearFilters}
        onExport={handleFilteredExport}
      />

      {visibleInsights.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center">
          <p className="text-sm font-medium text-slate-700">
            当前组合没有命中 Case
          </p>
          <p className="mt-1 text-xs text-slate-500">
            可以降低阈值、切换为“匹配任一条件”，或清除筛选恢复全部历史。
          </p>
        </div>
      ) : (
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full min-w-[1280px] text-left text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500">
            <tr>
              <th className="w-32 px-3 py-2">#</th>
              <th className="w-40 px-3 py-2">使用的模型 / 算法</th>
              <th className="min-w-48 px-3 py-2">输入（入参）</th>
              <th className="min-w-48 px-3 py-2">出参</th>
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
                  {dimension.weight !== undefined
                    ? ` (${dimension.weight}%)`
                    : ""}
                </th>
              ))}
              <th className="whitespace-nowrap px-3 py-2">加权分</th>
              <th className="whitespace-nowrap px-3 py-2">策略结果</th>
              <th className="min-w-40 px-3 py-2">总体点评</th>
              <th className="w-40 px-3 py-2">人工复核</th>
            </tr>
          </thead>
          <tbody>
            {visibleInsights.map((insight) => {
              const inputId = insight.inputId;
              const input = inputById.get(inputId);
              const row = resultByInputId.get(inputId);
              const items = row?.items ?? [];
              if (items.length === 0) {
                return (
                  <tr key={inputId} className="border-t border-gray-100">
                    <td className="px-3 py-2.5 text-gray-500">
                      <CaseIndexCell insight={insight} />
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
                const review = latestReviewByKey.get(
                  evaluationReviewKey(record.id, inputId, item.targetId)
                );
                const humanScoreByName = new Map(
                  (review?.humanDimensionScores ?? []).map((score) => [
                    score.dimension,
                    score.score,
                  ])
                );
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
                        <CaseIndexCell insight={insight} />
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
                      const humanScore = humanScoreByName.get(dimension.name);
                      return (
                        <td
                          key={dimension.name}
                          className="px-3 py-2.5"
                          title={cell?.comment || ""}
                        >
                          <div className="flex min-w-44 flex-col items-start">
                            {humanScore !== undefined ? (
                              <span className="flex min-w-16 flex-col">
                                <span
                                  aria-label={`人工有效分 ${humanScore.toFixed(1)}`}
                                  className="font-semibold text-teal-700"
                                >
                                  {humanScore.toFixed(1)}
                                  <span className="ml-1 text-[10px] font-medium text-teal-600">
                                    人工
                                  </span>
                                </span>
                                <span className="text-[10px] font-normal text-slate-400">
                                  AI {cell?.score.toFixed(1) ?? "—"}
                                </span>
                              </span>
                            ) : cell ? (
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
                            <EvaluationEvidenceList
                              evidence={cell?.evidence}
                              targetNames={targetNames}
                              label={`${item.targetName} ${dimension.name}`}
                            />
                          </div>
                        </td>
                      );
                    })}
                    <td className="px-3 py-2.5 font-semibold text-slate-700">
                      {review ? (
                        <span className="flex min-w-16 flex-col">
                          <span
                            aria-label={`人工有效加权分 ${review.humanWeightedScore.toFixed(2)}`}
                            className="text-teal-700"
                          >
                            {review.humanWeightedScore.toFixed(2)}
                          </span>
                          <span className="text-[10px] font-normal text-slate-400">
                            AI {lookup?.weightedScore?.toFixed(2) ?? "—"}
                          </span>
                        </span>
                      ) : lookup?.weightedScore === undefined ? (
                        "—"
                      ) : (
                        lookup.weightedScore.toFixed(2)
                      )}
                    </td>
                    <td
                      className={`px-3 py-2.5 text-xs font-semibold ${
                        (review?.humanVetoed ?? lookup?.vetoed)
                          ? "text-red-700"
                          : "text-emerald-700"
                      }`}
                      title={
                        review
                          ? review.humanVetoReasons.join("；")
                          : lookup?.vetoReasons?.join("；") ?? ""
                      }
                    >
                      {review
                        ? review.humanVetoed
                          ? "人工：已否决"
                          : "人工：未否决"
                        : lookup?.vetoed === undefined
                        ? "—"
                        : lookup.vetoed
                          ? "已否决"
                          : "未否决"}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="whitespace-pre-wrap break-words text-xs text-gray-600">
                        {lookup?.overallComment || (
                          <span className="text-gray-400">—</span>
                        )}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex min-w-32 flex-col items-start gap-1.5">
                        {review && (
                          <>
                            <span className="text-[10px] text-slate-500">
                              最新：{review.actor}
                            </span>
                            {review.isBadCase && (
                              <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">
                                Bad Case
                              </span>
                            )}
                            <span
                              title={review.note}
                              className="max-w-32 truncate text-[10px] text-slate-400"
                            >
                              {review.note}
                            </span>
                          </>
                        )}
                        <button
                          type="button"
                          disabled={!lookup}
                          onClick={() => {
                            setReviewMessage("");
                            setReviewingTarget({
                              inputId,
                              targetId: item.targetId,
                              sourceIndex: insight.sourceIndex,
                            });
                          }}
                          aria-label={`人工复核 第${insight.sourceIndex + 1}条 ${item.targetName}`}
                          className="rounded-md border border-teal-200 bg-teal-50 px-2 py-1 text-[11px] font-semibold text-teal-800 hover:bg-teal-100 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          {review ? "继续复核" : "人工复核"}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              });
            })}
          </tbody>
        </table>
      </div>
      )}

      {invalidReviewCount > 0 && (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          已隔离 {invalidReviewCount} 条完整性校验失败的人工复核记录，未用于当前有效分。
        </p>
      )}

      {reviewMessage && (
        <p role="status" className="rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-xs text-teal-800">
          {reviewMessage}
        </p>
      )}

      {reviewingTarget && (
        <EvaluationHumanReviewPanel
          key={`${reviewingTarget.inputId}:${reviewingTarget.targetId}`}
          record={record}
          inputId={reviewingTarget.inputId}
          targetId={reviewingTarget.targetId}
          sourceIndex={reviewingTarget.sourceIndex}
          events={reviewEvents}
          onSave={handleSaveReview}
          onClose={() => setReviewingTarget(null)}
        />
      )}

      {/* 各输入的总结 / 推荐 */}
      <div className="flex flex-col gap-2">
        {visibleEvaluations.map((item) => {
          if (!item.summary && !item.recommendation) return null;
          const insight = visibleInsightByInputId.get(item.inputId);
          return (
            <div
              key={item.inputId}
              className="rounded-md border border-gray-100 bg-gray-50/60 px-3 py-2 text-xs"
            >
              <span className="font-medium text-gray-600">
                第{(insight?.sourceIndex ?? 0) + 1}条结论：
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
    </>
  );
}

const CASE_SIGNAL_BADGE_CLASSES: Record<EvaluationCaseSignal, string> = {
  low_score: "border-amber-200 bg-amber-50 text-amber-800",
  disagreement: "border-sky-200 bg-sky-50 text-sky-800",
  high_risk: "border-rose-200 bg-rose-50 text-rose-800",
  failure: "border-slate-300 bg-slate-100 text-slate-700",
};

function CaseIndexCell({ insight }: { insight: EvaluationCaseInsight }) {
  return (
    <div className="flex min-w-24 flex-col gap-1.5">
      <span>第{insight.sourceIndex + 1}条</span>
      {insight.signals.length > 0 && (
        <span className="flex flex-wrap gap-1">
          {insight.signals.map((signal) => (
            <span
              key={signal}
              title={insight.details[signal].join("；")}
              className={`rounded border px-1.5 py-0.5 text-[10px] font-medium ${CASE_SIGNAL_BADGE_CLASSES[signal]}`}
            >
              {EVALUATION_CASE_SIGNAL_LABELS[signal]}
            </span>
          ))}
        </span>
      )}
    </div>
  );
}

function clampFilterThreshold(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(10, Math.max(0, Math.round(value * 10) / 10));
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
