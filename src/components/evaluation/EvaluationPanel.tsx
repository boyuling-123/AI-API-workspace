"use client";

import { useMemo, useState } from "react";
import type {
  EvalDimension,
  EvaluationMode,
  ResultRow,
  TaskInput,
} from "@/types";
import type { UseEvaluationResult } from "@/hooks/useEvaluation";
import type { EvaluateResultPerInput } from "@/services/evaluateService";
import { EvaluationResults } from "./EvaluationResults";
import {
  AUTO_EXPECTED_ANSWER_KEY,
  collectExtraFieldKeys,
  resolveExpectedAnswer,
  sortExpectedAnswerKeys,
} from "@/services/expectedAnswer";
import {
  analyzeNewEvaluationDimensions,
  buildNewDimensionPreview,
  normalizeEvaluationDimensionName,
} from "@/lib/newDimensionEvaluation";

/** 候选维度（带勾选态）：AI 生成或手动添加，用户勾选要纳入评价的维度。 */
interface CandidateDimension extends EvalDimension {
  selected: boolean;
}

/** 候选维度总数上限（含 AI 生成 + 手动添加）。 */
const MAX_DIMENSIONS = 15;

const REFERENCE_DEFAULT_SCENARIO =
  "对微调模型输出进行标准答案评测。逐条检查模型输出是否和标准答案语义一致、JSON/工具调用格式是否合规、关键字段是否完整，输出可直接用于上线判定。";

const REFERENCE_DEFAULT_PROMPT = `你正在评测微调模型输出。请严格对照每条样本的标准答案，判断模型输出是否正确。

评分重点：
- 如果标准答案是 JSON / 工具调用，必须检查 JSON 可解析性、tool 是否正确、arguments 字段和值是否匹配、need_user_confirmation 逻辑是否正确。
- 允许字段顺序不同、自然语言理由略有差异，但不允许类别/工具错判、关键参数缺失、格式不可用或臆测补全。
- 信息不足时，模型应按标准答案追问；不能擅自生成缺失参数。
- 只根据本条输入、标准答案和模型输出判分，不要因为其他目标表现较差而相对给高分。`;

const REFERENCE_DEFAULT_DIMENSIONS: EvalDimension[] = [
  {
    name: "答案正确性",
    desc: "模型输出是否与标准答案在语义、工具选择、类别判断或核心结论上匹配。",
  },
  {
    name: "格式合规性",
    desc: "输出格式是否满足要求，尤其是 JSON 可解析性、字段名、字段类型和白名单约束。",
  },
  {
    name: "关键字段完整性",
    desc: "是否包含标准答案要求的关键字段、参数、追问字段或必要理由。",
  },
  {
    name: "可上线程度",
    desc: "综合判断该输出是否可以直接进入业务链路，或仅需轻微人工修正。",
  },
];

interface JudgeModel {
  id: string;
  name: string;
  supportsImage: boolean;
}

/** 一次评价完成后回传的元信息（v4.3；v4.5 加 dimensions：用于在上层构建 EvaluationRecord）。 */
export interface EvaluationCompletePayload {
  evalModelId: string;
  userRequirement: string;
  dimensions: EvalDimension[];
  evalPrompt: string;
  evaluationMode: EvaluationMode;
  expectedAnswerColumn?: string;
  scope: "all" | "selected";
  selectedInputIds?: string[];
  evaluationKind: "full" | "new_dimensions";
  sourceEvaluationId?: string;
  results: EvaluateResultPerInput[];
}

export interface NewDimensionEvaluationContext {
  sourceEvaluationId: string;
  sourceInputIds: string[];
  existingDimensions: EvalDimension[];
  evalModelId: string;
  userRequirement: string;
  evalPrompt: string;
  evaluationMode: EvaluationMode;
  expectedAnswerColumn?: string;
}

interface EvaluationPanelProps {
  inputs: TaskInput[];
  results: ResultRow[];
  /** 当前输入是否含图：含图时裁判模型须 multimodal，不支持图的模型置灰。 */
  hasImage: boolean;
  /** 运行并发。 */
  concurrency: number;
  /** 由上层提供的评价状态。 */
  evaluation: UseEvaluationResult;
  /** 可用作裁判的模型列表（从 apiConfigs 中筛选 llm 类型传入）。 */
  judgeModels: JudgeModel[];
  /** 从历史评价发起时，仅评价新维度并复用来源批次输出。 */
  newDimensionContext?: NewDimensionEvaluationContext;
  /** v4.3：一次评价跑完（非取消）后回调，上层据此生成 EvaluationRecord 存入 Project.evaluations。 */
  onEvaluationComplete?: (payload: EvaluationCompletePayload) => void;
}

