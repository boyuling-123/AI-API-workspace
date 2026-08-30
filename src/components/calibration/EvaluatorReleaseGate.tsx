"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  EvaluatorRelease,
  EvaluatorVersion,
  JudgeCalibrationRun,
} from "@/types";
import { formatDateTime } from "@/lib/datetime";
import { isEvaluatorVersionIntact } from "@/lib/evaluatorVersion";
import {
  createEvaluatorRelease,
  evaluateEvaluatorCalibrationGate,
  getActiveEvaluatorRelease,
  isEvaluatorReleaseIntact,
} from "@/lib/evaluatorRelease";

interface EvaluatorReleaseGateProps {
  selectedRun?: JudgeCalibrationRun;
  evaluatorVersions: EvaluatorVersion[];
  releases: EvaluatorRelease[];
  onSaveRelease: (release: EvaluatorRelease) => void;
}

export function EvaluatorReleaseGate({
  selectedRun,
  evaluatorVersions,
  releases,
  onSaveRelease,
}: EvaluatorReleaseGateProps) {
  const eligibleVersions = useMemo(
    () =>
      selectedRun?.evaluatorDefinitionFingerprint
        ? evaluatorVersions
            .filter(
              (version) =>
                isEvaluatorVersionIntact(version) &&
                version.evaluatorId === selectedRun.evaluatorId &&
                version.definitionFingerprint ===
                  selectedRun.evaluatorDefinitionFingerprint
            )
            .sort((left, right) => left.version - right.version)
        : [],
    [
      evaluatorVersions,
      selectedRun?.evaluatorDefinitionFingerprint,
      selectedRun?.evaluatorId,
    ]
  );
  const [targetVersionId, setTargetVersionId] = useState("");
  const targetVersion =
    eligibleVersions.find((version) => version.id === targetVersionId) ??
    eligibleVersions.find((version) => version.id === selectedRun?.evaluatorVersionId) ??
    eligibleVersions.at(-1);
  const gate =
    selectedRun && targetVersion
      ? evaluateEvaluatorCalibrationGate(targetVersion, selectedRun)
      : undefined;
  const intactReleases = useMemo(
    () => releases.filter(isEvaluatorReleaseIntact),
    [releases]
  );
  const activeRelease = targetVersion
    ? getActiveEvaluatorRelease(intactReleases, targetVersion.evaluatorId)
    : undefined;
  const familyReleases = targetVersion
    ? intactReleases
        .filter((release) => release.evaluatorId === targetVersion.evaluatorId)
        .sort((left, right) => right.releaseTime - left.releaseTime)
    : [];
  const alreadyActive =
    activeRelease?.evaluatorVersionId === targetVersion?.id;
  const [releasedBy, setReleasedBy] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    setTargetVersionId("");
    setMessage("");
    setError("");
  }, [selectedRun?.id]);

  function openConfirmation() {
    if (!selectedRun || !targetVersion || !gate?.passed) {
      setError("当前校准结果未通过全部发布门禁");
      return;
    }
    if (!releasedBy.trim()) {
      setError("请填写发布人");
      return;
    }
    if (alreadyActive) {
      setError("该 Evaluator 版本已经是当前 Active");
      return;
    }
    setError("");
    setConfirming(true);
  }

  function confirmRelease() {
    if (!selectedRun || !targetVersion || !gate?.passed || alreadyActive) return;
    try {
      const release = createEvaluatorRelease({
        existingReleases: releases,
        evaluatorVersion: targetVersion,
        calibrationRun: selectedRun,
        releasedBy,
      });
      onSaveRelease(release);
      setMessage(
        `${targetVersion.name} v${targetVersion.version} 已发布为 Active。`
      );
      setConfirming(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Evaluator 发布失败");
      setConfirming(false);
    }
  }

  return (
    <section
      aria-label="Evaluator Active 发布门禁"
      className="border-t border-slate-200 bg-slate-50 p-5 dark:border-slate-700 dark:bg-slate-950/40"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.16em] text-amber-700 dark:text-amber-300">
            Release gate
          </p>
          <h3 className="mt-1 text-lg font-bold text-slate-900 dark:text-white">
            Evaluator Active 发布门禁
          </h3>
          <p className="mt-1 max-w-3xl text-xs leading-5 text-slate-600 dark:text-slate-400">
            校准失败或证据不足时禁止发布。门禁通过也不会自动上线，必须填写发布人并再次确认。
          </p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold ${
            gate?.passed
              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-200"
              : "bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-200"
          }`}
        >
          {gate?.passed ? "全部门禁通过" : "禁止发布"}
        </span>
      </div>

      {!selectedRun || !targetVersion || !gate ? (
        <div className="mt-4 rounded-xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500 dark:border-slate-700">
          请选择一条绑定完整 Evaluator 定义的校准运行。
        </div>
      ) : (
        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)]">
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
            <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] gap-3 bg-slate-100 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              <span>检查项</span><span>实际</span><span>要求</span>
            </div>
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {gate.checks.map((check) => (
                <div
                  key={check.key}
                  className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 px-3 py-2.5 text-xs"
                >
                  <span className="flex items-center gap-2 font-medium text-slate-700 dark:text-slate-200">
                    <span
                      aria-hidden="true"
                      className={`h-2.5 w-2.5 rounded-full ${check.passed ? "bg-emerald-500" : "bg-red-500"}`}
                    />
                    <span className="sr-only">
                      {check.passed ? "通过：" : "未通过："}
                    </span>
                    {check.label}
                  </span>
                  <span className={check.passed ? "text-emerald-700 dark:text-emerald-300" : "font-semibold text-red-700 dark:text-red-300"}>
                    {check.actual}
                  </span>
                  <span className="text-right text-slate-500 dark:text-slate-400">
                    {check.expected}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">
              待发布 Evaluator
              <select
                aria-label="待发布 Evaluator 版本"
                value={targetVersion.id}
                onChange={(event) => setTargetVersionId(event.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-950 dark:text-white"
              >
                {eligibleVersions.map((version) => (
                  <option key={version.id} value={version.id}>
                    {version.name} v{version.version}
                  </option>
                ))}
              </select>
            </label>
            <div className="rounded-lg bg-slate-100 px-3 py-2 text-xs leading-5 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              <p className="font-semibold text-slate-800 dark:text-slate-100">当前 Active</p>
              <p className="mt-1">
                {activeRelease
                  ? `${activeRelease.evaluatorVersionName} v${activeRelease.evaluatorVersion} · ${activeRelease.releasedBy}`
                  : "尚未发布"}
              </p>
            </div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">
              发布人
              <input
                aria-label="Evaluator 发布人"
                value={releasedBy}
                onChange={(event) => setReleasedBy(event.target.value)}
                maxLength={40}
                placeholder="例如：Lu"
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-950 dark:text-white"
              />
            </label>
            {message && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">{message}</p>}
            {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-500/10 dark:text-red-300">{error}</p>}
            <button
              type="button"
              onClick={openConfirmation}
              disabled={!gate.passed || alreadyActive}
              className="w-full rounded-lg bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {alreadyActive ? "当前版本已是 Active" : "确认发布为 Active"}
            </button>
            {familyReleases.length > 0 && (
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">发布历史</p>
                <div className="mt-1 space-y-1 text-[11px] text-slate-500 dark:text-slate-400">
                  {familyReleases.slice(0, 5).map((release) => (
                    <p key={release.id}>
                      v{release.evaluatorVersion} · {release.releasedBy} · {formatDateTime(release.releaseTime)}
                    </p>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {confirming && selectedRun && targetVersion && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="确认发布 Evaluator 为 Active"
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl dark:bg-slate-900">
            <p className="font-mono text-xs font-semibold uppercase tracking-[0.16em] text-amber-700 dark:text-amber-300">Release confirmation</p>
            <h4 className="mt-2 text-lg font-bold text-slate-900 dark:text-white">确认发布 Evaluator 为 Active</h4>
            <dl className="mt-4 space-y-2 text-xs text-slate-600 dark:text-slate-300">
              <div className="flex justify-between gap-3"><dt>Evaluator</dt><dd className="font-medium">{targetVersion.name} v{targetVersion.version}</dd></div>
              <div className="flex justify-between gap-3"><dt>校准运行</dt><dd className="font-mono">{selectedRun.id.slice(0, 12)}</dd></div>
              <div className="flex justify-between gap-3"><dt>发布人</dt><dd className="font-medium">{releasedBy.trim()}</dd></div>
              <div className="flex justify-between gap-3"><dt>模型调用</dt><dd className="font-medium text-emerald-700 dark:text-emerald-300">0 次</dd></div>
            </dl>
            <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">
              发布只追加 Active 记录，不修改 Evaluator 或校准历史；旧 Active 会保留在发布历史中。
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setConfirming(false)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 dark:border-slate-600 dark:text-slate-200">取消</button>
              <button type="button" onClick={confirmRelease} className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700">确认发布为 Active</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
