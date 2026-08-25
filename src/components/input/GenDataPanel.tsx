"use client";

import { useRef, useState } from "react";
import type { ContentMode, GenDataRequest, TaskInput } from "@/types";
import { generateTaskData } from "@/services/genDataClient";
import { exportInputsToExcel } from "@/services/excel";
import { DEFAULT_JUDGE_TARGET_ID } from "@/config/presetTargets";

const MAX_TOTAL_COUNT = 3000;
const GENERATE_CHUNK_SIZE = 30;
const MAX_CHUNK_RETRIES = 3;

interface GenDataPanelProps {
  /** 项目名，用于「下载数据」命名导出文件。 */
  projectName: string;
  contentMode: ContentMode;
  /** 当前目标所需列（prompt/image_url/各参数名），作为约束传给 AI。 */
  targetColumns: string[];
  /** 当前批量输入区里的完整数据，可能来自 AI 生成、手动录入或外部导入。 */
  currentInputs: TaskInput[];
  /** 造数据模型 id，默认走预置默认裁判模型。 */
  modelId?: string;
  /** 生成成功后回调：append 追加到现有批量数据，replace 覆盖。 */
  onGenerated: (
    items: TaskInput[],
    mode: "append" | "replace",
    options?: { focus?: "first" | "last" | "keep"; message?: string }
  ) => void;
}

type Shape = GenDataRequest["shape"];

interface ResumeDraft {
  totalCount: number;
  generatedCount: number;
  requirement: string;
  contentMode: ContentMode;
  targetColumnsKey: string;
  items: TaskInput[];
}

type PauseIntent = "keep" | "discard" | null;

/**
 * AI 造数据面板（M10）：两形式（造一条 / 造批量数据），
 * 调用 /api/gen-data 生成 TaskInput[] 灌入批量输入区，并支持下载当前批量数据。
 */
