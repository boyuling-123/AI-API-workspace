"use client";

import { useMemo, useState } from "react";
import type {
  EvaluationRecord,
  EvaluationReviewEvent,
  EvaluationReviewScore,
} from "@/types";
import {
  calculateEvaluationReviewOutcome,
  createEvaluationReviewEvent,
  getEvaluationReviewHistory,
} from "@/lib/evaluationReview";
import { formatDateTime } from "@/lib/datetime";

interface EvaluationHumanReviewPanelProps {
  record: EvaluationRecord;
  inputId: string;
  targetId: string;
  sourceIndex: number;
  events: EvaluationReviewEvent[];
  onSave: (event: EvaluationReviewEvent) => void;
  onClose: () => void;
}

export function EvaluationHumanReviewPanel({
  record,
  inputId,
  targetId,
  sourceIndex,
  events,
  onSave,
  onClose,
}: EvaluationHumanReviewPanelProps) {
  const sourceScore = record.results
    .find((item) => item.inputId === inputId)
    ?.scores.find((score) => score.targetId === targetId);
  const history = useMemo(
    () =>
      getEvaluationReviewHistory(events, record.id, inputId, targetId),
    [events, inputId, record.id, targetId]
  );
  const latest = history[0];
  const originalScores = sourceScore?.dimensionScores.map((score) => ({
    dimension: score.dimension,
    score: score.score,
  })) ?? [];
  const [actor, setActor] = useState(latest?.actor ?? "本地用户");
  const [note, setNote] = useState("");
  const [isBadCase, setIsBadCase] = useState(latest?.isBadCase ?? false);
  const [scores, setScores] = useState<EvaluationReviewScore[]>(
    latest?.humanDimensionScores.map((score) => ({ ...score })) ?? originalScores
  );
  const [error, setError] = useState("");

  if (!sourceScore) {
    return (
      <section
        aria-label="人工复核编辑器"
        className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
      >
        未找到该目标的原始 AI 评分，无法进行人工复核。
      </section>
    );
  }

  const preview = calculateEvaluationReviewOutcome(record.dimensions, scores);
  const originalByDimension = new Map(
    originalScores.map((score) => [score.dimension, score.score])
  );

  function updateScore(dimension: string, value: number) {
    const normalized = Number.isFinite(value)
      ? Math.min(10, Math.max(0, Math.round(value * 10) / 10))
      : 0;
    setScores((current) =>
      current.map((score) =>
        score.dimension === dimension ? { ...score, score: normalized } : score
      )
    );
    setError("");
  }

  function restoreAiScores() {
    setScores(originalScores.map((score) => ({ ...score })));
    setError("");
  }

  function submit() {
    try {
      const event = createEvaluationReviewEvent({
        record,
        inputId,
        targetId,
        existingEvents: events,
        actor,
        note,
        isBadCase,
        dimensionScores: scores,
      });
      onSave(event);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "保存人工复核失败");
    }
  }

  return (
    <section
      aria-label="人工复核编辑器"
      className="rounded-xl border border-teal-200 bg-gradient-to-br from-teal-50 via-white to-amber-50/50 p-4 shadow-sm"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-bold text-slate-900">
              第{sourceIndex + 1}条 · {sourceScore.targetName} 人工复核
            </h3>
            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
              只追加审计 · 0 次模型调用
            </span>
          </div>
          <p className="mt-1 max-w-3xl text-xs leading-5 text-slate-600">
            AI 原分永久保留。这里保存的是人工覆盖版本；详情展示当前有效分，排行榜继续按 AI
            原分计算，避免人工操作静默改榜。
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
        >
          关闭
        </button>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_240px]">
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="text-xs font-semibold text-slate-800">逐维度人工分</h4>
            <button
              type="button"
              onClick={restoreAiScores}
              className="rounded-md border border-slate-300 px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-50"
            >
              恢复 AI 原分
            </button>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {scores.map((score) => (
              <label
                key={score.dimension}
                className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs font-medium text-slate-700"
              >
                <span className="flex items-center justify-between gap-2">
                  <span>{score.dimension}</span>
                  <span className="font-normal text-slate-500">
                    AI {originalByDimension.get(score.dimension)?.toFixed(1)}
                  </span>
                </span>
                <input
                  type="number"
                  min={0}
                  max={10}
                  step={0.1}
                  value={score.score}
                  onChange={(event) =>
                    updateScore(score.dimension, Number(event.target.value))
                  }
                  aria-label={`人工评分 ${score.dimension}`}
                  className="mt-2 h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm font-semibold text-slate-900 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                />
              </label>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            <span className="rounded-full bg-teal-50 px-2.5 py-1 font-semibold text-teal-800">
              人工加权分 {preview.weightedScore.toFixed(2)}
            </span>
            <span
              title={preview.vetoReasons.join("；")}
              className={`rounded-full px-2.5 py-1 font-semibold ${
                preview.vetoed
                  ? "bg-red-50 text-red-700"
                  : "bg-emerald-50 text-emerald-700"
              }`}
            >
              {preview.vetoed ? "人工策略：已否决" : "人工策略：未否决"}
            </span>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-600">
              AI 加权分 {sourceScore.weightedScore?.toFixed(2) ?? "—"}
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3">
          <label className="text-xs font-medium text-slate-700">
            修改人
            <input
              value={actor}
              onChange={(event) => {
                setActor(event.target.value);
                setError("");
              }}
              aria-label="人工复核修改人"
              className="mt-1 h-9 w-full rounded-md border border-slate-300 px-2 text-sm text-slate-900 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
            />
          </label>
          <label className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900">
            <input
              type="checkbox"
              checked={isBadCase}
              onChange={(event) => setIsBadCase(event.target.checked)}
              aria-label="标记为 Bad Case"
              className="h-4 w-4 rounded border-amber-300 text-amber-700 focus:ring-amber-600"
            />
            标记为 Bad Case
          </label>
        </div>
      </div>

      <label className="mt-3 block text-xs font-medium text-slate-700">
        修改理由 / 补充意见
        <textarea
          value={note}
          onChange={(event) => {
            setNote(event.target.value);
            setError("");
          }}
          aria-label="人工复核理由"
          rows={3}
          placeholder="必填：说明改分、Bad Case 或补充意见的依据"
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
        />
      </label>
      {error && (
        <p role="alert" className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </p>
      )}
      <div className="mt-3 flex justify-end">
        <button
          type="button"
          onClick={submit}
          className="rounded-lg bg-teal-700 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-800"
        >
          保存人工复核版本
        </button>
      </div>

      {history.length > 0 && (
        <div className="mt-4 border-t border-slate-200 pt-3">
          <h4 className="text-xs font-semibold text-slate-800">
            人工复核历史（{history.length}）
          </h4>
          <ol className="mt-2 space-y-2">
            {history.slice(0, 5).map((event) => (
              <li
                key={event.id}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-slate-800">
                    {event.actor}
                  </span>
                  <span>{formatDateTime(event.createTime)}</span>
                  <span className="font-mono text-teal-700">
                    有效分 {event.humanWeightedScore.toFixed(2)}
                  </span>
                  {event.isBadCase && (
                    <span className="rounded bg-amber-100 px-1.5 py-0.5 font-semibold text-amber-800">
                      Bad Case
                    </span>
                  )}
                </div>
                <p className="mt-1 whitespace-pre-wrap break-words">{event.note}</p>
              </li>
            ))}
          </ol>
        </div>
      )}
    </section>
  );
}
