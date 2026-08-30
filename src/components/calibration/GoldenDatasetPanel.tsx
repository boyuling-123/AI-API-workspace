"use client";

import { useMemo, useRef, useState } from "react";
import type {
  EvaluatorRelease,
  EvaluatorVersion,
  GoldenDatasetCase,
  GoldenDatasetVersion,
  GoldenHumanLabel,
  JudgeCalibrationRun,
} from "@/types";
import {
  cloneGoldenDatasetCases,
  createGoldenDatasetVersion,
  isGoldenDatasetVersionIntact,
} from "@/lib/goldenDataset";
import { formatDateTime } from "@/lib/datetime";
import {
  downloadGoldenDatasetTemplate,
  parseGoldenDatasetJsonText,
  parseGoldenDatasetWorkbook,
  type GoldenDatasetImportResult,
} from "@/services/goldenDatasetFile";
import { JudgeCalibrationPanel } from "@/components/calibration/JudgeCalibrationPanel";

const PREVIEW_LIMIT = 50;

interface GoldenDatasetPanelProps {
  projectName: string;
  versions: GoldenDatasetVersion[];
  evaluatorVersions: EvaluatorVersion[];
  judgeModels: { id: string; name: string }[];
  calibrationRuns: JudgeCalibrationRun[];
  evaluatorReleases: EvaluatorRelease[];
  onSave: (version: GoldenDatasetVersion) => void;
  onSaveCalibrationRun: (run: JudgeCalibrationRun) => void;
  onSaveEvaluatorRelease: (release: EvaluatorRelease) => void;
}

function labelText(label: GoldenHumanLabel): string {
  return label === "pass" ? "通过" : "不通过";
}

function nextManualCaseId(cases: GoldenDatasetCase[]): string {
  const used = new Set(cases.map((item) => item.caseId));
  let index = cases.length + 1;
  while (used.has(`case_${String(index).padStart(3, "0")}`)) index += 1;
  return `case_${String(index).padStart(3, "0")}`;
}

