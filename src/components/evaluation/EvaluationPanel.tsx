"use client";

import { useMemo, useState } from "react";
import type { BaseModelConfig, EvalDimension, ResultRow, TaskInput } from "@/types";
import type { UseEvaluationResult } from "@/hooks/useEvaluation";
import type { EvaluateResultPerInput } from "@/services/evaluateService";
import { EvaluationResults } from "./EvaluationResults";

/** 候选维度（带勾选态）：AI 生成或手动添加，用户勾选要纳入评价的维度。 */
interface CandidateDimension extends EvalDimension {
  selected: boolean;
}

/** 候选维度总数上限（含 AI 生成 + 手动添加）。 */
const MAX_DIMENSIONS = 15;

interface JudgeModel {
  id: string;
  name: string;
  supportsImage: boolean;
  /** v4.8：该裁判模型对应的基础大模型完整配置（baseUrl/apiKey/modelName）。 */
  baseModel: BaseModelConfig;
}

/** 一次评价完成后回传的元信息（v4.3；v4.5 加 dimensions：用于在上层构建 EvaluationRecord）。 */
export interface EvaluationCompletePayload {
  evalModelId: string;
  userRequirement: string;
  dimensions: EvalDimension[];
  evalPrompt: string;
  scope: "all" | "selected";
  selectedInputIds?: string[];
  results: EvaluateResultPerInput[];
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
  onEvaluationComplete,
}: EvaluationPanelProps) {
  const [enabled, setEnabled] = useState(false);
  const [scenario, setScenario] = useState("");
  const [evalPrompt, setEvalPrompt] = useState("");
  const [judgeModelId, setJudgeModelId] = useState("");
  const [scopeMode, setScopeMode] = useState<ScopeMode>("all");
  const [selectedInputIds, setSelectedInputIds] = useState<string[]>([]);
  // 候选维度列表（待办勾选式）：AI 生成或手动添加，selected 决定是否纳入本次评价。
  const [candidates, setCandidates] = useState<CandidateDimension[]>([]);

  const { evalResults, status, error, genDimensions, generatePrompt, evaluate, cancel } =
    evaluation;

  const multimodalModels = useMemo(
    () => judgeModels.filter((model) => model.supportsImage),
    [judgeModels]
  );

  // 当前选中裁判模型对应的基础大模型配置（v4.8：随请求传后端，不再用 modelId 让后端查环境变量）。
  const selectedBaseModel = useMemo(
    () => judgeModels.find((model) => model.id === judgeModelId)?.baseModel,
    [judgeModels, judgeModelId]
  );
  const judgeDisabled =
    judgeModels.length === 0 || (hasImage && multimodalModels.length === 0);

  const evaluableInputIds = useMemo(
    () => pickEvaluableInputIds(inputs, results),
    [inputs, results]
  );

  const effectiveScopeIds = useMemo(() => {
    if (scopeMode === "all") return evaluableInputIds;
    return selectedInputIds.filter((id) => evaluableInputIds.includes(id));
  }, [scopeMode, selectedInputIds, evaluableInputIds]);

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
    if (!scenario.trim() || !judgeModelId || !selectedBaseModel) return;
    if (candidates.length >= MAX_DIMENSIONS) return;
    try {
      const generated = await genDimensions(scenario.trim(), selectedBaseModel);
      setCandidates((prev) => {
        const existingNames = new Set(
          prev.map((dim) => dim.name.trim()).filter((name) => name.length > 0)
        );
        const fresh = generated
          .filter((dim) => !existingNames.has(dim.name.trim()))
          .map((dim) => ({ ...dim, selected: false }));
        const remaining = MAX_DIMENSIONS - prev.length;
        return [...prev, ...fresh.slice(0, Math.max(0, remaining))];
      });
    } catch {
      // 错误已由 hook 写入 error 状态
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
    if (!scenario.trim() || !judgeModelId || !selectedBaseModel) return;
    try {
      const prompt = await generatePrompt(
        scenario.trim(),
        selectedBaseModel,
        validDimensions,
        targetNames
      );
      setEvalPrompt(prompt);
    } catch {
      // 错误已由 hook 写入 error 状态
    }
  };

  const handleEvaluate = async () => {
    if (!evalPrompt.trim() || !judgeModelId || !selectedBaseModel) return;
    if (effectiveScopeIds.length === 0) return;
    if (validDimensions.length === 0) return;
    const collected = await evaluate({
      inputs,
      results,
      scopeInputIds: effectiveScopeIds,
      evalPrompt: evalPrompt.trim(),
      baseModel: selectedBaseModel,
      dimensions: validDimensions,
      concurrency,
    });
    // 评价跑完（非取消、有结果）→ 回传上层生成 EvaluationRecord 存盘（v4.3 板块⑤）。
    if (collected && collected.length > 0) {
      onEvaluationComplete?.({
        evalModelId: judgeModelId,
        userRequirement: scenario.trim(),
        dimensions: validDimensions,
        evalPrompt: evalPrompt.trim(),
        scope: scopeMode,
        selectedInputIds:
          scopeMode === "selected" ? [...effectiveScopeIds] : undefined,
        results: collected,
      });
    }
  };

  const toggleSelectedInput = (inputId: string) => {
    setSelectedInputIds((prev) =>
      prev.includes(inputId)
        ? prev.filter((id) => id !== inputId)
        : [...prev, inputId]
    );
  };

  // 有效维度 = 已勾选且名称非空（防空行/未勾选干扰打分）。
  const validDimensions = candidates
    .filter((dim) => dim.selected)
    .map((dim) => ({ name: dim.name.trim(), desc: dim.desc?.trim() || undefined }))
    .filter((dim) => dim.name.length > 0);

  const reachedDimensionLimit = candidates.length >= MAX_DIMENSIONS;
  const canGenDimensions =
    enabled &&
    !judgeDisabled &&
    !!scenario.trim() &&
    !!judgeModelId &&
    !isGeneratingDim &&
    !reachedDimensionLimit;
  const canGenerate =
    enabled &&
    !judgeDisabled &&
    !!scenario.trim() &&
    !!judgeModelId &&
    validDimensions.length > 0 &&
    !isGenerating;
  const canEvaluate =
    enabled &&
    !judgeDisabled &&
    !!evalPrompt.trim() &&
    !!judgeModelId &&
    validDimensions.length > 0 &&
    effectiveScopeIds.length > 0 &&
    !isRunning;

  return (
    <section className="flex flex-col gap-4 rounded-lg border border-gray-200 bg-white p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">AI 自评</h2>
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(event) => setEnabled(event.target.checked)}
            className="h-4 w-4"
          />
          启用 AI 自评
        </label>
      </div>

      {enabled && (
        <div className="flex flex-col gap-4">
          {judgeDisabled && (
            <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-700">
              当前输入包含图片，裁判模型需支持多模态（multimodal），
              但目前无可用的多模态模型，AI 自评暂不可用。
            </p>
          )}

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-700">
              裁判模型
            </label>
            <select
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
              value={scenario}
              onChange={(event) => setScenario(event.target.value)}
              disabled={judgeDisabled}
              rows={2}
              placeholder="例如：评价各模型对商品文案的吸引力、信息完整度与合规性，重点关注卖点突出程度。"
              className="w-full resize-y rounded-md border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-100"
            />
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
                      type="checkbox"
                      checked={candidate.selected}
                      onChange={() => toggleCandidate(index)}
                      disabled={judgeDisabled}
                      className="mt-1 h-4 w-4 shrink-0 cursor-pointer accent-indigo-600"
                    />
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <input
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
                    .filter((input) => evaluableInputIds.includes(input.id))
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
                          #{index + 1} {input.prompt.slice(0, 40) || "(无 prompt)"}
                        </span>
                      </label>
                    ))
                )}
              </div>
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
              {isRunning ? "评价进行中…" : "开始 AI 评价"}
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
    </section>
  );
}
