"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  CalibrationReviewEvent,
  EvaluationReviewEvent,
  EvaluatorRelease,
  EvaluatorVersion,
  GoldenDatasetVersion,
  JudgeCalibrationRun,
  Project,
  Task,
  TargetConfig,
  TaskRerun,
} from "@/types";
import type { EvaluationRecord } from "@/types";
import { useInputDraft } from "@/hooks/useInputDraft";
import { useTargetSelection } from "@/hooks/useTargetSelection";
import { useTaskRunner } from "@/hooks/useTaskRunner";
import type { ProjectUpdateOptions } from "@/hooks/useProject";
import { useEvaluation } from "@/hooks/useEvaluation";
import type {
  EvaluationCompletePayload,
  NewDimensionEvaluationContext,
} from "@/components/evaluation/EvaluationPanel";
import { EvalHistoryPanel } from "@/components/evaluation/EvalHistoryPanel";
import { computeInputImageState } from "@/lib/inputImageState";
import { generateId } from "@/lib/id";
import { formatDateTime } from "@/lib/datetime";
import { InputArea } from "@/components/input/InputArea";
import { AlgoParamsInput } from "@/components/input/AlgoParamsInput";
import { TargetSelector } from "@/components/TargetSelector";
import { ApiAccessPanel } from "@/components/api/ApiAccessPanel";
import { ExternalApiCapabilities } from "@/components/api/ExternalApiCapabilities";
import { RunPanel } from "@/components/run/RunPanel";
import { ResultArea } from "@/components/result/ResultArea";
import { EvaluationPanel } from "@/components/evaluation/EvaluationPanel";
import { HistoryPanel } from "@/components/history/HistoryPanel";
import { GoldenDatasetPanel } from "@/components/calibration/GoldenDatasetPanel";
import { PlatformOverview } from "@/components/overview/PlatformOverview";
import { AppTabs } from "@/components/layout/AppTabs";
import { RUNTIME_CONFIG } from "@/config/runtime";
import { targetSupportsImage } from "@/config/presetTargets";
import {
  collectEvaluationLineageDimensions,
  getEvaluationRootId,
} from "@/lib/newDimensionEvaluation";

// 7 板块导航：跑批保持默认入口，总览负责解释完整链路与真实能力边界。
// 评价入口只在 ③→④（结果区进入），不在跑批板块；⑤ 为历史仓库可随便进。
type WorkspaceTab =
  | "run"
  | "overview"
  | "access"
  | "result"
  | "evaluate"
  | "evalHistory"
  | "calibration";

interface WorkspaceBodyProps {
  project: Project;
  updateProject: (
    updater: (current: Project) => Project,
    options?: ProjectUpdateOptions
  ) => void;
}

