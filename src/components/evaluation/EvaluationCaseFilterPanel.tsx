import {
  EVALUATION_CASE_SIGNAL_LABELS,
  EVALUATION_CASE_SIGNAL_ORDER,
  HIGH_RISK_SCORE_THRESHOLD,
  type EvaluationCaseInsight,
  type EvaluationCaseMatchMode,
  type EvaluationCaseSignal,
} from "@/lib/evaluationCaseFilter";

interface EvaluationCaseFilterPanelProps {
  insights: EvaluationCaseInsight[];
  visibleCount: number;
  selectedSignals: EvaluationCaseSignal[];
  matchMode: EvaluationCaseMatchMode;
  lowScoreThreshold: number;
  disagreementThreshold: number;
  onToggleSignal: (signal: EvaluationCaseSignal) => void;
  onMatchModeChange: (mode: EvaluationCaseMatchMode) => void;
  onLowScoreThresholdChange: (value: number) => void;
  onDisagreementThresholdChange: (value: number) => void;
  onClear: () => void;
  onExport: () => void;
}

const SIGNAL_COPY: Record<
  EvaluationCaseSignal,
  { description: string; activeClass: string; countClass: string }
> = {
  low_score: {
    description: "任一模型加权分低于阈值",
    activeClass: "border-amber-400 bg-amber-50",
    countClass: "bg-amber-100 text-amber-800",
  },
  disagreement: {
    description: "同一 Case 的模型分差达到阈值",
    activeClass: "border-sky-400 bg-sky-50",
    countClass: "bg-sky-100 text-sky-800",
  },
  high_risk: {
    description: `一票否决或加权分不高于 ${HIGH_RISK_SCORE_THRESHOLD}`,
    activeClass: "border-rose-400 bg-rose-50",
    countClass: "bg-rose-100 text-rose-800",
  },
  failure: {
    description: "运行失败、中断、缺结果或缺评价分",
    activeClass: "border-slate-500 bg-slate-100",
    countClass: "bg-slate-200 text-slate-800",
  },
};

export function EvaluationCaseFilterPanel({
  insights,
  visibleCount,
  selectedSignals,
  matchMode,
  lowScoreThreshold,
  disagreementThreshold,
  onToggleSignal,
  onMatchModeChange,
  onLowScoreThresholdChange,
  onDisagreementThresholdChange,
  onClear,
  onExport,
}: EvaluationCaseFilterPanelProps) {
  const signalCounts = new Map(
    EVALUATION_CASE_SIGNAL_ORDER.map((signal) => [
      signal,
      insights.filter((insight) => insight.signals.includes(signal)).length,
    ])
  );
  const hasActiveFilters = selectedSignals.length > 0;

  return (
    <section
      aria-label="评价 Case 筛选"
      className="rounded-xl border border-slate-200 bg-gradient-to-br from-slate-50 via-white to-sky-50/60 p-4"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-slate-900">
              Case 风险筛选
            </h3>
            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-800">
              确定性规则 · 0 次模型调用
            </span>
          </div>
          <p className="mt-1 max-w-3xl text-xs leading-5 text-slate-600">
            只读取已保存的原始评分与来源运行状态。筛选不会修改历史评价，导出会保留命中
            Case 的全部模型结果。
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-right shadow-sm">
          <span className="block text-[11px] text-slate-500">当前显示</span>
          <strong
            aria-label={`当前显示 ${visibleCount} / ${insights.length} 条`}
            className="text-lg tabular-nums text-slate-900"
          >
            {visibleCount}
            <span className="ml-1 text-xs font-normal text-slate-500">
              / {insights.length} 条
            </span>
          </strong>
        </div>
      </div>

      <fieldset className="mt-4">
        <legend className="sr-only">选择 Case 筛选类型</legend>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {EVALUATION_CASE_SIGNAL_ORDER.map((signal) => {
            const copy = SIGNAL_COPY[signal];
            const selected = selectedSignals.includes(signal);
            return (
              <label
                key={signal}
                className={`flex cursor-pointer items-start gap-2 rounded-lg border p-3 transition ${
                  selected
                    ? copy.activeClass
                    : "border-slate-200 bg-white hover:border-slate-300"
                }`}
              >
                <input
                  type="checkbox"
                  checked={selected}
                  onChange={() => onToggleSignal(signal)}
                  aria-label={`筛选${EVALUATION_CASE_SIGNAL_LABELS[signal]} Case`}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-sky-700 focus:ring-sky-600"
                />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-slate-800">
                      {EVALUATION_CASE_SIGNAL_LABELS[signal]}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums ${copy.countClass}`}
                    >
                      {signalCounts.get(signal) ?? 0}
                    </span>
                  </span>
                  <span className="mt-1 block text-[11px] leading-4 text-slate-600">
                    {copy.description}
                  </span>
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <div className="mt-3 flex flex-wrap items-end gap-3 rounded-lg border border-slate-200/80 bg-white/80 p-3">
        <label className="flex min-w-36 flex-col gap-1 text-xs font-medium text-slate-700">
          低分阈值（严格低于）
          <input
            type="number"
            min={0}
            max={10}
            step={0.1}
            value={lowScoreThreshold}
            onChange={(event) =>
              onLowScoreThresholdChange(Number(event.target.value))
            }
            aria-label="低分筛选阈值"
            className="h-9 rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-900 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
          />
        </label>
        <label className="flex min-w-36 flex-col gap-1 text-xs font-medium text-slate-700">
          模型分差（大于等于）
          <input
            type="number"
            min={0}
            max={10}
            step={0.1}
            value={disagreementThreshold}
            onChange={(event) =>
              onDisagreementThresholdChange(Number(event.target.value))
            }
            aria-label="模型分歧筛选阈值"
            className="h-9 rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-900 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
          />
        </label>
        <label className="flex min-w-36 flex-col gap-1 text-xs font-medium text-slate-700">
          多条件组合
          <select
            value={matchMode}
            onChange={(event) =>
              onMatchModeChange(event.target.value as EvaluationCaseMatchMode)
            }
            aria-label="筛选组合方式"
            disabled={selectedSignals.length < 2}
            className="h-9 rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-900 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
          >
            <option value="any">匹配任一条件</option>
            <option value="all">同时匹配全部</option>
          </select>
        </label>
        <div className="ml-auto flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onClear}
            disabled={!hasActiveFilters}
            className="h-9 rounded-md border border-slate-300 bg-white px-3 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            清除筛选
          </button>
          <button
            type="button"
            onClick={onExport}
            disabled={visibleCount === 0}
            className="h-9 rounded-md bg-slate-900 px-3 text-xs font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            导出当前筛选（{visibleCount} 条）
          </button>
        </div>
      </div>

      <p className="mt-2 text-[11px] text-slate-500" role="status">
        {hasActiveFilters
          ? `已启用 ${selectedSignals.length} 个条件，按“${
              matchMode === "all" ? "同时匹配全部" : "匹配任一条件"
            }”显示。`
          : "未启用筛选，当前显示全部已评价 Case。"}
      </p>
    </section>
  );
}
