"use client";

import { useMemo, useState } from "react";
import type { EvaluationRecord } from "@/types";
import {
  buildEvaluationLeaderboard,
  type EvaluationLeaderboardTarget,
} from "@/lib/evaluationLeaderboard";

interface EvaluationLeaderboardProps {
  record: EvaluationRecord;
  detailsTargetId: string;
  targets: EvaluationLeaderboardTarget[];
}

export function EvaluationLeaderboard({
  record,
  detailsTargetId,
  targets,
}: EvaluationLeaderboardProps) {
  const dimensions = useMemo(() => {
    const seen = new Set<string>();
    return record.dimensions.filter((dimension) => {
      if (!dimension.name || seen.has(dimension.name)) return false;
      seen.add(dimension.name);
      return true;
    });
  }, [record.dimensions]);
  const [selectedNames, setSelectedNames] = useState(() =>
    dimensions.map((dimension) => dimension.name)
  );
  const leaderboard = useMemo(
    () => buildEvaluationLeaderboard(record, selectedNames, targets),
    [record, selectedNames, targets]
  );

  const toggleDimension = (name: string) => {
    setSelectedNames((current) =>
      current.includes(name)
        ? current.filter((item) => item !== name)
        : [...current, name]
    );
  };
  const title =
    selectedNames.length === dimensions.length
      ? "综合排行榜"
      : selectedNames.length === 1
        ? `单维度排行榜 · ${selectedNames[0]}`
        : "自定义维度排行榜";

  return (
    <section
      aria-label="评价排行榜"
      className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-gradient-to-br from-slate-50 via-white to-cyan-50/60 p-4"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold text-slate-900">{title}</h3>
            <span className="rounded-full border border-cyan-200 bg-cyan-50 px-2 py-0.5 text-[11px] font-semibold text-cyan-800">
              0 次模型调用
            </span>
          </div>
          <p className="mt-1 max-w-3xl text-xs leading-5 text-slate-600">
            每个 Case 先按所选维度的原权重重新归一，再跨 Case 求平均。缺失分数不补
            0，只有覆盖全部 {leaderboard.totalCases} 个评价 Case 的模型获得正式名次。
          </p>
        </div>
        <a
          href={`#${detailsTargetId}`}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
        >
          下钻原始 Case 明细
        </a>
      </div>

      {dimensions.length > 0 && (
        <fieldset className="flex flex-col gap-2">
          <legend className="text-xs font-semibold text-slate-700">
            勾选关注维度，排行榜会即时重算
          </legend>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() =>
                setSelectedNames(dimensions.map((dimension) => dimension.name))
              }
              disabled={selectedNames.length === dimensions.length}
              className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-45"
            >
              全选维度
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {dimensions.map((dimension) => {
              const selected = selectedNames.includes(dimension.name);
              return (
                <div
                  key={dimension.name}
                  className={`flex items-center gap-2 rounded-lg border px-2.5 py-2 text-xs transition ${
                    selected
                      ? "border-cyan-300 bg-cyan-50 text-cyan-950"
                      : "border-slate-200 bg-white text-slate-500"
                  }`}
                >
                  <label className="flex cursor-pointer items-center gap-2 font-medium">
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={() => toggleDimension(dimension.name)}
                      aria-label={`排行榜维度 ${dimension.name}`}
                      className="h-4 w-4 rounded border-slate-300 text-cyan-700 focus:ring-cyan-600"
                    />
                    <span>{dimension.name}</span>
                    {dimension.weight !== undefined && (
                      <span className="text-slate-600">
                        原权重 {dimension.weight}%
                      </span>
                    )}
                  </label>
                  <button
                    type="button"
                    onClick={() => setSelectedNames([dimension.name])}
                    aria-label={`只看 ${dimension.name}`}
                    className="rounded border border-current/20 bg-white/80 px-1.5 py-0.5 text-[11px] font-semibold text-cyan-800 hover:bg-white"
                  >
                    仅此维度
                  </button>
                </div>
              );
            })}
          </div>
        </fieldset>
      )}

      {dimensions.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white px-4 py-5 text-center text-sm text-slate-600">
          该历史评价没有维度快照，无法生成排行榜；下方原始 Case 明细仍可查看。
        </div>
      ) : selectedNames.length === 0 ? (
        <div className="rounded-lg border border-dashed border-amber-300 bg-amber-50 px-4 py-5 text-center text-sm text-amber-900">
          至少选择一个关注维度，平台才会计算排名；原始评价数据没有被修改。
        </div>
      ) : leaderboard.entries.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white px-4 py-5 text-center text-sm text-slate-500">
          当前评价记录没有可排名的模型分数。
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-2 text-xs text-slate-600">
            <span className="rounded-full bg-white px-2.5 py-1 shadow-sm ring-1 ring-slate-200">
              正式排名 {leaderboard.eligibleTargets}/{leaderboard.entries.length} 个模型
            </span>
            <span className="rounded-full bg-white px-2.5 py-1 shadow-sm ring-1 ring-slate-200">
              评价 Case {leaderboard.totalCases} 条
            </span>
            <span className="rounded-full bg-white px-2.5 py-1 shadow-sm ring-1 ring-slate-200">
              当前权重：
              {leaderboard.selectedDimensions
                .map(
                  (dimension) =>
                    `${dimension.name} ${formatPercent(dimension.normalizedWeight)}`
                )
                .join(" · ")}
            </span>
          </div>

          <ol className="grid gap-3 lg:grid-cols-2">
            {leaderboard.entries.map((entry) => (
              <li
                key={entry.targetId}
                aria-label={`${entry.targetName} 排名结果`}
                className="grid grid-cols-[auto_1fr] gap-3 rounded-xl border border-white bg-white/90 p-3 shadow-sm ring-1 ring-slate-200/80"
              >
                <div
                  className={`flex h-11 w-11 items-center justify-center rounded-xl text-sm font-bold ${
                    entry.rank === 1
                      ? "bg-amber-100 text-amber-900"
                      : entry.rank
                        ? "bg-slate-100 text-slate-700"
                        : "bg-slate-50 text-slate-600"
                  }`}
                  aria-label={entry.rank ? `第 ${entry.rank} 名` : "未排名"}
                >
                  {entry.rank ? `#${entry.rank}` : "—"}
                </div>

                <div className="min-w-0">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="truncate text-sm font-semibold text-slate-900">
                        {entry.targetName}
                      </p>
                      <p className="mt-0.5 text-[11px] text-slate-600">
                        {entry.targetId}
                      </p>
                    </div>
                    <div className="text-right">
                      <p
                        aria-label={`当前综合分 ${
                          entry.score === null ? "无" : entry.score.toFixed(2)
                        }`}
                        className={`text-xl font-bold ${scoreClass(entry.score)}`}
                      >
                        {entry.score === null ? "—" : entry.score.toFixed(2)}
                      </p>
                      <p className="text-[11px] text-slate-600">当前综合分</p>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px]">
                    <span
                      className={`rounded-full px-2 py-1 font-semibold ${
                        entry.eligible
                          ? "bg-emerald-50 text-emerald-800"
                          : "bg-amber-50 text-amber-900"
                      }`}
                    >
                      {entry.eligible ? "覆盖完整" : "覆盖不足"} {entry.evaluatedCases}/
                      {entry.totalCases}
                    </span>
                    <span className="rounded-full bg-rose-50 px-2 py-1 font-semibold text-rose-800">
                      否决 Case {entry.vetoedCases}
                    </span>
                    {!entry.eligible && (
                      <span className="text-slate-500">不参与正式名次</span>
                    )}
                  </div>

                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {entry.dimensionAverages.map((dimension) => (
                      <span
                        key={dimension.dimension}
                        className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] text-slate-600"
                      >
                        {dimension.dimension}：
                        <strong className="text-slate-900">
                          {dimension.score === null
                            ? "—"
                            : dimension.score.toFixed(2)}
                        </strong>
                      </span>
                    ))}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </>
      )}
    </section>
  );
}

function formatPercent(value: number): string {
  return `${Math.round(value * 1000) / 10}%`;
}

function scoreClass(score: number | null): string {
  if (score === null) return "text-slate-600";
  if (score >= 8) return "text-emerald-700";
  if (score >= 5) return "text-amber-700";
  return "text-rose-700";
}
