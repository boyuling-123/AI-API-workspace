"use client";

import { useMemo, useState } from "react";
import type {
  CalibrationReviewDecision,
  CalibrationReviewEvent,
  CalibrationReviewRiskCode,
  CalibrationReviewRiskLevel,
  GoldenDatasetVersion,
  JudgeCalibrationRun,
} from "@/types";
import {
  buildCalibrationReviewQueue,
  CALIBRATION_REVIEW_DECISION_LABELS,
  createCalibrationReviewClaim,
  createCalibrationReviewCompletion,
  isCalibrationReviewEventIntact,
  type CalibrationReviewQueueItem,
  type CalibrationReviewQueueStatus,
} from "@/lib/calibrationReview";
import { formatDateTime } from "@/lib/datetime";

interface CalibrationReviewQueueProps {
  runs: JudgeCalibrationRun[];
  versions: GoldenDatasetVersion[];
  events: CalibrationReviewEvent[];
  onSaveEvent: (event: CalibrationReviewEvent) => void;
}

type StatusFilter = "pending" | CalibrationReviewQueueStatus | "all";
type RiskFilter =
  | "all"
  | "high_risk"
  | "disagreement"
  | "errors"
  | "low_confidence";

interface ReviewDraft {
  decision: CalibrationReviewDecision;
  note: string;
}

const RISK_LEVEL_LABELS: Record<CalibrationReviewRiskLevel, string> = {
  critical: "严重风险",
  high: "高风险",
  medium: "需关注",
};

const RISK_LEVEL_TONES: Record<CalibrationReviewRiskLevel, string> = {
  critical:
    "border-red-300 bg-red-50 text-red-800 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-200",
  high:
    "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200",
  medium:
    "border-blue-300 bg-blue-50 text-blue-800 dark:border-blue-500/40 dark:bg-blue-500/10 dark:text-blue-200",
};

const STATUS_LABELS: Record<CalibrationReviewQueueStatus, string> = {
  unclaimed: "待领取",
  claimed: "复核中",
  completed: "已完成",
};

const DISAGREEMENT_CODES = new Set<CalibrationReviewRiskCode>([
  "bad_case_miss",
  "human_judge_disagreement",
  "multi_judge_disagreement",
]);

function riskMatches(item: CalibrationReviewQueueItem, filter: RiskFilter) {
  if (filter === "all") return true;
  if (filter === "high_risk") {
    return item.risk.level === "critical" || item.risk.level === "high";
  }
  const codes = new Set(item.risk.signals.map((signal) => signal.code));
  if (filter === "disagreement") {
    return Array.from(DISAGREEMENT_CODES).some((code) => codes.has(code));
  }
  if (filter === "errors") return codes.has("judge_error");
  return codes.has("low_confidence");
}

function statusMatches(
  item: CalibrationReviewQueueItem,
  filter: StatusFilter
) {
  if (filter === "all") return true;
  if (filter === "pending") return item.status !== "completed";
  return item.status === filter;
}

function defaultDecision(item: CalibrationReviewQueueItem): CalibrationReviewDecision {
  return item.result.judgeLabel ? "confirm_judge" : "needs_followup";
}

function resultLabel(item: CalibrationReviewQueueItem): string {
  if (item.result.status === "error") return "未形成结论";
  return item.result.judgeLabel ?? "无标签";
}