type ScopeMode = "all" | "selected";

/** 仅评有成功结果的输入。 */
function pickEvaluableInputIds(
  inputs: TaskInput[],
  results: ResultRow[]
): string[] {
  const successInputIds = new Set(
    results
      .filter((row) => row.items.some((item) => item.status === "success"))
      .map((row) => row.inputId)
  );
  return inputs
    .filter((input) => successInputIds.has(input.id))
    .map((input) => input.id);
}

/**
 * AI 自评面板（M9，m9-5/m9-6）：
 * 开关「AI 自评」→ 测评需求 → 手填/AI 生成评价 Prompt → 选裁判模型（含图置灰）
 * → 评价范围（全部 / 勾选） → 逐条评价 → 展示评分/点评/结论/推荐。
 */
export function EvaluationPanel({
  inputs,
  results,
  hasImage,
  concurrency,
  evaluation,
  judgeModels,
  newDimensionContext,
  onEvaluationComplete,
}: EvaluationPanelProps) {
  const [enabled, setEnabled] = useState(Boolean(newDimensionContext));
  const [scenario, setScenario] = useState(
    newDimensionContext?.userRequirement ?? ""
  );
  const [evalPrompt, setEvalPrompt] = useState(
    newDimensionContext?.evalPrompt ?? ""
  );
  const [judgeModelId, setJudgeModelId] = useState(
    newDimensionContext?.evalModelId ?? ""
  );
  const [evaluationMode, setEvaluationMode] =
    useState<EvaluationMode>(
      newDimensionContext?.evaluationMode ?? "comparison"
    );
  const [expectedAnswerKey, setExpectedAnswerKey] = useState(
    newDimensionContext?.expectedAnswerColumn ?? AUTO_EXPECTED_ANSWER_KEY
  );
  const [scopeMode, setScopeMode] = useState<ScopeMode>(
    newDimensionContext ? "selected" : "all"
  );
  const [selectedInputIds, setSelectedInputIds] = useState<string[]>(
    newDimensionContext?.sourceInputIds ?? []
  );
  // 候选维度列表（待办勾选式）：AI 生成或手动添加，selected 决定是否纳入本次评价。
  const [candidates, setCandidates] = useState<CandidateDimension[]>([]);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const { evalResults, status, error, genDimensions, generatePrompt, evaluate, cancel } =
    evaluation;

  const multimodalModels = useMemo(
    () => judgeModels.filter((model) => model.supportsImage),
    [judgeModels]
  );
  const judgeDisabled =
    judgeModels.length === 0 || (hasImage && multimodalModels.length === 0);
  const selectedJudge = judgeModels.find((model) => model.id === judgeModelId);
  const judgeReady = Boolean(
    selectedJudge && (!hasImage || selectedJudge.supportsImage)
  );

  const evaluableInputIds = useMemo(
    () => pickEvaluableInputIds(inputs, results),
    [inputs, results]
  );

  const incrementalPreview = useMemo(
    () =>
      newDimensionContext
        ? buildNewDimensionPreview({
            inputs,
            results,
            sourceInputIds: newDimensionContext.sourceInputIds,
            evaluationMode,
            expectedAnswerKey,
          })
        : null,
    [
      evaluationMode,
      expectedAnswerKey,
      inputs,
      newDimensionContext,
      results,
    ]
  );

  const effectiveScopeIds = useMemo(() => {
    if (incrementalPreview) return incrementalPreview.inputIds;
    if (scopeMode === "all") return evaluableInputIds;
    return selectedInputIds.filter((id) => evaluableInputIds.includes(id));
  }, [scopeMode, selectedInputIds, evaluableInputIds, incrementalPreview]);

  const extraFieldKeys = useMemo(
    () => sortExpectedAnswerKeys(collectExtraFieldKeys(inputs)),
    [inputs]
  );

  const expectedCoverage = useMemo(() => {
    const scopedInputs = inputs.filter((input) =>
      effectiveScopeIds.includes(input.id)
    );
    const withExpected = scopedInputs.filter(
      (input) => resolveExpectedAnswer(input, expectedAnswerKey).value
    );
    return { total: scopedInputs.length, matched: withExpected.length };
  }, [effectiveScopeIds, expectedAnswerKey, inputs]);

  // 本次将对比的目标名单（去重），用于喂给 AI 生成评价 Prompt。
  const targetNames = useMemo(() => {
    const names = new Set<string>();
    for (const row of results) {
      for (const item of row.items) {
        if (item.status === "success") names.add(item.targetName);
      }
    }
    return Array.from(names);
  }, [results]);

  if (results.length === 0) {
    return null;
  }

  const isGeneratingDim = status === "gen-dim";
  const isGenerating = status === "generating";
  const isRunning = status === "running";

  // AI 按测评需求生成候选维度 → 追加到待办列表（默认不勾选，由用户自行挑选）。
  // 再次点击为「追加一批」：不覆盖已有维度（尤其已勾选的），按维度名去重，总数封顶 15 条。
  const handleGenDimensions = async () => {
    if (!scenario.trim() || !judgeModelId) return;
    if (candidates.length >= MAX_DIMENSIONS) return;
    try {
      const generated = await genDimensions(scenario.trim(), judgeModelId);
      setCandidates((prev) => {
        const existingNames = new Set(
          [...(newDimensionContext?.existingDimensions ?? []), ...prev]
            .map((dim) => normalizeEvaluationDimensionName(dim.name))
            .filter(Boolean)
        );
        const fresh = generated
          .filter(
            (dim) =>
              !existingNames.has(normalizeEvaluationDimensionName(dim.name))
          )
          .map((dim) => ({ ...dim, selected: false }));
        const remaining = MAX_DIMENSIONS - prev.length;
        return [...prev, ...fresh.slice(0, Math.max(0, remaining))];
      });
    } catch {
      // 错误已由 hook 写入 error 状态
    }
  };

  const handleModeChange = (mode: EvaluationMode) => {
    setEvaluationMode(mode);
    if (mode === "reference") {
      if (!scenario.trim()) setScenario(REFERENCE_DEFAULT_SCENARIO);
      if (!evalPrompt.trim()) setEvalPrompt(REFERENCE_DEFAULT_PROMPT);
      if (!newDimensionContext && candidates.length === 0) {
        setCandidates(
          REFERENCE_DEFAULT_DIMENSIONS.map((dimension) => ({
            ...dimension,
            selected: true,
          }))
        );
      }
    }
  };

  const toggleCandidate = (index: number) => {
    setCandidates((prev) =>
      prev.map((dim, idx) =>
        idx === index ? { ...dim, selected: !dim.selected } : dim
      )
    );
  };

  const updateCandidate = (index: number, patch: Partial<EvalDimension>) => {
    setCandidates((prev) =>
      prev.map((dim, idx) => (idx === index ? { ...dim, ...patch } : dim))
    );
  };

  const removeCandidate = (index: number) => {
    setCandidates((prev) => prev.filter((_, idx) => idx !== index));
  };

  // 手动添加一个维度（默认勾选，等待用户填名），同样受 15 条上限约束。
  const addCandidate = () => {
    setCandidates((prev) =>
      prev.length >= MAX_DIMENSIONS
        ? prev
        : [...prev, { name: "", desc: "", selected: true }]
    );
  };

  const handleGenerate = async () => {
    if (!scenario.trim() || !judgeModelId) return;
    try {
      const prompt = await generatePrompt(
        scenario.trim(),
        judgeModelId,
        validDimensions,
        targetNames
      );
      setEvalPrompt(prompt);
    } catch {
      // 错误已由 hook 写入 error 状态
    }
  };

  const executeEvaluation = async () => {
    if (!evalPrompt.trim() || !judgeModelId) return;
    if (effectiveScopeIds.length === 0) return;
    if (validDimensions.length === 0) return;
    setConfirmOpen(false);
    const collected = await evaluate({
      inputs,
      results,
      scopeInputIds: effectiveScopeIds,
      evalPrompt: evalPrompt.trim(),
      modelId: judgeModelId,
      dimensions: validDimensions,
      evaluationMode,
      expectedAnswerKey,
      concurrency,
    });
    // 评价跑完（非取消、有结果）→ 回传上层生成 EvaluationRecord 存盘（v4.3 板块⑤）。
    if (collected && collected.length > 0) {
      onEvaluationComplete?.({
        evalModelId: judgeModelId,
        userRequirement: scenario.trim(),
        dimensions: validDimensions,
        evalPrompt: evalPrompt.trim(),
        evaluationMode,
        expectedAnswerColumn:
          evaluationMode === "reference" ? expectedAnswerKey : undefined,
        scope: scopeMode,
        selectedInputIds:
          scopeMode === "selected" ? [...effectiveScopeIds] : undefined,
        evaluationKind: newDimensionContext ? "new_dimensions" : "full",
        sourceEvaluationId: newDimensionContext?.sourceEvaluationId,
        results: collected,
      });
    }
  };

  const handleEvaluate = () => {
    if (!canEvaluate) return;
    if (newDimensionContext) {
      setConfirmOpen(true);
      return;
    }
    void executeEvaluation();
  };

  const toggleSelectedInput = (inputId: string) => {
    setSelectedInputIds((prev) =>
      prev.includes(inputId)
        ? prev.filter((id) => id !== inputId)
        : [...prev, inputId]
    );
  };

  const selectedDimensions = candidates
    .filter((dim) => dim.selected)
    .map((dim) => ({
      name: dim.name,
      desc: dim.desc,
    }))
    .filter((dim) => dim.name.length > 0);
  const dimensionAnalysis = analyzeNewEvaluationDimensions(
    selectedDimensions,
    newDimensionContext?.existingDimensions ?? []
  );
  const validDimensions = dimensionAnalysis.dimensions;
  const duplicateDimensionNames = dimensionAnalysis.duplicateNames;

  const reachedDimensionLimit = candidates.length >= MAX_DIMENSIONS;
  const canGenDimensions =
    enabled &&
    judgeReady &&
    !!scenario.trim() &&
    !!judgeModelId &&
    !isGeneratingDim &&
    !reachedDimensionLimit;
  const canGenerate =
    enabled &&
    judgeReady &&
    !!scenario.trim() &&
    !!judgeModelId &&
    validDimensions.length > 0 &&
    !isGenerating;
  const canEvaluate =
    enabled &&
    judgeReady &&
    !!evalPrompt.trim() &&
    !!judgeModelId &&
    validDimensions.length > 0 &&
    duplicateDimensionNames.length === 0 &&
    (evaluationMode === "comparison" || expectedCoverage.matched > 0) &&
    effectiveScopeIds.length > 0 &&
    !isRunning &&
    (!newDimensionContext || status !== "done");

  return (
    <section className="flex flex-col gap-4 rounded-lg border border-gray-200 bg-white p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">
          {newDimensionContext ? "新增评价维度" : "AI 自评"}
        </h2>
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(event) => setEnabled(event.target.checked)}
            className="h-4 w-4"
          />
          {newDimensionContext ? "启用新增维度评价" : "启用 AI 自评"}
        </label>
      </div>

      {enabled && (
        <div className="flex flex-col gap-4">
          {newDimensionContext && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
              <p className="font-semibold">只新增裁判维度，不重新跑模型或算法</p>
              <p className="mt-1 text-xs text-emerald-700">
                来源评价：{newDimensionContext.sourceEvaluationId}。本次复用历史输出，评价范围锁定为来源评价已完成的样本；确认前不会调用裁判模型。
              </p>
            </div>
          )}

          {judgeDisabled && (
            <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-700">
              {hasImage
                ? "当前输入包含图片，但目前没有可用的多模态裁判模型，AI 自评暂不可用。"
                : "当前没有可用的文字裁判模型，请先在接口管理中完成配置。"}
            </p>
          )}
          {!judgeDisabled && judgeModelId && !judgeReady && (
            <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-700">
              来源评价使用的裁判模型当前不可用，请重新选择后再继续。
            </p>
          )}

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-700">
              裁判模型
            </label>
            <select
              aria-label="裁判模型"
              value={judgeModelId}
              onChange={(event) => setJudgeModelId(event.target.value)}
              disabled={judgeDisabled}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:bg-gray-100"
            >
              <option value="">请选择裁判模型</option>
              {judgeModels.map((model) => {
                const optionDisabled = hasImage && !model.supportsImage;
                return (
                  <option
                    key={model.id}
                    value={model.id}
                    disabled={optionDisabled}
                  >
                    {model.name}
                    {optionDisabled ? "（不支持图片，置灰）" : ""}
                  </option>
                );
              })}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-700">
              测评需求（描述你的评价场景）
            </label>
            <textarea
              aria-label="测评需求"
              value={scenario}
              onChange={(event) => setScenario(event.target.value)}
              disabled={judgeDisabled}
              rows={2}
              placeholder="例如：评价各模型对商品文案的吸引力、信息完整度与合规性，重点关注卖点突出程度。"
              className="w-full resize-y rounded-md border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-100"
            />
          </div>

          <div className="flex flex-col gap-2 rounded-md border border-slate-200 bg-slate-50/70 p-3">
            <label className="text-sm font-medium text-gray-700">
              评价模式
            </label>
            <div className="grid gap-2 md:grid-cols-2">
              <label className="flex cursor-pointer gap-2 rounded-md border border-white bg-white px-3 py-2 text-sm shadow-sm">
                <input
                  type="radio"
                  checked={evaluationMode === "comparison"}
                  onChange={() => handleModeChange("comparison")}
                  disabled={judgeDisabled}
                  className="mt-0.5"
                />
                <span>
                  <span className="block font-medium text-gray-800">
                    横向对比
                  </span>
                  <span className="text-xs text-gray-500">
                    适合多个模型互相比质量，不依赖标准答案。
                  </span>
                </span>
              </label>
              <label className="flex cursor-pointer gap-2 rounded-md border border-white bg-white px-3 py-2 text-sm shadow-sm">
                <input
                  type="radio"
                  checked={evaluationMode === "reference"}
                  onChange={() => handleModeChange("reference")}
                  disabled={judgeDisabled}
                  className="mt-0.5"
                />
                <span>
                  <span className="block font-medium text-gray-800">
                    标准答案判分
                  </span>
                  <span className="text-xs text-gray-500">
                    逐条读取 expected_output / 标准答案列，让 AI 对照判分。
                  </span>
                </span>
              </label>
            </div>

            {evaluationMode === "reference" && (
              <div className="grid gap-2 md:grid-cols-[minmax(0,260px),1fr]">
                <label className="flex flex-col gap-1 text-xs text-gray-600">
                  标准答案字段
                  <select
                    value={expectedAnswerKey}
                    onChange={(event) =>
                      setExpectedAnswerKey(event.target.value)
                    }
                    disabled={judgeDisabled}
                    className="rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm disabled:bg-gray-100"
                  >
                    <option value={AUTO_EXPECTED_ANSWER_KEY}>
                      自动识别推荐字段
                    </option>
                    {extraFieldKeys.map((key) => (
                      <option key={key} value={key}>
                        {key}
                      </option>
                    ))}
                  </select>
                </label>
                <p className="self-end rounded-md bg-white px-3 py-2 text-xs text-gray-500">
                  当前范围内 {expectedCoverage.matched}/{expectedCoverage.total} 条有标准答案；
                  无标准答案的行会自动跳过。推荐列名：expected_output、standard_answer、answer、标准答案。
                </p>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2.5 rounded-md border border-indigo-100 bg-indigo-50/40 p-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-gray-700">
                评价维度（勾选要考察的维度，各维度独立打分、不算总分）
              </label>
              <span className="text-xs text-gray-400">
                已勾选 {validDimensions.length} 个
              </span>
            </div>

            {newDimensionContext && (
              <div className="rounded-md border border-indigo-100 bg-white px-3 py-2">
                <p className="text-xs font-medium text-indigo-800">
                  已评价维度（只读，不能重复）
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {newDimensionContext.existingDimensions.map((dimension) => (
                    <span
                      key={normalizeEvaluationDimensionName(dimension.name)}
                      className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600"
                    >
                      {dimension.name}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleGenDimensions}
                disabled={!canGenDimensions}
                className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-gray-300"
              >
                {isGeneratingDim
                  ? "AI 生成维度中…"
                  : candidates.length === 0
                    ? "AI 生成评价维度"
                    : "再来一批新维度"}
              </button>
              {!scenario.trim() && (
                <span className="text-xs text-gray-400">
                  先填写上方测评需求，按钮即可点亮
                </span>
              )}
              {reachedDimensionLimit && (
                <span className="text-xs text-amber-600">
                  维度已达上限（{MAX_DIMENSIONS} 条），如需新增请先删除部分
                </span>
              )}
            </div>

            {candidates.length === 0 ? (
              <p className="rounded-md border border-dashed border-gray-200 bg-white px-3 py-3 text-center text-xs text-gray-400">
                点击「AI 生成评价维度」让模型按你的需求生成候选维度，
                <span className="font-medium text-gray-500">勾选你想考察的</span>
                ；觉得不够可点「再来一批新维度」继续追加，也可手动添加。
              </p>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {candidates.map((candidate, index) => (
                  <li
                    key={index}
                    className={`flex items-start gap-2 rounded-md border p-2 transition ${
                      candidate.selected
                        ? "border-indigo-200 bg-white"
                        : "border-gray-200 bg-gray-50 opacity-70"
                    }`}
                  >
                    <input
                      aria-label={`选择维度 ${candidate.name || index + 1}`}
                      type="checkbox"
                      checked={candidate.selected}
                      onChange={() => toggleCandidate(index)}
                      disabled={judgeDisabled}
                      className="mt-1 h-4 w-4 shrink-0 cursor-pointer accent-indigo-600"
                    />
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <input
                        aria-label={`维度 ${index + 1} 名称`}
                        type="text"
                        value={candidate.name}
                        onChange={(event) =>
                          updateCandidate(index, { name: event.target.value })
                        }
                        disabled={judgeDisabled}
                        placeholder="维度名（如 准确性）"
                        className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm font-medium disabled:bg-gray-100"
                      />
                      <input
                        aria-label={`维度 ${index + 1} 说明`}
                        type="text"
                        value={candidate.desc ?? ""}
                        onChange={(event) =>
                          updateCandidate(index, { desc: event.target.value })
                        }
                        disabled={judgeDisabled}
                        placeholder="维度说明（这条具体考察什么）"
                        className="w-full rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-600 disabled:bg-gray-100"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => removeCandidate(index)}
                      disabled={judgeDisabled}
                      className="mt-0.5 shrink-0 rounded-md border border-red-200 px-2 py-1 text-xs text-red-600 transition hover:bg-red-50 disabled:opacity-40"
                    >
                      删除
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={addCandidate}
                disabled={judgeDisabled || reachedDimensionLimit}
                className="rounded-md border border-dashed border-gray-300 bg-white px-3 py-1 text-xs text-gray-600 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                + 手动添加维度
              </button>
              <span className="text-xs text-gray-400">
                共 {candidates.length}/{MAX_DIMENSIONS} 条
              </span>
            </div>
            {duplicateDimensionNames.length > 0 && (
              <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
                以下维度与来源评价或本次其他维度重复，请修改后再继续：
                {duplicateDimensionNames.join("、")}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-gray-700">
                评价 Prompt（可手动编辑）
              </label>
              <button
                type="button"
                onClick={handleGenerate}
                disabled={!canGenerate}
                className="rounded-md border border-blue-300 bg-blue-50 px-3 py-1 text-xs text-blue-700 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isGenerating ? "AI 生成中…" : "按维度自动生成评价 Prompt"}
              </button>
            </div>
            <textarea
              aria-label="评价 Prompt"
              value={evalPrompt}
              onChange={(event) => setEvalPrompt(event.target.value)}
              disabled={judgeDisabled}
              rows={5}
              placeholder="手动填写评价标准，或点击上方「AI 自动生成评价 Prompt」后在此微调。"
              className="w-full resize-y rounded-md border border-gray-300 px-3 py-2 font-mono text-xs disabled:bg-gray-100"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-gray-700">
              评价范围
            </label>
            {newDimensionContext ? (
              <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                已锁定来源评价的 {newDimensionContext.sourceInputIds.length} 条结果；
                本次可评价 {incrementalPreview?.judgeCallCount ?? 0} 条，复用
                {incrementalPreview?.reusedOutputCount ?? 0} 条模型或算法输出。
                {(incrementalPreview?.skippedMissingExpectedCount ?? 0) > 0 &&
                  ` 另有 ${incrementalPreview?.skippedMissingExpectedCount} 条因缺少标准答案跳过。`}
              </div>
            ) : (
              <>
                <div className="flex items-center gap-4 text-sm">
                  <label className="flex cursor-pointer items-center gap-1.5">
                    <input
                      type="radio"
                      name="eval-scope"
                      checked={scopeMode === "all"}
                      onChange={() => setScopeMode("all")}
                      disabled={judgeDisabled}
                    />
                    全部（{evaluableInputIds.length} 条可评）
                  </label>
                  <label className="flex cursor-pointer items-center gap-1.5">
                    <input
                      type="radio"
                      name="eval-scope"
                      checked={scopeMode === "selected"}
                      onChange={() => setScopeMode("selected")}
                      disabled={judgeDisabled}
                    />
                    手动勾选
                  </label>
                </div>
                {scopeMode === "selected" && (
                  <div className="flex flex-col gap-1 rounded-md border border-gray-200 p-2">
                    {evaluableInputIds.length === 0 ? (
                      <p className="text-xs text-gray-400">无可评价的输入。</p>
                    ) : (
                      inputs
                        .filter((input) =>
                          evaluableInputIds.includes(input.id)
                        )
                        .map((input, index) => (
                          <label
                            key={input.id}
                            className="flex cursor-pointer items-center gap-2 text-xs"
                          >
                            <input
                              type="checkbox"
                              checked={selectedInputIds.includes(input.id)}
                              onChange={() => toggleSelectedInput(input.id)}
                              disabled={judgeDisabled}
                            />
                            <span className="truncate">
                              #{index + 1}{" "}
                              {input.prompt.slice(0, 40) || "(无 prompt)"}
                            </span>
                          </label>
                        ))
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          {error && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-600">
              {error}
            </p>
          )}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleEvaluate}
              disabled={!canEvaluate}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isRunning
                ? "评价进行中…"
                : status === "done" && newDimensionContext
                  ? "新增维度评价已完成"
                  : newDimensionContext
                    ? "预览并确认新增维度评价"
                    : "开始 AI 评价"}
            </button>
            {isRunning && (
              <button
                type="button"
                onClick={cancel}
                className="rounded-md border border-gray-300 px-4 py-2 text-sm transition hover:bg-gray-50"
              >
                取消
              </button>
            )}
          </div>

          <EvaluationResults
            evalResults={evalResults}
            inputs={inputs}
            results={results}
            dimensions={validDimensions}
          />
        </div>
      )}

      {confirmOpen && newDimensionContext && incrementalPreview && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="new-dimension-confirm-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4"
        >
          <div className="w-full max-w-lg rounded-xl bg-white p-5 shadow-2xl">
            <h3
              id="new-dimension-confirm-title"
              className="text-base font-semibold text-slate-900"
            >
              确认新增维度评价
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              将创建一条独立评价记录，来源评价与原始跑批结果都不会被覆盖。
            </p>

            <dl className="mt-4 grid grid-cols-2 gap-2 text-sm">
              <div className="rounded-lg bg-amber-50 p-3">
                <dt className="text-xs text-amber-700">裁判模型调用</dt>
                <dd className="mt-1 text-lg font-semibold text-amber-900">
                  {incrementalPreview.judgeCallCount} 次
                </dd>
              </div>
              <div className="rounded-lg bg-emerald-50 p-3">
                <dt className="text-xs text-emerald-700">被测模型/算法调用</dt>
                <dd className="mt-1 text-lg font-semibold text-emerald-900">
                  0 次
                </dd>
              </div>
              <div className="rounded-lg bg-slate-50 p-3">
                <dt className="text-xs text-slate-500">复用历史输出</dt>
                <dd className="mt-1 font-semibold text-slate-800">
                  {incrementalPreview.reusedOutputCount} 条
                </dd>
              </div>
              <div className="rounded-lg bg-indigo-50 p-3">
                <dt className="text-xs text-indigo-600">本次新增维度</dt>
                <dd className="mt-1 font-semibold text-indigo-900">
                  {validDimensions.length} 个
                </dd>
              </div>
            </dl>

            <div className="mt-3 rounded-md border border-slate-200 px-3 py-2 text-xs text-slate-600">
              {validDimensions.map((dimension) => dimension.name).join("、")}
            </div>
            <p className="mt-3 text-xs text-amber-700">
              确认后才会调用裁判模型，可能产生模型费用；不会重新执行任何被测模型或算法。
            </p>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                返回修改
              </button>
              <button
                type="button"
                onClick={() => void executeEvaluation()}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                确认并开始评价
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