export function GenDataPanel({
  projectName,
  contentMode,
  targetColumns,
  currentInputs,
  modelId,
  onGenerated,
}: GenDataPanelProps) {
  const [open, setOpen] = useState(false);
  const [shape, setShape] = useState<Shape>("batch");
  const [count, setCount] = useState(5);
  const [requirement, setRequirement] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progressText, setProgressText] = useState<string | null>(null);
  const [resumeDraft, setResumeDraft] = useState<ResumeDraft | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const generatedItemsRef = useRef<TaskInput[]>([]);
  const preRunInputsRef = useRef<TaskInput[]>([]);
  const runMetaRef = useRef<ResumeDraft | null>(null);
  const pauseIntentRef = useRef<PauseIntent>(null);

  const usedModelId = modelId ?? DEFAULT_JUDGE_TARGET_ID;
  const trimmedRequirement = requirement.trim();
  const targetColumnsKey = targetColumns.join("\u0001");
  const canResume = Boolean(
    resumeDraft &&
      shape === "batch" &&
      resumeDraft.requirement === trimmedRequirement &&
      resumeDraft.contentMode === contentMode &&
      resumeDraft.targetColumnsKey === targetColumnsKey &&
      resumeDraft.totalCount === clampCount(count) &&
      resumeDraft.generatedCount > 0 &&
      resumeDraft.generatedCount < resumeDraft.totalCount
  );
  const resumeRemaining = canResume && resumeDraft
    ? resumeDraft.totalCount - resumeDraft.generatedCount
    : 0;

  async function handleGenerate() {
    if (!trimmedRequirement) {
      setError("请先描述要生成什么数据");
      return;
    }
    setLoading(true);
    setError(null);
    setProgressText(null);
    pauseIntentRef.current = null;
    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    try {
      const totalCount = canResume && resumeDraft
        ? resumeDraft.totalCount
        : shape === "one"
          ? 1
          : clampCount(count);
      const resumeItems = canResume && resumeDraft
        ? getResumeItems(resumeDraft)
        : [];
      const isLargeBatch =
        shape === "batch" && totalCount > GENERATE_CHUNK_SIZE;

      preRunInputsRef.current = canResume ? resumeItems : currentInputs;
      generatedItemsRef.current = resumeItems;
      runMetaRef.current = {
        totalCount,
        generatedCount: resumeItems.length,
        requirement: trimmedRequirement,
        contentMode,
        targetColumnsKey,
        items: resumeItems,
      };

      if (canResume && resumeItems.length > 0) {
        onGenerated(resumeItems, "replace", {
          focus: "last",
          message: `AI 造数据：继续生成前已保留 ${resumeItems.length} 条`,
        });
      }

      const items = isLargeBatch
        ? await generateLargeBatch(
            totalCount,
            abortController.signal,
            resumeItems
          )
        : await generateTaskData(
            {
              contentMode,
              shape,
              count: totalCount,
              requirement: trimmedRequirement,
              targetColumns,
            },
            usedModelId,
            abortController.signal
          );
      if (!isLargeBatch) {
        onGenerated(items, shape === "one" ? "append" : "replace", {
          focus: shape === "one" ? "last" : "first",
        });
      }
      setError(null);
      if (abortController.signal.aborted) {
        handlePausedRunFinalState();
      } else {
        setResumeDraft(null);
        setProgressText(
          shape === "one"
            ? "已生成 1 条"
            : `已分批生成 ${items.length} / ${totalCount} 条`
        );
      }
    } catch (err) {
      if (abortController.signal.aborted) {
        setError(null);
        handlePausedRunFinalState();
      } else {
        setError(err instanceof Error ? err.message : "造数据失败");
      }
    } finally {
      setLoading(false);
      if (abortControllerRef.current === abortController) {
        abortControllerRef.current = null;
      }
      runMetaRef.current = null;
      pauseIntentRef.current = null;
    }
  }

  function handlePauseGenerate() {
    const meta = runMetaRef.current;
    const generatedCount = generatedItemsRef.current.length;
    let intent: PauseIntent = "keep";

    if (meta && meta.totalCount > 100) {
      const keep = window.confirm(
        `当前已生成 ${generatedCount} / ${meta.totalCount} 条。是否保留现在已生成的数据？

确定：保留已生成数据，下次继续只跑剩余数据。
取消：丢弃本次已生成数据，并恢复到生成前的数据。`
      );
      intent = keep ? "keep" : "discard";
    }

    pauseIntentRef.current = intent;
    abortControllerRef.current?.abort();
    setProgressText(
      intent === "keep"
        ? "正在暂停生成，已生成的数据会保留..."
        : "正在停止生成，并恢复到生成前的数据..."
    );
  }

  function getResumeItems(draft: ResumeDraft): TaskInput[] {
    if (currentInputs.length >= draft.generatedCount) {
      return currentInputs.slice(0, draft.generatedCount);
    }
    return draft.items.slice(0, draft.generatedCount);
  }

  function handlePausedRunFinalState() {
    const meta = runMetaRef.current;
    const generatedItems = generatedItemsRef.current;

    if (pauseIntentRef.current === "discard") {
      onGenerated(preRunInputsRef.current, "replace", {
        focus: "first",
        message: "AI 造数据：已放弃本次生成，已恢复生成前数据",
      });
      setResumeDraft(null);
      setProgressText("已停止生成，并恢复到生成前的数据。");
      return;
    }

    if (meta && generatedItems.length > 0 && generatedItems.length < meta.totalCount) {
      const keptItems = generatedItems.slice(0, generatedItems.length);
      onGenerated(keptItems, "replace", {
        focus: "last",
        message: `AI 造数据：已暂停并保留 ${keptItems.length} 条`,
      });
      setResumeDraft({
        ...meta,
        generatedCount: keptItems.length,
        items: keptItems,
      });
      setProgressText(
        `已暂停生成，已保留 ${generatedItems.length} / ${meta.totalCount} 条。下次点击继续时只生成剩余 ${meta.totalCount - generatedItems.length} 条。`
      );
      return;
    }

    setResumeDraft(null);
    setProgressText("已暂停生成，当前没有可续跑的数据。");
  }

  function handleDownload() {
    if (currentInputs.length === 0) {
      return;
    }
    exportInputsToExcel(projectName, currentInputs, "当前数据");
  }

  function handleClearCurrentData() {
    if (currentInputs.length === 0) {
      return;
    }
    const confirmed = window.confirm(
      `确定清空当前 ${currentInputs.length} 条数据吗？清空后会同时取消本次 AI 造数据的续跑记录。`
    );
    if (!confirmed) {
      return;
    }
    setResumeDraft(null);
    setError(null);
    setProgressText("已清空当前数据。");
    generatedItemsRef.current = [];
    preRunInputsRef.current = [];
    runMetaRef.current = null;
    pauseIntentRef.current = null;
    onGenerated([], "replace", {
      focus: "first",
      message: "已清空当前数据",
    });
  }

  async function generateLargeBatch(
    totalCount: number,
    signal: AbortSignal,
    seedItems: TaskInput[] = []
  ): Promise<TaskInput[]> {
    const batches = Math.ceil(totalCount / GENERATE_CHUNK_SIZE);
    const allItems: TaskInput[] = [...seedItems];
    generatedItemsRef.current = allItems;

    for (
      let batchIndex = Math.floor(allItems.length / GENERATE_CHUNK_SIZE);
      batchIndex < batches;
      batchIndex += 1
    ) {
      if (signal.aborted) {
        break;
      }
      const done = allItems.length;
      const remaining = totalCount - done;
      const chunkCount = Math.min(GENERATE_CHUNK_SIZE, remaining);
      setProgressText(
        `正在生成第 ${batchIndex + 1} / ${batches} 批，已完成 ${done} / ${totalCount} 条`
      );

      const batchItems = await generateChunkWithRetry({
        totalCount,
        batchIndex,
        batches,
        chunkCount,
        signal,
      });
      allItems.push(...batchItems.slice(0, chunkCount));
      generatedItemsRef.current = allItems.slice(0, totalCount);
      if (runMetaRef.current) {
        runMetaRef.current.generatedCount = generatedItemsRef.current.length;
        runMetaRef.current.items = generatedItemsRef.current;
      }
      onGenerated(generatedItemsRef.current, "replace", {
        focus: "last",
        message: `AI 造数据：已写入 ${generatedItemsRef.current.length} 条`,
      });
      setProgressText(
        `正在生成第 ${batchIndex + 1} / ${batches} 批，已写入 ${allItems.length} / ${totalCount} 条`
      );
    }

    return allItems.slice(0, totalCount);
  }

  async function generateChunkWithRetry({
    totalCount,
    batchIndex,
    batches,
    chunkCount,
    signal,
  }: {
    totalCount: number;
    batchIndex: number;
    batches: number;
    chunkCount: number;
    signal: AbortSignal;
  }): Promise<TaskInput[]> {
    let lastError: unknown = null;

    for (let attempt = 1; attempt <= MAX_CHUNK_RETRIES; attempt += 1) {
      if (signal.aborted) {
        return [];
      }
      try {
        const batchRequirement = [
          requirement.trim(),
          "",
          `这是一个大批量生成任务：总共需要 ${totalCount} 条数据。`,
          `当前是第 ${batchIndex + 1} 批，共 ${batches} 批，本批生成 ${chunkCount} 条。`,
          `这是本批第 ${attempt} 次生成尝试。`,
          "请让本批样本覆盖新的表达方式、难度和场景，不要和前面批次重复。",
        ].join("\n");

        const items = await generateTaskData(
          {
            contentMode,
            shape: "batch",
            count: chunkCount,
            requirement: batchRequirement,
            targetColumns,
          },
          usedModelId,
          signal
        );

        if (items.length >= chunkCount) {
          return items.slice(0, chunkCount);
        }
        lastError = new Error(
          `模型只返回 ${items.length} 条，少于本批需要的 ${chunkCount} 条`
        );
      } catch (err) {
        lastError = err;
      }
    }

    const message =
      lastError instanceof Error ? lastError.message : "未知错误";
    throw new Error(
      `第 ${batchIndex + 1} / ${batches} 批生成失败，已重试 ${MAX_CHUNK_RETRIES} 次：${message}`
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md border border-indigo-300 bg-indigo-50 px-3 py-1.5 text-sm text-indigo-700 transition hover:bg-indigo-100"
      >
        ✨ AI 造数据
      </button>
    );
  }

  return (
    <div className="w-full rounded-lg border border-indigo-200 bg-indigo-50/40 p-4">
      <div className="mb-3 flex items-center gap-2">
        <h3 className="text-sm font-semibold text-indigo-700">AI 造数据</h3>
        <span className="text-xs text-slate-400">
          AI 按需求生成测评输入（{contentMode === "image" ? "图生成类" : "文生成类"}）
        </span>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="ml-auto text-xs text-slate-500 hover:underline"
        >
          收起
        </button>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-slate-600">生成形式</span>
        <ShapeButton active={shape === "one"} onClick={() => setShape("one")}>
          造一条
        </ShapeButton>
        <ShapeButton
          active={shape === "batch"}
          onClick={() => setShape("batch")}
        >
          造批量数据
        </ShapeButton>
        {shape !== "one" && (
          <label className="ml-2 flex items-center gap-1 text-xs text-slate-600">
            条数
            <input
              type="number"
              min={1}
              max={MAX_TOTAL_COUNT}
              value={count}
              onChange={(e) => setCount(clampCount(Number(e.target.value)))}
              className="w-20 rounded border border-slate-300 px-2 py-1 text-xs"
            />
          </label>
        )}
      </div>

      {targetColumns.length > 0 && (
        <p className="mb-2 text-[11px] text-slate-500">
          将按目标所需列生成：{targetColumns.join("、")}
        </p>
      )}
      {shape === "batch" && count > GENERATE_CHUNK_SIZE && (
        <p className="mb-2 text-[11px] text-indigo-600">
          大批量会自动拆成每批 {GENERATE_CHUNK_SIZE} 条生成，避免模型输出过长导致 JSON 截断。
        </p>
      )}

      <textarea
        value={requirement}
        onChange={(e) => setRequirement(e.target.value)}
        rows={3}
        placeholder="描述你想要的测评数据，例如：生成 5 条电商女装商品文案的测评提示词，覆盖连衣裙、外套、裤装等品类，风格多样。"
        className="mb-3 w-full resize-y rounded-md border border-slate-300 px-3 py-2 text-sm"
      />

      {error && <p className="mb-2 text-xs text-red-600">{error}</p>}
      {progressText && (
        <p className="mb-2 text-xs text-indigo-600">{progressText}</p>
      )}
      {canResume && !loading && resumeDraft && (
        <p className="mb-2 text-xs text-amber-600">
          已保留 {resumeDraft.generatedCount} / {resumeDraft.totalCount} 条，
          可继续生成剩余 {resumeRemaining} 条。修改需求或字段后会重新开始。
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={handleGenerate}
          disabled={loading}
          className="rounded-md bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:opacity-50"
        >
          {loading
            ? "分批生成中…"
            : canResume
              ? `继续生成剩余 ${resumeRemaining} 条`
              : "生成数据"}
        </button>
        {loading && (
          <button
            type="button"
            onClick={handlePauseGenerate}
            className="rounded-md border border-red-300 bg-white px-4 py-1.5 text-sm font-medium text-red-600 transition hover:bg-red-50"
          >
            暂停生成
          </button>
        )}
        <span className="text-[11px] text-slate-400">
          {shape === "one" ? "造一条会追加到现有数据" : "造批量数据会覆盖现有数据"}
        </span>
        <button
          type="button"
          onClick={handleDownload}
          disabled={currentInputs.length === 0}
          className="ml-auto rounded-md border border-indigo-300 bg-white px-4 py-1.5 text-sm font-medium text-indigo-700 transition hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          ⬇ 下载当前数据（{currentInputs.length} 条 Excel）
        </button>
        <button
          type="button"
          onClick={handleClearCurrentData}
          disabled={loading || currentInputs.length === 0}
          className="rounded-md border border-red-200 bg-white px-4 py-1.5 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          清空当前数据
        </button>
      </div>
    </div>
  );
}

function clampCount(value: number): number {
  if (!Number.isFinite(value)) {
    return 1;
  }
  return Math.min(Math.max(Math.floor(value), 1), MAX_TOTAL_COUNT);
}

function ShapeButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md px-3 py-1 text-xs font-medium transition ${
        active
          ? "bg-indigo-600 text-white"
          : "border border-slate-300 text-slate-600 hover:bg-slate-50"
      }`}
    >
      {children}
    </button>
  );
}