export function CalibrationReviewQueue({
  runs,
  versions,
  events,
  onSaveEvent,
}: CalibrationReviewQueueProps) {
  const queue = useMemo(
    () => buildCalibrationReviewQueue({ runs, versions, events }),
    [events, runs, versions]
  );
  const invalidEventCount = useMemo(
    () => events.filter((event) => !isCalibrationReviewEventIntact(event)).length,
    [events]
  );
  const [reviewer, setReviewer] = useState("本地用户");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("pending");
  const [riskFilter, setRiskFilter] = useState<RiskFilter>("all");
  const [query, setQuery] = useState("");
  const [drafts, setDrafts] = useState<Record<string, ReviewDraft>>({});
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const counts = useMemo(
    () => ({
      total: queue.length,
      critical: queue.filter((item) => item.risk.level === "critical").length,
      unclaimed: queue.filter((item) => item.status === "unclaimed").length,
      claimed: queue.filter((item) => item.status === "claimed").length,
      completed: queue.filter((item) => item.status === "completed").length,
    }),
    [queue]
  );
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const visibleQueue = useMemo(
    () =>
      queue.filter((item) => {
        if (!statusMatches(item, statusFilter) || !riskMatches(item, riskFilter)) {
          return false;
        }
        if (!normalizedQuery) return true;
        return [
          item.result.caseId,
          item.datasetCase?.prompt,
          item.datasetCase?.candidateOutput,
          item.run.goldenDatasetName,
        ].some((value) => value?.toLocaleLowerCase().includes(normalizedQuery));
      }),
    [normalizedQuery, queue, riskFilter, statusFilter]
  );

  function draftFor(item: CalibrationReviewQueueItem): ReviewDraft {
    return (
      drafts[item.key] ?? {
        decision: defaultDecision(item),
        note: "",
      }
    );
  }

  function updateDraft(item: CalibrationReviewQueueItem, patch: Partial<ReviewDraft>) {
    setDrafts((current) => ({
      ...current,
      [item.key]: { ...draftFor(item), ...patch },
    }));
    setError("");
  }

  function claim(item: CalibrationReviewQueueItem) {
    try {
      const event = createCalibrationReviewClaim({
        item,
        existingEvents: events,
        actor: reviewer,
      });
      onSaveEvent(event);
      setMessage(`${item.result.caseId} 已由 ${event.actor} 领取。`);
      setError("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "领取复核失败");
    }
  }

  function complete(item: CalibrationReviewQueueItem) {
    const draft = draftFor(item);
    try {
      const event = createCalibrationReviewCompletion({
        item,
        existingEvents: events,
        actor: reviewer,
        decision: draft.decision,
        note: draft.note,
      });
      onSaveEvent(event);
      setDrafts((current) => {
        const next = { ...current };
        delete next[item.key];
        return next;
      });
      setMessage(
        `${item.result.caseId} 已完成复核；原始 Judge 结论保持不变。`
      );
      setError("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "提交复核失败");
    }
  }

  return (
    <section
      aria-label="校准人工复核队列"
      className="border-t border-slate-200 bg-slate-50/70 px-5 py-6 dark:border-slate-700 dark:bg-slate-950/40"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.16em] text-amber-700 dark:text-amber-300">
            Human review queue
          </p>
          <h3 className="mt-1 text-lg font-bold text-slate-900 dark:text-white">
            高风险与高频分歧人工复核
          </h3>
          <p className="mt-2 max-w-3xl text-xs leading-5 text-slate-600 dark:text-slate-300">
            风险由固定规则确定性计算；领取、改判和说明只追加为审计事件，不覆盖原始 Judge 投票、仲裁结果或人工黄金标签。
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs font-semibold">
          <span className="rounded-full bg-amber-100 px-3 py-1 text-amber-800 dark:bg-amber-500/15 dark:text-amber-200">
            待处理 {counts.unclaimed + counts.claimed} 条
          </span>
          <span className="rounded-full bg-emerald-100 px-3 py-1 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-200">
            0 次模型调用
          </span>
        </div>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
        {[
          ["风险 Case", counts.total],
          ["严重风险", counts.critical],
          ["待领取", counts.unclaimed],
          ["复核中", counts.claimed],
          ["已完成", counts.completed],
        ].map(([label, value]) => (
          <div
            key={label}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900"
          >
            <dt className="text-[11px] text-slate-500 dark:text-slate-400">{label}</dt>
            <dd className="mt-1 font-mono text-lg font-bold text-slate-900 dark:text-white">{value}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-4 grid gap-3 rounded-xl border border-slate-200 bg-white p-3 sm:grid-cols-2 lg:grid-cols-4 dark:border-slate-700 dark:bg-slate-900">
        <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
          复核人
          <input
            aria-label="校准复核人"
            value={reviewer}
            onChange={(event) => setReviewer(event.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-950 dark:text-white"
          />
        </label>
        <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
          处理状态
          <select
            aria-label="校准复核状态筛选"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-950 dark:text-white"
          >
            <option value="pending">待处理</option>
            <option value="unclaimed">待领取</option>
            <option value="claimed">复核中</option>
            <option value="completed">已完成</option>
            <option value="all">全部状态</option>
          </select>
        </label>
        <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
          风险类型
          <select
            aria-label="校准复核风险筛选"
            value={riskFilter}
            onChange={(event) => setRiskFilter(event.target.value as RiskFilter)}
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-950 dark:text-white"
          >
            <option value="all">全部风险</option>
            <option value="high_risk">严重与高风险</option>
            <option value="disagreement">分歧与漏判</option>
            <option value="errors">调用或解析失败</option>
            <option value="low_confidence">低置信度</option>
          </select>
        </label>
        <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
          搜索 Case
          <input
            aria-label="搜索校准复核 Case"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Case ID、输入或输出"
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-950 dark:text-white"
          />
        </label>
      </div>

      {invalidEventCount > 0 && (
        <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-500/10 dark:text-red-300">
          检测到 {invalidEventCount} 条完整性校验失败的复核事件，已从状态计算中排除。
        </p>
      )}
      {message && (
        <p role="status" className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
          {message}
        </p>
      )}
      {error && (
        <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-500/10 dark:text-red-300">
          {error}
        </p>
      )}

      {queue.length === 0 ? (
        <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-white px-5 py-8 text-center dark:border-slate-700 dark:bg-slate-900">
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">暂无需要人工复核的校准 Case</p>
          <p className="mt-2 text-xs text-slate-500">运行 Judge 校准后，失败、漏判、分歧、低置信度和重复风险会自动进入这里。</p>
        </div>
      ) : visibleQueue.length === 0 ? (
        <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-white px-5 py-8 text-center dark:border-slate-700 dark:bg-slate-900">
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">当前筛选没有匹配 Case</p>
          <button
            type="button"
            onClick={() => {
              setStatusFilter("pending");
              setRiskFilter("all");
              setQuery("");
            }}
            className="mt-3 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:border-slate-600 dark:text-slate-200"
          >
            清除筛选
          </button>
        </div>
      ) : (
        <div
          aria-label="校准复核 Case 列表"
          tabIndex={0}
          className="mt-4 max-h-[720px] space-y-3 overflow-y-auto rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2"
        >
          {visibleQueue.slice(0, 100).map((item) => {
            const draft = draftFor(item);
            const canComplete = item.claim?.actor === reviewer.trim();
            return (
              <article
                key={item.key}
                aria-label={`${item.result.caseId} 校准复核`}
                className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-sm font-bold text-slate-800 dark:text-slate-100">{item.result.caseId}</span>
                      <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${RISK_LEVEL_TONES[item.risk.level]}`}>
                        {RISK_LEVEL_LABELS[item.risk.level]} · {item.risk.score}
                      </span>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                        {STATUS_LABELS[item.status]}
                      </span>
                      {item.risk.occurrenceCount >= 2 && (
                        <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[11px] font-semibold text-orange-800 dark:bg-orange-500/15 dark:text-orange-200">
                          已触发 {item.risk.occurrenceCount} 次
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-[11px] text-slate-500">
                      {item.run.goldenDatasetName} v{item.run.goldenDatasetVersion} · {formatDateTime(item.run.finishTime)}
                    </p>
                  </div>
                  <div className="text-right text-xs">
                    <p className="text-slate-500">原始标签</p>
                    <p className="mt-0.5 font-mono font-semibold text-slate-800 dark:text-slate-100">
                      人工 {item.result.humanLabel} / Judge {resultLabel(item)}
                    </p>
                  </div>
                </div>

                <ul aria-label={`${item.result.caseId} 风险依据`} className="mt-3 flex flex-wrap gap-2">
                  {item.risk.signals.map((signal) => (
                    <li key={signal.code} title={signal.detail} className="rounded-lg bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                      {signal.label} +{signal.score}
                    </li>
                  ))}
                </ul>
                <div className="mt-2 space-y-1 text-xs leading-5 text-slate-600 dark:text-slate-300">
                  {item.risk.signals.map((signal) => (
                    <p key={signal.code}><span className="font-semibold">{signal.label}：</span>{signal.detail}</p>
                  ))}
                </div>

                {item.datasetCase && (
                  <details className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-950/60">
                    <summary className="cursor-pointer font-semibold text-slate-700 dark:text-slate-200">查看输入与候选输出</summary>
                    <dl className="mt-2 grid gap-2">
                      <div><dt className="font-semibold text-slate-500">输入</dt><dd className="mt-0.5 whitespace-pre-wrap text-slate-700 dark:text-slate-200">{item.datasetCase.prompt}</dd></div>
                      <div><dt className="font-semibold text-slate-500">候选输出</dt><dd className="mt-0.5 whitespace-pre-wrap text-slate-700 dark:text-slate-200">{item.datasetCase.candidateOutput}</dd></div>
                    </dl>
                  </details>
                )}

                {item.status === "unclaimed" && (
                  <div className="mt-3 flex justify-end">
                    <button
                      type="button"
                      onClick={() => claim(item)}
                      className="rounded-lg bg-amber-700 px-3 py-2 text-xs font-semibold text-white hover:bg-amber-800"
                    >
                      领取复核
                    </button>
                  </div>
                )}

                {item.status === "claimed" && item.claim && (
                  <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50/60 p-3 dark:border-amber-500/30 dark:bg-amber-500/5">
                    <p className="text-xs font-semibold text-amber-900 dark:text-amber-100">
                      {item.claim.actor} 于 {formatDateTime(item.claim.createTime)} 领取
                    </p>
                    {!canComplete && (
                      <p className="mt-1 text-xs text-amber-800 dark:text-amber-200">请将上方复核人填写为 {item.claim.actor} 后提交。</p>
                    )}
                    <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,220px)_minmax(0,1fr)]">
                      <label className="text-xs font-medium text-slate-700 dark:text-slate-200">
                        复核结论
                        <select
                          aria-label={`${item.result.caseId} 复核结论`}
                          value={draft.decision}
                          onChange={(event) => updateDraft(item, { decision: event.target.value as CalibrationReviewDecision })}
                          className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-950 dark:text-white"
                        >
                          {item.result.judgeLabel && <option value="confirm_judge">确认原 Judge 结论</option>}
                          <option value="override_pass">人工改判为 pass</option>
                          <option value="override_fail">人工改判为 fail</option>
                          <option value="needs_followup">需要后续处理</option>
                        </select>
                      </label>
                      <label className="text-xs font-medium text-slate-700 dark:text-slate-200">
                        复核说明（必填）
                        <textarea
                          aria-label={`${item.result.caseId} 复核说明`}
                          value={draft.note}
                          onChange={(event) => updateDraft(item, { note: event.target.value })}
                          rows={3}
                          placeholder="说明证据、改判原因或后续动作"
                          className="mt-1 w-full resize-y rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm leading-5 text-slate-900 dark:border-slate-600 dark:bg-slate-950 dark:text-white"
                        />
                      </label>
                    </div>
                    <div className="mt-3 flex justify-end">
                      <button
                        type="button"
                        disabled={!canComplete || !draft.note.trim()}
                        onClick={() => complete(item)}
                        className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-amber-500 dark:text-slate-950 dark:hover:bg-amber-400"
                      >
                        完成复核
                      </button>
                    </div>
                  </div>
                )}

                {item.status === "completed" && item.completion && (
                  <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50/70 p-3 text-xs dark:border-emerald-500/30 dark:bg-emerald-500/5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-semibold text-emerald-900 dark:text-emerald-100">
                        {CALIBRATION_REVIEW_DECISION_LABELS[item.completion.decision!]}
                      </p>
                      <p className="text-emerald-700 dark:text-emerald-300">
                        {item.completion.actor} · {formatDateTime(item.completion.createTime)}
                      </p>
                    </div>
                    <p className="mt-2 leading-5 text-slate-700 dark:text-slate-200">{item.completion.note}</p>
                    <p className="mt-2 font-medium text-slate-600 dark:text-slate-300">
                      人工复核层：{item.completion.resolutionLabel ?? "待后续处理"}；原始 Judge {resultLabel(item)} 保持不变。
                    </p>
                    <details aria-label={`${item.result.caseId} 复核审计记录`} className="mt-2">
                      <summary className="cursor-pointer font-semibold text-emerald-800 dark:text-emerald-200">查看只追加审计记录</summary>
                      <ol className="mt-2 space-y-1 text-slate-600 dark:text-slate-300">
                        {item.claim && <li>1. {formatDateTime(item.claim.createTime)} · {item.claim.actor} 领取</li>}
                        <li>2. {formatDateTime(item.completion.createTime)} · {item.completion.actor} 完成：{CALIBRATION_REVIEW_DECISION_LABELS[item.completion.decision!]}</li>
                      </ol>
                    </details>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