export function GoldenDatasetPanel({
  projectName,
  versions,
  evaluatorVersions,
  judgeModels,
  calibrationRuns,
  evaluatorReleases,
  onSave,
  onSaveCalibrationRun,
  onSaveEvaluatorRelease,
}: GoldenDatasetPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const usableVersions = useMemo(
    () =>
      versions
        .filter(isGoldenDatasetVersionIntact)
        .sort((left, right) => left.createTime - right.createTime),
    [versions]
  );
  const corruptCount = versions.length - usableVersions.length;
  const latestVersion = usableVersions.at(-1);
  const [selectedVersionId, setSelectedVersionId] = useState("");
  const selectedVersion =
    usableVersions.find((item) => item.id === selectedVersionId) ??
    latestVersion;
  const [draftDatasetId, setDraftDatasetId] = useState<string | undefined>();
  const [name, setName] = useState("");
  const [createdBy, setCreatedBy] = useState("本地用户");
  const [changeNote, setChangeNote] = useState("");
  const [sourceFileName, setSourceFileName] = useState("");
  const [cases, setCases] = useState<GoldenDatasetCase[]>([]);
  const [importResult, setImportResult] =
    useState<GoldenDatasetImportResult | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const draftFamily = draftDatasetId
    ? usableVersions.filter((item) => item.datasetId === draftDatasetId)
    : [];
  const nextVersion =
    draftFamily.reduce((maximum, item) => Math.max(maximum, item.version), 0) +
    1;
  const hasBlockingImportIssues = (importResult?.issues.length ?? 0) > 0;
  const canPublish =
    Boolean(name.trim()) &&
    Boolean(createdBy.trim()) &&
    cases.length > 0 &&
    !hasBlockingImportIssues &&
    (!draftDatasetId || Boolean(changeNote.trim()));

  function resetDraft() {
    setDraftDatasetId(undefined);
    setName("");
    setChangeNote("");
    setSourceFileName("");
    setCases([]);
    setImportResult(null);
    setMessage("");
    setError("");
  }

  function startFromVersion(version: GoldenDatasetVersion) {
    try {
      setDraftDatasetId(version.datasetId);
      setName(version.name);
      setChangeNote("");
      setSourceFileName(version.sourceFileName ?? "");
      setCases(cloneGoldenDatasetCases(version));
      setImportResult(null);
      setMessage(
        `已复制 ${version.name} v${version.version} 为新草稿；原版本及人工标签保持锁定。`
      );
      setError("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "黄金集版本加载失败");
    }
  }

  async function handleFileChange(
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setError("");
    try {
      const lowerName = file.name.toLowerCase();
      const result =
        lowerName.endsWith(".json") || lowerName.endsWith(".jsonl")
          ? parseGoldenDatasetJsonText(await file.text(), file.name)
          : parseGoldenDatasetWorkbook(await file.arrayBuffer());
      setSourceFileName(file.name);
      setCases(result.cases);
      setImportResult(result);
      setMessage(
        result.issues.length > 0
          ? `识别 ${result.totalRows} 行，其中 ${result.issues.length} 个问题；发布已阻止，请修复源文件后重新导入。`
          : `字段映射确认完成：${result.cases.length} 条有效 Case，可继续人工核对。`
      );
    } catch (caught) {
      setCases([]);
      setImportResult(null);
      setError(caught instanceof Error ? caught.message : "文件解析失败");
    }
  }

  function updateCase(
    caseId: string,
    updater: (item: GoldenDatasetCase) => GoldenDatasetCase
  ) {
    setCases((current) =>
      current.map((item) => (item.caseId === caseId ? updater(item) : item))
    );
    setError("");
  }

  function addCase() {
    if (hasBlockingImportIssues) {
      setError(
        "当前导入仍有阻断问题。请修复源文件后重新导入，或先点击“新建黄金集”清空导入结果。"
      );
      return;
    }
    setCases((current) => [
      ...current,
      {
        caseId: nextManualCaseId(current),
        prompt: "",
        candidateOutput: "",
        humanLabel: "pass",
      },
    ]);
    setImportResult(null);
    setMessage("已新增手工 Case；发布前必须补齐输入和候选输出。");
    setError("");
  }

  function publishVersion() {
    if (!canPublish) return;
    try {
      const version = createGoldenDatasetVersion({
        existingVersions: versions,
        datasetId: draftDatasetId,
        name,
        createdBy,
        changeNote,
        sourceFileName,
        cases,
      });
      onSave(version);
      setSelectedVersionId(version.id);
      setDraftDatasetId(undefined);
      setName("");
      setChangeNote("");
      setSourceFileName("");
      setCases([]);
      setImportResult(null);
      setMessage(
        `${version.name} v${version.version} 已发布并锁定 ${version.cases.length} 条人工标签。`
      );
      setError("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "黄金集发布失败");
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <section aria-label="人工黄金集管理" className="overflow-hidden rounded-2xl border border-blue-200 bg-white shadow-card dark:border-blue-500/20 dark:bg-slate-900">
        <div className="relative border-b border-blue-100 bg-gradient-to-br from-blue-50 via-white to-amber-50 px-6 py-6 dark:border-blue-500/20 dark:from-blue-950/50 dark:via-slate-900 dark:to-amber-950/30">
          <div className="absolute right-7 top-5 h-20 w-20 rounded-full border border-blue-200/70 dark:border-blue-400/20" />
          <div className="absolute right-12 top-10 h-10 w-10 rounded-full bg-amber-300/30 blur-sm dark:bg-amber-400/10" />
          <div className="relative flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-blue-600 dark:text-blue-300">
                Judge calibration asset
              </p>
              <h2 className="mt-2 text-xl font-bold text-slate-900 dark:text-white">
                人工黄金集
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300">
                先把人工真值做成可追溯资产，再用于后续 Judge 一致性校准。导入只解析和预览，不会自动启动评价。
              </p>
            </div>
            <div className="relative flex flex-wrap gap-2">
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">
                本轮 0 次 Judge 调用
              </span>
              <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
                发布后人工标签锁定
              </span>
            </div>
          </div>
        </div>

        <div className="grid gap-5 p-5 lg:grid-cols-[minmax(0,1fr)_280px]">
          <section aria-label="黄金集草稿" className="min-w-0 rounded-xl border border-slate-200 bg-slate-50/60 p-4 dark:border-slate-700 dark:bg-slate-950/40">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="font-semibold text-slate-800 dark:text-slate-100">
                  {draftDatasetId
                    ? `新版本草稿 v${nextVersion}`
                    : "新建黄金集草稿"}
                </h3>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  必填列：Case ID、输入、候选输出、人工标签。
                </p>
              </div>
              <button
                type="button"
                onClick={resetDraft}
                className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300"
              >
                新建黄金集
              </button>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
                黄金集名称
                <input
                  aria-label="黄金集名称"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="例如：电商客服上线黄金集"
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
                />
              </label>
              <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
                标注负责人
                <input
                  aria-label="黄金集标注负责人"
                  value={createdBy}
                  onChange={(event) => setCreatedBy(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
                />
              </label>
            </div>
            {draftDatasetId && (
              <label className="mt-3 block text-xs font-medium text-slate-600 dark:text-slate-300">
                变更说明（追加版本必填）
                <input
                  aria-label="黄金集变更说明"
                  value={changeNote}
                  onChange={(event) => setChangeNote(event.target.value)}
                  placeholder="说明新增、修正或重新标注了哪些 Case"
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
                />
              </label>
            )}

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => downloadGoldenDatasetTemplate(projectName)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
              >
                下载黄金集模板
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700"
              >
                导入 Excel / CSV / JSONL
              </button>
              <button
                type="button"
                onClick={addCase}
                className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300"
              >
                + 手工新增 Case
              </button>
              <input
                ref={fileInputRef}
                aria-label="导入黄金集文件"
                type="file"
                accept=".xlsx,.xls,.csv,.json,.jsonl"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>

            {message && (
              <p className="mt-3 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-700 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-300">
                {message}
              </p>
            )}
            {error && (
              <p role="alert" className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
                {error}
              </p>
            )}

            {importResult && (
              <div aria-label="黄金集字段映射预览" className="mt-4 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
                <div className="flex items-center justify-between gap-3">
                  <h4 className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                    字段映射预览
                  </h4>
                  <span className="text-[11px] text-slate-500">
                    来源：{sourceFileName}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {importResult.mappings.map((mapping) => (
                    <span
                      key={mapping.field}
                      className={`rounded-md border px-2 py-1 text-[11px] ${
                        mapping.sourceColumn
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300"
                          : mapping.required
                            ? "border-red-200 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300"
                            : "border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-700 dark:bg-slate-800"
                      }`}
                    >
                      {mapping.label} ← {mapping.sourceColumn ?? "未映射"}
                    </span>
                  ))}
                </div>
                {importResult.unmappedColumns.length > 0 && (
                  <p className="mt-2 text-[11px] text-amber-700 dark:text-amber-300">
                    未使用列：{importResult.unmappedColumns.join("、")}
                  </p>
                )}
              </div>
            )}

            {(importResult?.issues.length ?? 0) > 0 && (
              <div role="alert" aria-label="黄金集导入问题" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 dark:border-red-500/30 dark:bg-red-500/10">
                <h4 className="text-xs font-semibold text-red-800 dark:text-red-200">
                  发现 {importResult!.issues.length} 个阻断问题
                </h4>
                <ul className="mt-2 space-y-1 text-xs text-red-700 dark:text-red-300">
                  {importResult!.issues.slice(0, 8).map((issue, index) => (
                    <li key={`${issue.rowNumber}-${issue.field}-${index}`}>
                      第 {issue.rowNumber} 行：{issue.message}
                    </li>
                  ))}
                </ul>
                {importResult!.issues.length > 8 && (
                  <p className="mt-2 text-xs text-red-600">
                    另有 {importResult!.issues.length - 8} 个问题，请修复源文件后重新导入。
                  </p>
                )}
              </div>
            )}

            <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
              <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2 dark:border-slate-700">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                  人工真值草稿
                </span>
                <span className="text-xs text-slate-500">
                  {cases.length} 条{cases.length > PREVIEW_LIMIT ? `，仅展示前 ${PREVIEW_LIMIT} 条` : ""}
                </span>
              </div>
              {cases.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-slate-600 dark:text-slate-300">
                  下载模板后导入，或手工新增 Case。平台不会猜测缺失字段。
                </p>
              ) : (
                <table className="min-w-[920px] w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 dark:bg-slate-800/70 dark:text-slate-400">
                    <tr>
                      <th className="px-3 py-2">Case ID</th>
                      <th className="px-3 py-2">输入</th>
                      <th className="px-3 py-2">候选输出</th>
                      <th className="px-3 py-2">人工标签</th>
                      <th className="px-3 py-2">分数</th>
                      <th className="px-3 py-2">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cases.slice(0, PREVIEW_LIMIT).map((item) => (
                      <tr key={item.caseId} className="border-t border-slate-100 align-top dark:border-slate-800">
                        <td className="px-3 py-2 font-mono text-slate-600 dark:text-slate-300">
                          {item.caseId}
                        </td>
                        <td className="px-3 py-2">
                          <textarea
                            aria-label={`输入 ${item.caseId}`}
                            value={item.prompt}
                            onChange={(event) =>
                              updateCase(item.caseId, (current) => ({
                                ...current,
                                prompt: event.target.value,
                              }))
                            }
                            rows={2}
                            className="w-52 resize-y rounded border border-slate-200 px-2 py-1 text-slate-800 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <textarea
                            aria-label={`候选输出 ${item.caseId}`}
                            value={item.candidateOutput}
                            onChange={(event) =>
                              updateCase(item.caseId, (current) => ({
                                ...current,
                                candidateOutput: event.target.value,
                              }))
                            }
                            rows={2}
                            className="w-52 resize-y rounded border border-slate-200 px-2 py-1 text-slate-800 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <select
                            aria-label={`人工标签 ${item.caseId}`}
                            value={item.humanLabel}
                            onChange={(event) =>
                              updateCase(item.caseId, (current) => ({
                                ...current,
                                humanLabel: event.target.value as GoldenHumanLabel,
                              }))
                            }
                            className="rounded border border-slate-200 bg-white px-2 py-1 text-slate-800 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
                          >
                            <option value="pass">通过</option>
                            <option value="fail">不通过</option>
                          </select>
                        </td>
                        <td className="px-3 py-2">
                          <input
                            aria-label={`人工分数 ${item.caseId}`}
                            type="number"
                            min={0}
                            max={10}
                            step={0.1}
                            value={item.humanScore ?? ""}
                            onChange={(event) =>
                              updateCase(item.caseId, (current) => ({
                                ...current,
                                humanScore: event.target.value
                                  ? Number(event.target.value)
                                  : undefined,
                              }))
                            }
                            className="w-16 rounded border border-slate-200 px-2 py-1 text-slate-800 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <button
                            type="button"
                            onClick={() =>
                              setCases((current) =>
                                current.filter((candidate) => candidate.caseId !== item.caseId)
                              )
                            }
                            className="text-red-600 hover:underline dark:text-red-400"
                          >
                            删除
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-500/30 dark:bg-amber-500/10">
              <p className="text-xs leading-5 text-amber-800 dark:text-amber-200">
                发布仅保存人工真值快照，不运行 Judge。发布后不能覆盖，只能追加新版本。
              </p>
              <button
                type="button"
                disabled={!canPublish}
                onClick={publishVersion}
                className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                发布并锁定 v{nextVersion}
              </button>
            </div>
          </section>

          <aside aria-label="黄金集版本库" className="rounded-xl border border-slate-200 bg-slate-950 p-4 text-slate-100 dark:border-slate-700">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-mono text-sm font-semibold">版本库</h3>
              <span className="rounded-full bg-white/10 px-2 py-1 text-[11px] text-slate-300">
                {usableVersions.length} 个版本
              </span>
            </div>
            <label className="mt-4 block text-xs text-slate-400">
              查看黄金集版本
              <select
                aria-label="查看黄金集版本"
                value={selectedVersion?.id ?? ""}
                onChange={(event) => setSelectedVersionId(event.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
              >
                {usableVersions.length === 0 && <option value="">暂无版本</option>}
                {usableVersions.map((version) => (
                  <option key={version.id} value={version.id}>
                    {version.name} v{version.version}
                  </option>
                ))}
              </select>
            </label>

            {selectedVersion ? (
              <div aria-label="已锁定黄金集版本" className="mt-4 space-y-4">
                <div className="rounded-xl border border-slate-700 bg-slate-900 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold text-white">
                      {selectedVersion.name} v{selectedVersion.version}
                    </p>
                    <span className="rounded-full bg-emerald-400/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
                      标签已锁定
                    </span>
                  </div>
                  <dl className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
                    <div>
                      <dt className="text-slate-400">Case</dt>
                      <dd className="mt-0.5 font-semibold text-slate-200">
                        {selectedVersion.cases.length} 条
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-400">负责人</dt>
                      <dd className="mt-0.5 font-semibold text-slate-200">
                        {selectedVersion.createdBy}
                      </dd>
                    </div>
                    <div className="col-span-2">
                      <dt className="text-slate-400">发布时间</dt>
                      <dd className="mt-0.5 text-slate-300">
                        {formatDateTime(selectedVersion.createTime)}
                      </dd>
                    </div>
                  </dl>
                  {selectedVersion.changeNote && (
                    <p className="mt-3 border-t border-slate-700 pt-3 text-xs leading-5 text-slate-300">
                      {selectedVersion.changeNote}
                    </p>
                  )}
                </div>

                <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                  {selectedVersion.cases.slice(0, 20).map((item) => (
                    <div key={item.caseId} className="rounded-lg border border-slate-800 bg-slate-900/70 px-3 py-2 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-slate-300">{item.caseId}</span>
                        <span className={item.humanLabel === "pass" ? "text-emerald-300" : "text-red-300"}>
                          {labelText(item.humanLabel)}
                        </span>
                      </div>
                      <p className="mt-1 line-clamp-2 text-slate-400">
                        {item.prompt}
                      </p>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => startFromVersion(selectedVersion)}
                  className="w-full rounded-lg border border-blue-400/40 bg-blue-400/10 px-3 py-2 text-sm font-semibold text-blue-200 hover:bg-blue-400/20"
                >
                  基于 v{selectedVersion.version} 创建新版本
                </button>
              </div>
            ) : (
              <p className="mt-8 text-center text-sm leading-6 text-slate-500">
                暂无已发布黄金集。完成左侧字段确认后发布 v1。
              </p>
            )}
            {corruptCount > 0 && (
              <p role="alert" className="mt-4 rounded-lg border border-red-400/30 bg-red-400/10 px-3 py-2 text-xs text-red-200">
                {corruptCount} 个版本未通过完整性校验，已禁止加载。
              </p>
            )}
          </aside>
        </div>
      </section>
      <JudgeCalibrationPanel
        versions={versions}
        evaluatorVersions={evaluatorVersions}
        judgeModels={judgeModels}
        runs={calibrationRuns}
        releases={evaluatorReleases}
        onSaveRun={onSaveCalibrationRun}
        onSaveRelease={onSaveEvaluatorRelease}
      />
    </div>
  );
}