export function WorkspaceBody({ project, updateProject }: WorkspaceBodyProps) {
  const draft = useInputDraft(project.id);
  const { setContentMode, setRunMode } = draft;
  const { targetIds, setTargetIds } = useTargetSelection(project.id);
  const [viewingTask, setViewingTask] = useState<Task | null>(null);
  // 需求二：AI 评价数据源洁癖——仅当从③带入批次时有值，离开板块④即清空。
  const [evaluatingTask, setEvaluatingTask] = useState<Task | null>(null);
  const [newDimensionContext, setNewDimensionContext] =
    useState<NewDimensionEvaluationContext | null>(null);
  const [activeTab, setActiveTab] = useState<WorkspaceTab>("run");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get("tab");
    const contentMode = params.get("content_mode");
    if (
      tab === "run" ||
      tab === "overview" ||
      tab === "access" ||
      tab === "result" ||
      tab === "evaluate" ||
      tab === "evalHistory" ||
      tab === "calibration"
    ) {
      setActiveTab(tab);
    }
    if (params.get("draft_id") || params.get("import_id")) {
      setRunMode("batch");
      if (contentMode === "text" || contentMode === "image") {
        setContentMode(contentMode);
      }
    }
  }, [setContentMode, setRunMode]);
  const handleBatchSnapshot = useCallback(
    (task: Task) => {
      updateProject(
        (current) => ({
          ...current,
          tasks: current.tasks.some((item) => item.id === task.id)
            ? current.tasks.map((item) => (item.id === task.id ? task : item))
            : [...current.tasks, task],
        }),
        { immediate: true }
      );
    },
    [updateProject]
  );

  // 兜底：极端情况下（脏数据 / 迁移中途）targetConfigs 可能缺失，避免渲染崩溃。
  const algoConfigs = useMemo(
    () => project.targetConfigs ?? [],
    [project.targetConfigs]
  );

  const handleApiConfigsChange = useCallback(
    (configs: TargetConfig[]) => {
      updateProject((current) => ({ ...current, targetConfigs: configs }));
    },
    [updateProject]
  );

  const selectedAlgoConfigs = useMemo(
    () => algoConfigs.filter((config) => targetIds.includes(config.id)),
    [algoConfigs, targetIds]
  );

  // 选中目标所需列（去重）：prompt + 各目标入参名，作为 AI 造数据的列约束。
  const targetColumns = useMemo(() => {
    const columns = new Set<string>(["prompt"]);
    for (const config of selectedAlgoConfigs) {
      for (const param of config.inputParams) {
        if (param.name) columns.add(param.name);
      }
    }
    return Array.from(columns);
  }, [selectedAlgoConfigs]);

  // 可作裁判的目标：出文字的目标（text / multimodal）。
  // supportsImage（能否当含图裁判）= 仅 multimodal，由 targetSupportsImage 判断。
  const judgeModels = useMemo(
    () =>
      algoConfigs
        .filter((config) => config.contentKind === "text" || config.contentKind === "multimodal")
        .map((config) => ({
          id: config.id,
          name: config.name,
          supportsImage: targetSupportsImage(config),
        })),
    [algoConfigs]
  );

  const runner = useTaskRunner({
    onBatchSnapshot: handleBatchSnapshot,
    targetConfigs: algoConfigs,
  });
  const runRerun = runner.runRerun;

  const resumableTask = useMemo(
    () =>
      [...project.tasks]
        .filter(
          (task) => task.status === "paused" || task.status === "running"
        )
        .sort((a, b) => b.createTime - a.createTime)[0] ?? null,
    [project.tasks]
  );

  const availableRerunTargets = useMemo(
    () =>
      algoConfigs
        .filter((config) => config.preset || config.status === "tested_ok"),
    [algoConfigs]
  );

  const rerunBlockedReason = useMemo(() => {
    if (runner.runStatus === "running") {
      return "当前有任务正在运行，请等待完成或先暂停";
    }
    if (resumableTask) {
      return "当前有待继续的任务，请先继续或放弃该任务";
    }
    return undefined;
  }, [resumableTask, runner.runStatus]);

  const handleAbandonBatch = useCallback(
    (task: Task) => {
      updateProject(
        (current) => ({
          ...current,
          tasks: current.tasks.map((item) =>
            item.id === task.id
              ? { ...item, status: "cancelled", finishTime: Date.now() }
              : item
          ),
        }),
        { immediate: true }
      );
    },
    [updateProject]
  );

  const evaluation = useEvaluation();
  const clearEvaluation = evaluation.clear;

  const currentInputs = useMemo(
    () =>
      draft.mode === "single" ? [draft.singleInput] : draft.batchInputs,
    [draft.mode, draft.singleInput, draft.batchInputs]
  );

  const imageState = useMemo(
    () => computeInputImageState(currentInputs),
    [currentInputs]
  );

  const handleDeleteTask = useCallback(
    (taskId: string) => {
      setViewingTask((current) =>
        current?.id === taskId ? null : current
      );
      setEvaluatingTask((current) =>
        current?.id === taskId ? null : current
      );
      if (evaluatingTask?.id === taskId) {
        setNewDimensionContext(null);
        clearEvaluation();
      }
      updateProject((current) => ({
        ...current,
        tasks: current.tasks.filter((task) => task.id !== taskId),
      }));
    },
    [clearEvaluation, evaluatingTask?.id, updateProject]
  );

  // 需求三：结果对比区只展示「被选中的历史批次」，默认空。
  const evaluatingImageState = useMemo(
    () =>
      evaluatingTask
        ? computeInputImageState(evaluatingTask.inputs)
        : { hasImage: false, hasBase64Image: false },
    [evaluatingTask]
  );

  // 需求二+四：离开板块④清空评测批次；切到结果板块外清空查看批次。
  const handleTabChange = useCallback(
    (next: WorkspaceTab) => {
      if (activeTab === "evaluate" && next !== "evaluate") {
        setEvaluatingTask(null);
        setNewDimensionContext(null);
        clearEvaluation();
      }
      if (activeTab === "result" && next !== "result") {
        setViewingTask(null);
      }
      setActiveTab(next);
    },
    [activeTab, clearEvaluation]
  );

  // 需求三：点击历史某条 → 下方展开该批次结果对比。
  const handleViewTask = useCallback((task: Task) => {
    setViewingTask((current) => (current?.id === task.id ? null : task));
  }, []);

  // 需求二：从③某批次「去AI评测」→ 携带批次跳板块④。
  const handleEvaluateTask = useCallback((task: Task) => {
    clearEvaluation();
    setNewDimensionContext(null);
    setEvaluatingTask(task);
    setActiveTab("evaluate");
  }, [clearEvaluation]);

  const handleAddEvaluationDimensions = useCallback(
    (record: EvaluationRecord, task: Task) => {
      const evaluations = project.evaluations ?? [];
      clearEvaluation();
      setNewDimensionContext({
        sourceEvaluationId: getEvaluationRootId(record),
        sourceInputIds: record.results.map((result) => result.inputId),
        existingDimensions: collectEvaluationLineageDimensions(
          evaluations,
          record
        ),
        evalModelId: record.evalModelId,
        userRequirement: record.userRequirement,
        evalPrompt: record.evalPrompt,
        evaluationMode: record.evaluationMode ?? "comparison",
        expectedAnswerColumn: record.expectedAnswerColumn,
      });
      setEvaluatingTask(task);
      setActiveTab("evaluate");
    },
    [clearEvaluation, project.evaluations]
  );

  const handleRerunTask = useCallback(
    (sourceTask: Task, rerun: TaskRerun) => {
      setViewingTask(null);
      setEvaluatingTask(null);
      setNewDimensionContext(null);
      clearEvaluation();
      setActiveTab("run");
      runRerun(sourceTask, rerun);
    },
    [clearEvaluation, runRerun]
  );

  // v4.3 增量2：一次评价跑完 → 生成 EvaluationRecord 存入 Project.evaluations（唯一权威来源，⑤只读这里）。
  const handleEvaluationComplete = useCallback(
    (payload: EvaluationCompletePayload) => {
      const sourceTask = evaluatingTask;
      if (!sourceTask) return;

      // scores 补 targetName：从批次结果里按 targetId 找展示名，回退 targetId。
      const targetNameById = new Map<string, string>();
      for (const row of sourceTask.results) {
        for (const item of row.items) {
          if (item.targetName) targetNameById.set(item.targetId, item.targetName);
        }
      }

      const record: EvaluationRecord = {
        id: generateId(),
        sourceTaskId: sourceTask.id,
        evaluationKind: payload.evaluationKind,
        sourceEvaluationId: payload.sourceEvaluationId,
        createTime: Date.now(),
        evalModelId: payload.evalModelId,
        userRequirement: payload.userRequirement,
        dimensions: payload.dimensions,
        evalPrompt: payload.evalPrompt,
        scope: payload.scope,
        selectedInputIds: payload.selectedInputIds,
        count: payload.results.length,
        status: "done",
        evaluationMode: payload.evaluationMode,
        expectedAnswerColumn: payload.expectedAnswerColumn,
        evaluatorVersionId: payload.evaluatorVersionId,
        results: payload.results.map((item) => ({
          inputId: item.inputId,
          scores: item.scores.map((score) => ({
            targetId: score.targetId,
            targetName: targetNameById.get(score.targetId) ?? score.targetId,
            dimensionScores: score.dimensionScores,
            weightedScore: score.weightedScore,
            vetoed: score.vetoed,
            vetoReasons: score.vetoReasons,
            overallComment: score.overallComment,
          })),
          summary: item.summary,
          recommendation: item.recommendation,
        })),
      };

      updateProject((current) => ({
        ...current,
        evaluations: [...(current.evaluations ?? []), record],
      }));
    },
    [evaluatingTask, updateProject]
  );

  const handleSaveEvaluatorVersion = useCallback(
    (version: EvaluatorVersion) => {
      updateProject(
        (current) => {
          const existing = current.evaluatorVersions ?? [];
          if (existing.some((item) => item.id === version.id)) return current;
          return {
            ...current,
            evaluatorVersions: [...existing, version],
          };
        },
        { immediate: true }
      );
    },
    [updateProject]
  );

  const handleSaveGoldenDatasetVersion = useCallback(
    (version: GoldenDatasetVersion) => {
      updateProject(
        (current) => {
          const existing = current.goldenDatasetVersions ?? [];
          if (existing.some((item) => item.id === version.id)) return current;
          return {
            ...current,
            goldenDatasetVersions: [...existing, version],
          };
        },
        { immediate: true }
      );
    },
    [updateProject]
  );

  const handleSaveJudgeCalibrationRun = useCallback(
    (run: JudgeCalibrationRun) => {
      updateProject(
        (current) => {
          const existing = current.judgeCalibrationRuns ?? [];
          if (existing.some((item) => item.id === run.id)) return current;
          return {
            ...current,
            judgeCalibrationRuns: [...existing, run],
          };
        },
        { immediate: true }
      );
    },
    [updateProject]
  );

  const handleSaveEvaluatorRelease = useCallback(
    (release: EvaluatorRelease) => {
      updateProject(
        (current) => {
          const existing = current.evaluatorReleases ?? [];
          if (existing.some((item) => item.id === release.id)) return current;
          return {
            ...current,
            evaluatorReleases: [...existing, release],
          };
        },
        { immediate: true }
      );
    },
    [updateProject]
  );

  const handleSaveCalibrationReviewEvent = useCallback(
    (event: CalibrationReviewEvent) => {
      updateProject(
        (current) => {
          const existing = current.calibrationReviewEvents ?? [];
          if (existing.some((item) => item.id === event.id)) return current;
          return {
            ...current,
            calibrationReviewEvents: [...existing, event],
          };
        },
        { immediate: true }
      );
    },
    [updateProject]
  );

  const handleSaveEvaluationReviewEvent = useCallback(
    (event: EvaluationReviewEvent) => {
      updateProject(
        (current) => {
          const existing = current.evaluationReviewEvents ?? [];
          if (existing.some((item) => item.id === event.id)) return current;
          return {
            ...current,
            evaluationReviewEvents: [...existing, event],
          };
        },
        { immediate: true }
      );
    },
    [updateProject]
  );

  // v4.3 增量2：删除某条历史评价记录。
  const handleDeleteEvaluation = useCallback(
    (evaluationId: string) => {
      updateProject((current) => ({
        ...current,
        evaluations: (current.evaluations ?? []).filter(
          (record) => record.id !== evaluationId
        ),
      }));
    },
    [updateProject]
  );

  const hasViewingResults = (viewingTask?.results.length ?? 0) > 0;

  // Tab 图标（4 板块）
  const runIcon = (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="5 3 19 12 5 21 5 3" />
    </svg>
  );
  const overviewIcon = (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  );
  const accessIcon = (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  );
  const resultIcon = (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  );
  const evaluateIcon = (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2 9.2 8.6 2 9.2l5.4 4.7L5.8 21 12 17.3 18.2 21l-1.6-7.1L22 9.2l-7.2-.6z" />
    </svg>
  );
  const evalHistoryIcon = (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3v5h5" />
      <path d="M3.05 13A9 9 0 1 0 6 5.3L3 8" />
      <path d="M12 7v5l4 2" />
    </svg>
  );
  const calibrationIcon = (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 3h6" /><path d="M10 3v5l-4.5 8.2A3 3 0 0 0 8.1 21h7.8a3 3 0 0 0 2.6-4.8L14 8V3" /><path d="M8 15h8" />
    </svg>
  );

  return (
    <div className="flex flex-col">
      {/* 4 板块导航：渲染在 header 下方，视觉上属于头部 */}
      <div className="border-b border-slate-200 bg-white/80 backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/80">
        <AppTabs
          activeId={activeTab}
          onChange={(id) => handleTabChange(id as WorkspaceTab)}
          tabs={[
            { id: "run", label: "跑批", icon: runIcon },
            { id: "overview", label: "平台总览", icon: overviewIcon },
            { id: "access", label: "接口创建&管理", icon: accessIcon },
            {
              id: "result",
              label: "跑批历史",
              icon: resultIcon,
              badge: project.tasks.length > 0 ? (
                <span className="ml-1 rounded-full bg-brand-100 px-1.5 py-0.5 text-[10px] font-bold text-brand-700 dark:bg-brand-500/15 dark:text-brand-400">
                  {project.tasks.length}
                </span>
              ) : null,
            },
            { id: "evaluate", label: "AI 评价", icon: evaluateIcon },
            {
              id: "evalHistory",
              label: "AI历史评价",
              icon: evalHistoryIcon,
              badge:
                (project.evaluations?.length ?? 0) > 0 ? (
                  <span className="ml-1 rounded-full bg-brand-100 px-1.5 py-0.5 text-[10px] font-bold text-brand-700 dark:bg-brand-500/15 dark:text-brand-400">
                    {project.evaluations!.length}
                  </span>
                ) : null,
            },
            {
              id: "calibration",
              label: "Judge 校准",
              icon: calibrationIcon,
              badge:
                (project.goldenDatasetVersions?.length ?? 0) > 0 ? (
                  <span className="ml-1 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
                    {project.goldenDatasetVersions!.length}
                  </span>
                ) : null,
            },
          ]}
        />
      </div>

      {activeTab === "overview" ? (
        <PlatformOverview
          project={project}
          onNavigate={(destination) => handleTabChange(destination)}
        />
      ) : activeTab === "run" ? (
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 py-6 sm:px-6">
          {/* 顶部运行控制台：先给用户明确当前能不能跑、还缺什么。 */}
          <RunPanel
            inputs={currentInputs}
            contentMode={draft.contentMode}
            targetIds={targetIds}
            selectedTargets={selectedAlgoConfigs}
            runStatus={runner.runStatus}
            lastRunMode={runner.lastRunMode}
            trialResults={runner.results}
            progress={runner.progress}
            resumableTask={resumableTask}
            onRunTrial={runner.runTrial}
            onRunBatch={runner.runBatch}
            onResumeBatch={runner.resumeBatch}
            onAbandonBatch={handleAbandonBatch}
            onPause={runner.pause}
            onCancel={runner.cancel}
          />

          {/* 1. 输入数据 */}
          <InputArea
            projectName={project.name}
            contentMode={draft.contentMode}
            setContentMode={draft.setContentMode}
            runMode={draft.runMode}
            setRunMode={draft.setRunMode}
            singleInput={draft.singleInput}
            batchInputs={draft.batchInputs}
            updateSingleInput={draft.updateSingleInput}
            setBatchInputs={draft.setBatchInputs}
            targetColumns={targetColumns}
            isReady={draft.isReady}
          />

          {/* 2. 测试模型/算法选择 */}
          <section className="rounded-xl border border-slate-200 bg-white shadow-card dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5 dark:border-slate-800">
              <div>
                <h2 className="flex items-center gap-2 font-mono text-sm font-semibold text-slate-700 dark:text-slate-200">
                  <span className="flex h-5 w-5 items-center justify-center rounded-md bg-brand-100 text-[11px] font-bold text-brand-700 dark:bg-brand-500/20 dark:text-brand-300">
                    2
                  </span>
                  测试模型 / 算法选择
                </h2>
                <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                  勾选本次要被测试、被对比、被 AI 评价的模型或算法接口。
                </p>
              </div>
              <span className="text-xs text-slate-600 dark:text-slate-400">
                已选 {targetIds.length} 个
              </span>
            </div>
            <div className="scroll-thin max-h-[420px] overflow-y-auto p-5">
              <TargetSelector
                selectedIds={targetIds}
                contentMode={draft.contentMode}
                imageState={imageState}
                algoConfigs={algoConfigs}
                onChange={setTargetIds}
              />
            </div>
            <div className="border-t border-slate-100 px-5 py-3 text-xs text-slate-600 dark:border-slate-800 dark:text-slate-400">
              需要新增或编辑接口？前往
              <button
                type="button"
                onClick={() => setActiveTab("access")}
                className="mx-1 font-medium text-brand-600 hover:underline dark:text-brand-400"
              >
                接口创建&管理
              </button>
              板块。
            </div>
          </section>

          {/* 3. 算法参数（可选） */}
          {draft.runMode === "single" && selectedAlgoConfigs.length > 0 && (
            <AlgoParamsInput
              algoConfigs={selectedAlgoConfigs}
              input={draft.singleInput}
              onChange={draft.updateSingleInput}
            />
          )}

          {/* 跑批后引导去结果板块查看，再从结果进入 AI 评价 */}
          <p className="text-center text-xs text-slate-600 dark:text-slate-400">
            运行后在
            <button
              type="button"
              onClick={() => setActiveTab("result")}
              className="mx-1 font-medium text-brand-600 hover:underline dark:text-brand-400"
            >
              跑批历史
            </button>
            板块查看对比，再进入「AI 评价」逐条打分。
          </p>
        </div>
      ) : activeTab === "access" ? (
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 py-6 sm:px-6">
          {/* ② 接口创建&管理板块：新增/编辑接口、AI 解读文档自动建接口 */}
          <section className="rounded-xl border border-slate-200 bg-white shadow-card dark:border-slate-800 dark:bg-slate-900">
            <div className="border-b border-slate-100 px-5 py-3.5 dark:border-slate-800">
              <h2 className="flex items-center gap-2 font-mono text-sm font-semibold text-slate-700 dark:text-slate-200">
                <span className="flex h-5 w-5 items-center justify-center rounded-md bg-brand-100 text-[11px] font-bold text-brand-700 dark:bg-brand-500/20 dark:text-brand-300">
                  ②
                </span>
                接口创建&管理
              </h2>
            </div>
            <div className="p-5">
              <ApiAccessPanel
                configs={algoConfigs}
                onChange={handleApiConfigsChange}
              />
            </div>
          </section>
          <ExternalApiCapabilities />
        </div>
      ) : activeTab === "result" ? (
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 py-6 sm:px-6">
          {/* 需求三·上方：历史任务列表（每行带「去AI评测」） */}
          <HistoryPanel
            tasks={project.tasks}
            viewingTaskId={viewingTask?.id ?? null}
            onView={handleViewTask}
            onDelete={handleDeleteTask}
            onEvaluate={handleEvaluateTask}
            availableTargets={availableRerunTargets}
            rerunBlockedReason={rerunBlockedReason}
            onRerun={handleRerunTask}
          />

          {/* 需求三·下方：默认空，点击上方某条历史批次后展开该批次结果对比 */}
          {viewingTask ? (
            hasViewingResults ? (
              <ResultArea
                key={viewingTask.id}
                results={viewingTask.results}
                inputs={viewingTask.inputs}
                targetIds={viewingTask.targetIds}
                projectName={project.name}
                evaluations={evaluation.evalResults}
              />
            ) : (
              <div className="rounded-lg border border-dashed border-slate-200 p-8 text-center text-sm text-slate-400 dark:border-slate-700">
                该批次没有结果数据。
              </div>
            )
          ) : (
            <div className="rounded-lg border border-dashed border-slate-200 p-8 text-center text-sm text-slate-400 dark:border-slate-700">
              点击上方某条历史批次的「查看结果」，在此展开结果对比。
            </div>
          )}
        </div>
      ) : activeTab === "evaluate" ? (
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 py-6 sm:px-6">
          {/* ④ AI 评价板块（需求二·数据源洁癖）：必须从③带入批次，离开即清空 */}
          <section className="rounded-xl border border-slate-200 bg-white shadow-card dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5 dark:border-slate-800">
              <h2 className="flex items-center gap-2 font-mono text-sm font-semibold text-slate-700 dark:text-slate-200">
                <span className="flex h-5 w-5 items-center justify-center rounded-md bg-amber-100 text-[11px] font-bold text-amber-700 dark:bg-amber-500/20 dark:text-amber-300">
                  ④
                </span>
                AI 智能评价
              </h2>
              <button
                type="button"
                onClick={() => handleTabChange("result")}
                className="text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
              >
                ← 返回跑批历史
              </button>
            </div>

            {evaluatingTask ? (
              <div className="flex flex-col">
                {/* 顶部常驻：正在评测哪个批次 */}
                <div className="flex items-center justify-between border-b border-amber-100 bg-amber-50/60 px-5 py-2.5 dark:border-amber-500/20 dark:bg-amber-500/10">
                  <span className="text-xs font-medium text-amber-700 dark:text-amber-400">
                    正在评测：
                    {evaluatingTask.runMode === "single" ? "单条批次" : "批量批次"}
                    {" · "}
                    {formatDateTime(evaluatingTask.createTime)}
                    {" · "}
                    {evaluatingTask.inputs.length} 输入 ·{" "}
                    {evaluatingTask.targetIds.length} 目标
                  </span>
                  <button
                    type="button"
                    onClick={() => handleTabChange("result")}
                    className="rounded-md border border-amber-300 px-2.5 py-1 text-xs text-amber-700 transition hover:bg-amber-100 dark:border-amber-500/30 dark:text-amber-400"
                  >
                    返回跑批历史
                  </button>
                </div>
                <div className="p-5">
                  <EvaluationPanel
                    key={`${evaluatingTask.id}:${newDimensionContext?.sourceEvaluationId ?? "full"}`}
                    inputs={evaluatingTask.inputs}
                    results={evaluatingTask.results}
                    hasImage={evaluatingImageState.hasImage}
                    concurrency={RUNTIME_CONFIG.defaultConcurrency}
                    sourceTaskId={evaluatingTask.id}
                    evaluation={evaluation}
                    judgeModels={judgeModels}
                    evaluatorVersions={project.evaluatorVersions ?? []}
                    newDimensionContext={newDimensionContext ?? undefined}
                    onSaveEvaluatorVersion={handleSaveEvaluatorVersion}
                    onEvaluationComplete={handleEvaluationComplete}
                  />
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-4 p-10 text-center">
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  请从【结果与历史】选择批次后点「去AI评测」进入。
                </p>
                <button
                  type="button"
                  onClick={() => handleTabChange("result")}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-brand-100 px-4 py-2 text-sm font-medium text-brand-700 transition hover:bg-brand-200 dark:bg-brand-500/15 dark:text-brand-400"
                >
                  {resultIcon}
                  返回结果与历史
                </button>
              </div>
            )}
          </section>
        </div>
      ) : activeTab === "evalHistory" ? (
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 py-6 sm:px-6">
          {/* ⑤ AI 评价结果与历史（v4.3 增量2）：历史仓库，可随便进；只从 Project.evaluations 读 */}
          <EvalHistoryPanel
            evaluations={project.evaluations ?? []}
            evaluatorVersions={project.evaluatorVersions ?? []}
            reviewEvents={project.evaluationReviewEvents ?? []}
            tasks={project.tasks}
            projectName={project.name}
            onDelete={handleDeleteEvaluation}
            onAddDimensions={handleAddEvaluationDimensions}
            onSaveReview={handleSaveEvaluationReviewEvent}
          />
        </div>
      ) : (
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 px-4 py-6 sm:px-6">
          <GoldenDatasetPanel
            projectName={project.name}
            versions={project.goldenDatasetVersions ?? []}
            evaluatorVersions={project.evaluatorVersions ?? []}
            judgeModels={judgeModels}
            calibrationRuns={project.judgeCalibrationRuns ?? []}
            evaluatorReleases={project.evaluatorReleases ?? []}
            calibrationReviewEvents={project.calibrationReviewEvents ?? []}
            onSave={handleSaveGoldenDatasetVersion}
            onSaveCalibrationRun={handleSaveJudgeCalibrationRun}
            onSaveEvaluatorRelease={handleSaveEvaluatorRelease}
            onSaveCalibrationReviewEvent={handleSaveCalibrationReviewEvent}
          />
        </div>
      )}
    </div>
  );
}
