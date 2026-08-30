"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  EvalDimension,
  EvaluationMode,
  EvaluatorVersion,
  ResultRow,
  TaskInput,
} from "@/types";
import type { UseEvaluationResult } from "@/hooks/useEvaluation";
import type { EvaluateResultPerInput } from "@/services/evaluateService";
import { EvaluationResults } from "./EvaluationResults";
import { EvaluatorVersionDiffPanel } from "./EvaluatorVersionDiffPanel";
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
import {
  analyzeDimensionHardRules,
  buildDimensionGenerationSamples,
  DIMENSION_SAMPLE_STRATEGY_LABELS,
  DIMENSION_TASK_TYPE_LABELS,
  listDimensionSampleCandidates,
  MAX_DIMENSION_BAD_CASE_REASON_LENGTH,
  MAX_DIMENSION_HARD_RULES,
  MAX_DIMENSION_OBJECTIVE_LENGTH,
  MAX_DIMENSION_SAMPLES,
  MAX_DIMENSION_SCENARIO_LENGTH,
  selectRepresentativeSampleIds,
  type DimensionSampleStrategy,
  type DimensionTaskType,
} from "@/lib/dimensionGeneration";
import {
  analyzeDimensionHumanFeedbackDraft,
  DIMENSION_HUMAN_FEEDBACK_MODE_LABELS,
  MAX_DIMENSION_HUMAN_FEEDBACK_NOTE_LENGTH,
  type DimensionHumanFeedbackDraft,
  type DimensionHumanFeedbackMode,
} from "@/lib/dimensionHumanFeedback";
import {
  analyzeEvaluationRubric,
  createDefinitionBasedRubric,
  createEmptyEvaluationRubric,
  MAX_RUBRIC_CRITERIA_LENGTH,
  MAX_RUBRIC_DEFINITION_LENGTH,
  MAX_RUBRIC_EVIDENCE_ITEMS,
  MAX_RUBRIC_EVIDENCE_LENGTH,
  MAX_RUBRIC_JUDGE_INSTRUCTION_LENGTH,
  MAX_RUBRIC_NAME_LENGTH,
  REQUIRED_RUBRIC_SCORES,
} from "@/lib/evaluationRubric";
import {
  analyzeEvaluatorPolicy,
  buildEvaluatorPolicyFingerprint,
  distributeEvenEvaluatorWeights,
} from "@/lib/evaluatorPolicy";
import {
  buildEvaluatorDefinitionFingerprint,
  cloneEvaluatorVersionDraft,
  createEvaluatorVersion,
  isEvaluatorVersionIntact,
  MAX_EVALUATOR_AUTHOR_LENGTH,
  MAX_EVALUATOR_CHANGE_NOTE_LENGTH,
  MAX_EVALUATOR_NAME_LENGTH,
} from "@/lib/evaluatorVersion";
import { restoreEvaluatorVersion } from "@/lib/evaluatorVersionDiff";
import {
  buildEvaluationExecutionPlan,
  DEFAULT_TRIAL_EVALUATION_COUNT,
  MAX_TRIAL_EVALUATION_COUNT,
  type EvaluationExecutionIntent,
} from "@/lib/evaluationExecutionPlan";
import { formatDateTime } from "@/lib/datetime";

/** 候选维度（带勾选态）：AI 生成或手动添加，用户勾选要纳入评价的维度。 */
interface CandidateDimension extends EvalDimension {
  selected: boolean;
}

function rebalanceSelectedCandidateWeights(
  candidates: CandidateDimension[]
): CandidateDimension[] {
  const selected = distributeEvenEvaluatorWeights(
    candidates.filter((candidate) => candidate.selected)
  );
  let selectedIndex = 0;
  return candidates.map((candidate) =>
    candidate.selected ? selected[selectedIndex++] : candidate
  );
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
  createDefinitionBasedRubric(
    "答案正确性",
    "模型输出是否与标准答案在语义、工具选择、类别判断或核心结论上匹配。"
  ),
  createDefinitionBasedRubric(
    "格式合规性",
    "输出格式是否满足要求，尤其是 JSON 可解析性、字段名、字段类型和白名单约束。"
  ),
  createDefinitionBasedRubric(
    "关键字段完整性",
    "是否包含标准答案要求的关键字段、参数、追问字段或必要理由。"
  ),
  createDefinitionBasedRubric(
    "可上线程度",
    "综合判断该输出是否可以直接进入业务链路，或仅需轻微人工修正。"
  ),
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
  evaluatorVersionId?: string;
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
  /** 当前评价来源批次，用于版本适用任务追溯。 */
  sourceTaskId: string;
  /** 由上层提供的评价状态。 */
  evaluation: UseEvaluationResult;
  /** 可用作裁判的模型列表（从 apiConfigs 中筛选 llm 类型传入）。 */
  judgeModels: JudgeModel[];
  /** 项目内所有不可变 Evaluator 版本。 */
  evaluatorVersions: EvaluatorVersion[];
  /** 从历史评价发起时，仅评价新维度并复用来源批次输出。 */
  newDimensionContext?: NewDimensionEvaluationContext;
  /** 只追加新版本，不允许覆盖既有版本。 */
  onSaveEvaluatorVersion: (version: EvaluatorVersion) => void;
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
  sourceTaskId,
  evaluation,
  judgeModels,
  evaluatorVersions,
  newDimensionContext,
  onSaveEvaluatorVersion,
  onEvaluationComplete,
}: EvaluationPanelProps) {
  const [enabled, setEnabled] = useState(Boolean(newDimensionContext));
  const [scenario, setScenario] = useState(
    newDimensionContext?.userRequirement ?? ""
  );
  const [businessScenario, setBusinessScenario] = useState("");
  const [hardRulesText, setHardRulesText] = useState("");
  const [dimensionTaskType, setDimensionTaskType] =
    useState<DimensionTaskType>("text_generation");
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
  const [confirmedPolicyFingerprint, setConfirmedPolicyFingerprint] =
    useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmationIntent, setConfirmationIntent] =
    useState<EvaluationExecutionIntent>("formal");
  const [lastExecutionIntent, setLastExecutionIntent] =
    useState<EvaluationExecutionIntent | null>(null);
  const [trialCount, setTrialCount] = useState(
    DEFAULT_TRIAL_EVALUATION_COUNT
  );
  const [activeEvaluatorVersionId, setActiveEvaluatorVersionId] =
    useState("");
  const [compareEvaluatorVersionId, setCompareEvaluatorVersionId] =
    useState("");
  const [evaluatorName, setEvaluatorName] = useState("");
  const [evaluatorAuthor, setEvaluatorAuthor] = useState("本地用户");
  const [evaluatorChangeNote, setEvaluatorChangeNote] = useState("");
  const [evaluatorVersionError, setEvaluatorVersionError] = useState("");
  const [sampleStrategy, setSampleStrategy] =
    useState<DimensionSampleStrategy>("coverage");
  const [sampleCount, setSampleCount] = useState(3);
  const [selectedSampleIds, setSelectedSampleIds] = useState<string[]>([]);
  const [badCaseOverrides, setBadCaseOverrides] = useState<
    Record<string, string | null>
  >({});
  const [humanFeedbackDrafts, setHumanFeedbackDrafts] = useState<
    Record<string, DimensionHumanFeedbackDraft>
  >({});

  const {
    evalResults,
    itemErrors,
    status,
    error,
    genDimensions,
    generatePrompt,
    evaluate,
    cancel,
  } = evaluation;

  const multimodalModels = useMemo(
    () => judgeModels.filter((model) => model.supportsImage),
    [judgeModels]
  );
  const usableEvaluatorVersions = useMemo(
    () =>
      evaluatorVersions
        .filter(isEvaluatorVersionIntact)
        .sort(
          (left, right) =>
            right.createTime - left.createTime || right.version - left.version
        ),
    [evaluatorVersions]
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

  const sampleCandidates = useMemo(
    () => listDimensionSampleCandidates(inputs, results, expectedAnswerKey),
    [expectedAnswerKey, inputs, results]
  );

  const hardRulesAnalysis = useMemo(
    () => analyzeDimensionHardRules(hardRulesText),
    [hardRulesText]
  );

  useEffect(() => {
    setSelectedSampleIds(
      selectRepresentativeSampleIds(
        sampleCandidates,
        sampleStrategy,
        sampleCount
      )
    );
  }, [sampleCandidates, sampleCount, sampleStrategy]);

  const sampleCandidateById = useMemo(
    () => new Map(sampleCandidates.map((candidate) => [candidate.inputId, candidate])),
    [sampleCandidates]
  );

  const effectiveBadCaseReasons = useMemo(() => {
    const reasons: Record<string, string> = {};
    for (const inputId of selectedSampleIds) {
      const override = badCaseOverrides[inputId];
      if (override === null) continue;
      if (typeof override === "string") {
        reasons[inputId] = override;
        continue;
      }
      const candidate = sampleCandidateById.get(inputId);
      if (candidate?.importedBadCase) {
        reasons[inputId] = candidate.importedBadCaseReason;
      }
    }
    return reasons;
  }, [badCaseOverrides, sampleCandidateById, selectedSampleIds]);

  const missingBadCaseReasonIds = useMemo(
    () =>
      selectedSampleIds.filter(
        (inputId) =>
          Object.prototype.hasOwnProperty.call(effectiveBadCaseReasons, inputId) &&
          !effectiveBadCaseReasons[inputId].trim()
      ),
    [effectiveBadCaseReasons, selectedSampleIds]
  );

  const baseGenerationSamples = useMemo(
    () =>
      buildDimensionGenerationSamples({
        inputs,
        results,
        selectedInputIds: selectedSampleIds,
        expectedAnswerKey,
        badCaseReasons: effectiveBadCaseReasons,
      }),
    [
      effectiveBadCaseReasons,
      expectedAnswerKey,
      inputs,
      results,
      selectedSampleIds,
    ]
  );

  const generationSampleById = useMemo(
    () =>
      new Map(
        baseGenerationSamples.map((sample) => [sample.inputId, sample])
      ),
    [baseGenerationSamples]
  );

  const humanFeedbackAnalysisByInputId = useMemo(() => {
    const analyses = new Map<
      string,
      ReturnType<typeof analyzeDimensionHumanFeedbackDraft>
    >();
    for (const sample of baseGenerationSamples) {
      analyses.set(
        sample.inputId,
        analyzeDimensionHumanFeedbackDraft(
          humanFeedbackDrafts[sample.inputId],
          sample.outputs
        )
      );
    }
    return analyses;
  }, [baseGenerationSamples, humanFeedbackDrafts]);

  const humanFeedbackErrorIds = useMemo(
    () =>
      baseGenerationSamples
        .filter(
          (sample) =>
            humanFeedbackAnalysisByInputId.get(sample.inputId)?.error
        )
        .map((sample) => sample.inputId),
    [baseGenerationSamples, humanFeedbackAnalysisByInputId]
  );

  const selectedGenerationSamples = useMemo(
    () =>
      baseGenerationSamples.map((sample) => {
        const feedback = humanFeedbackAnalysisByInputId.get(
          sample.inputId
        )?.feedback;
        return feedback ? { ...sample, humanFeedback: feedback } : sample;
      }),
    [baseGenerationSamples, humanFeedbackAnalysisByInputId]
  );

  const selectedHumanFeedbackCount = selectedSampleIds.filter(
    (inputId) => humanFeedbackDrafts[inputId]
  ).length;

  const expectedCoverage = useMemo(() => {
    const scopedInputs = inputs.filter((input) =>
      effectiveScopeIds.includes(input.id)
    );
    const withExpected = scopedInputs.filter(
      (input) => resolveExpectedAnswer(input, expectedAnswerKey).value
    );
    return { total: scopedInputs.length, matched: withExpected.length };
  }, [effectiveScopeIds, expectedAnswerKey, inputs]);

  const judgeEligibleInputIds = useMemo(() => {
    if (evaluationMode === "comparison") return effectiveScopeIds;
    const eligible = new Set(
      inputs
        .filter((input) =>
          Boolean(resolveExpectedAnswer(input, expectedAnswerKey).value)
        )
        .map((input) => input.id)
    );
    return effectiveScopeIds.filter((inputId) => eligible.has(inputId));
  }, [effectiveScopeIds, evaluationMode, expectedAnswerKey, inputs]);

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
  const trialPlan = buildEvaluationExecutionPlan({
    intent: "trial",
    eligibleInputIds: judgeEligibleInputIds,
    trialCount,
  });
  const formalPlan = buildEvaluationExecutionPlan({
    intent: "formal",
    eligibleInputIds: judgeEligibleInputIds,
  });
  const confirmationPlan =
    confirmationIntent === "trial" ? trialPlan : formalPlan;

  // AI 按测评需求生成候选维度 → 追加到待办列表（默认不勾选，由用户自行挑选）。
  // 再次点击为「追加一批」：不覆盖已有维度（尤其已勾选的），按维度名去重，总数封顶 15 条。
  const handleGenDimensions = async () => {
    if (
      !scenario.trim() ||
      !businessScenario.trim() ||
      !judgeModelId ||
      selectedGenerationSamples.length === 0 ||
      hardRulesAnalysis.error ||
      missingBadCaseReasonIds.length > 0 ||
      humanFeedbackErrorIds.length > 0
    ) {
      return;
    }
    if (candidates.length >= MAX_DIMENSIONS) return;
    try {
      const generated = await genDimensions(
        {
          objective: scenario.trim(),
          businessScenario: businessScenario.trim(),
          taskType: dimensionTaskType,
          hardRules: hardRulesAnalysis.rules,
          samples: selectedGenerationSamples,
        },
        judgeModelId
      );
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
          rebalanceSelectedCandidateWeights(
            REFERENCE_DEFAULT_DIMENSIONS.map((dimension) => ({
              ...dimension,
              selected: true,
            }))
          )
        );
      }
    }
  };

  const toggleCandidate = (index: number) => {
    setCandidates((prev) =>
      rebalanceSelectedCandidateWeights(
        prev.map((dim, idx) =>
          idx === index ? { ...dim, selected: !dim.selected } : dim
        )
      )
    );
  };

  const updateCandidate = (index: number, patch: Partial<EvalDimension>) => {
    setCandidates((prev) =>
      prev.map((dim, idx) => (idx === index ? { ...dim, ...patch } : dim))
    );
  };

  const updateCandidateScoreLevel = (
    index: number,
    score: (typeof REQUIRED_RUBRIC_SCORES)[number],
    criteria: string
  ) => {
    setCandidates((prev) =>
      prev.map((dimension, candidateIndex) => {
        if (candidateIndex !== index) return dimension;
        const existing = new Map(
          (dimension.scoreLevels ?? []).map((level) => [level.score, level])
        );
        return {
          ...dimension,
          scoreLevels: REQUIRED_RUBRIC_SCORES.map((requiredScore) => ({
            score: requiredScore,
            criteria:
              requiredScore === score
                ? criteria
                : existing.get(requiredScore)?.criteria ?? "",
          })),
        };
      })
    );
  };

  const updateCandidateEvidence = (index: number, value: string) => {
    updateCandidate(index, {
      evidenceRequirements: value ? value.split(/\r?\n/) : [],
    });
  };

  const fillCandidateRubricTemplate = (index: number) => {
    setCandidates((prev) =>
      prev.map((dimension, candidateIndex) => {
        if (candidateIndex !== index) return dimension;
        const name = dimension.name.trim();
        const definition = dimension.desc?.trim() ?? "";
        if (!name || !definition) return dimension;
        return {
          ...createDefinitionBasedRubric(name, definition),
          weight: dimension.weight,
          vetoThreshold: dimension.vetoThreshold,
          selected: dimension.selected,
        };
      })
    );
  };

  const removeCandidate = (index: number) => {
    setCandidates((prev) =>
      rebalanceSelectedCandidateWeights(
        prev.filter((_, idx) => idx !== index)
      )
    );
  };

  // 手动添加一个维度（默认勾选，等待用户填名），同样受 15 条上限约束。
  const addCandidate = () => {
    setCandidates((prev) =>
      prev.length >= MAX_DIMENSIONS
        ? prev
        : rebalanceSelectedCandidateWeights([
            ...prev,
            { ...createEmptyEvaluationRubric(), selected: true },
          ])
    );
  };

  const rebalanceCandidateWeights = () => {
    setCandidates((prev) => rebalanceSelectedCandidateWeights(prev));
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

  const executeEvaluation = async (intent: EvaluationExecutionIntent) => {
    if (!evalPrompt.trim() || !judgeModelId) return;
    const executionPlan = intent === "trial" ? trialPlan : formalPlan;
    if (executionPlan.inputIds.length === 0) return;
    if (validDimensions.length === 0) return;
    setConfirmOpen(false);
    setLastExecutionIntent(intent);
    const collected = await evaluate({
      inputs,
      results,
      scopeInputIds: executionPlan.inputIds,
      evalPrompt: evalPrompt.trim(),
      modelId: judgeModelId,
      dimensions: validDimensions,
      evaluationMode,
      expectedAnswerKey,
      concurrency,
    });
    // 试评只展示当前页结果；只有正式评价才生成 EvaluationRecord。
    if (intent === "formal" && collected.length > 0) {
      onEvaluationComplete?.({
        evalModelId: judgeModelId,
        userRequirement: scenario.trim(),
        dimensions: validDimensions,
        evalPrompt: evalPrompt.trim(),
        evaluationMode,
        expectedAnswerColumn:
          evaluationMode === "reference" ? expectedAnswerKey : undefined,
        evaluatorVersionId: evaluatorVersionBound
          ? activeEvaluatorVersion?.id
          : undefined,
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
    setConfirmationIntent("formal");
    setConfirmOpen(true);
  };

  const handleTrialEvaluate = () => {
    if (!canEvaluate || trialPlan.inputIds.length === 0) return;
    setConfirmationIntent("trial");
    setConfirmOpen(true);
  };

  const toggleSelectedInput = (inputId: string) => {
    setSelectedInputIds((prev) =>
      prev.includes(inputId)
        ? prev.filter((id) => id !== inputId)
        : [...prev, inputId]
    );
  };

  const toggleSelectedSample = (inputId: string) => {
    setSelectedSampleIds((current) =>
      current.includes(inputId)
        ? current.filter((id) => id !== inputId)
        : current.length >= MAX_DIMENSION_SAMPLES
          ? current
          : [...current, inputId]
    );
  };

  const toggleBadCase = (inputId: string) => {
    const isMarked = Object.prototype.hasOwnProperty.call(
      effectiveBadCaseReasons,
      inputId
    );
    const importedReason =
      sampleCandidateById.get(inputId)?.importedBadCaseReason ?? "";
    setBadCaseOverrides((current) => ({
      ...current,
      [inputId]: isMarked ? null : importedReason,
    }));
  };

  const updateBadCaseReason = (inputId: string, value: string) => {
    setBadCaseOverrides((current) => ({ ...current, [inputId]: value }));
  };

  const toggleHumanFeedback = (inputId: string) => {
    setHumanFeedbackDrafts((current) => {
      if (current[inputId]) {
        const next = { ...current };
        delete next[inputId];
        return next;
      }
      return {
        ...current,
        [inputId]: { mode: "scores", values: {}, note: "" },
      };
    });
  };

  const updateHumanFeedbackMode = (
    inputId: string,
    mode: DimensionHumanFeedbackMode
  ) => {
    setHumanFeedbackDrafts((current) => ({
      ...current,
      [inputId]: {
        mode,
        values: {},
        note: current[inputId]?.note ?? "",
      },
    }));
  };

  const updateHumanFeedbackValue = (
    inputId: string,
    targetId: string,
    value: string
  ) => {
    setHumanFeedbackDrafts((current) => {
      const draft = current[inputId];
      if (!draft) return current;
      return {
        ...current,
        [inputId]: {
          ...draft,
          values: { ...draft.values, [targetId]: value },
        },
      };
    });
  };

  const updateHumanFeedbackNote = (inputId: string, note: string) => {
    setHumanFeedbackDrafts((current) => {
      const draft = current[inputId];
      if (!draft) return current;
      return { ...current, [inputId]: { ...draft, note } };
    });
  };

  const selectedCandidateCount = candidates.filter(
    (candidate) => candidate.selected
  ).length;
  const selectedVetoCount = candidates.filter(
    (candidate) =>
      candidate.selected && candidate.vetoThreshold !== undefined
  ).length;
  const rubricAnalysisByCandidateIndex = new Map<
    number,
    ReturnType<typeof analyzeEvaluationRubric>
  >();
  const selectedDimensions: EvalDimension[] = [];
  candidates.forEach((candidate, index) => {
    if (!candidate.selected) return;
    const analysis = analyzeEvaluationRubric(candidate);
    rubricAnalysisByCandidateIndex.set(index, analysis);
    if (analysis.dimension) selectedDimensions.push(analysis.dimension);
  });
  const hasRubricErrors = Array.from(
    rubricAnalysisByCandidateIndex.values()
  ).some((analysis) => analysis.issues.length > 0);
  const evaluatorPolicyAnalysis = analyzeEvaluatorPolicy(
    candidates.filter((candidate) => candidate.selected)
  );
  const evaluatorPolicyIssues = evaluatorPolicyAnalysis.issues.filter(
    (issue) => issue.field !== "rubric"
  );
  const hasEvaluatorPolicyErrors = evaluatorPolicyAnalysis.issues.length > 0;
  const dimensionAnalysis = analyzeNewEvaluationDimensions(
    hasEvaluatorPolicyErrors ? [] : evaluatorPolicyAnalysis.dimensions,
    newDimensionContext?.existingDimensions ?? []
  );
  const validDimensions = dimensionAnalysis.dimensions;
  // Name conflicts must surface before the remaining Rubric fields are complete.
  const duplicateDimensionNames = analyzeNewEvaluationDimensions(
    candidates
      .filter((candidate) => candidate.selected && candidate.name.trim())
      .map((candidate) => ({ name: candidate.name, desc: candidate.desc })),
    newDimensionContext?.existingDimensions ?? []
  ).duplicateNames;
  const canConfirmPolicy =
    selectedCandidateCount > 0 &&
    !hasRubricErrors &&
    !hasEvaluatorPolicyErrors &&
    duplicateDimensionNames.length === 0 &&
    validDimensions.length === selectedCandidateCount;
  const currentPolicyFingerprint = canConfirmPolicy
    ? buildEvaluatorPolicyFingerprint(validDimensions)
    : "";
  const policyConfirmed =
    Boolean(currentPolicyFingerprint) &&
    currentPolicyFingerprint === confirmedPolicyFingerprint;
  const currentEvaluatorDraft = {
    evalModelId: judgeModelId,
    userRequirement: scenario,
    dimensions: validDimensions,
    evalPrompt,
    evaluationMode,
    expectedAnswerColumn:
      evaluationMode === "reference" ? expectedAnswerKey : undefined,
  };
  let currentEvaluatorDefinitionFingerprint = "";
  if (
    policyConfirmed &&
    judgeReady &&
    evalPrompt.trim() &&
    scenario.trim() &&
    validDimensions.length > 0
  ) {
    try {
      currentEvaluatorDefinitionFingerprint =
        buildEvaluatorDefinitionFingerprint(currentEvaluatorDraft);
    } catch {
      currentEvaluatorDefinitionFingerprint = "";
    }
  }
  const activeEvaluatorVersion = usableEvaluatorVersions.find(
    (version) => version.id === activeEvaluatorVersionId
  );
  const evaluatorVersionBound = Boolean(
    activeEvaluatorVersion &&
      currentEvaluatorDefinitionFingerprint &&
      activeEvaluatorVersion.definitionFingerprint ===
        currentEvaluatorDefinitionFingerprint
  );
  const activeEvaluatorFamilyVersions = activeEvaluatorVersion
    ? usableEvaluatorVersions.filter(
        (version) => version.evaluatorId === activeEvaluatorVersion.evaluatorId
      )
    : [];
  const latestEvaluatorVersion = activeEvaluatorFamilyVersions.reduce<
    EvaluatorVersion | undefined
  >(
    (latest, version) =>
      !latest || version.version > latest.version ? version : latest,
    undefined
  );
  const nextEvaluatorVersion =
    (latestEvaluatorVersion?.version ?? 0) + 1;
  const usesHumanFeedback = selectedGenerationSamples.some(
    (sample) => sample.humanFeedback
  );

  const reachedDimensionLimit = candidates.length >= MAX_DIMENSIONS;
  const canGenDimensions =
    enabled &&
    judgeReady &&
    !!scenario.trim() &&
    !!businessScenario.trim() &&
    !!judgeModelId &&
    selectedGenerationSamples.length > 0 &&
    !hardRulesAnalysis.error &&
    missingBadCaseReasonIds.length === 0 &&
    humanFeedbackErrorIds.length === 0 &&
    !isGeneratingDim &&
    !reachedDimensionLimit;
  const canGenerate =
    enabled &&
    judgeReady &&
    !!scenario.trim() &&
    !!judgeModelId &&
    validDimensions.length > 0 &&
    !hasRubricErrors &&
    !hasEvaluatorPolicyErrors &&
    duplicateDimensionNames.length === 0 &&
    policyConfirmed &&
    !isGenerating;
  const canEvaluate =
    enabled &&
    judgeReady &&
    !!evalPrompt.trim() &&
    !!judgeModelId &&
    validDimensions.length > 0 &&
    !hasRubricErrors &&
    !hasEvaluatorPolicyErrors &&
    duplicateDimensionNames.length === 0 &&
    policyConfirmed &&
    (evaluationMode === "comparison" || expectedCoverage.matched > 0) &&
    formalPlan.inputIds.length > 0 &&
    !isRunning &&
    (!newDimensionContext ||
      status !== "done" ||
      lastExecutionIntent !== "formal");
  const canSaveEvaluatorVersion =
    Boolean(currentEvaluatorDefinitionFingerprint) &&
    Boolean(evaluatorName.trim()) &&
    Boolean(evaluatorAuthor.trim()) &&
    !evaluatorVersionBound;

  const defaultComparisonVersionId = (version: EvaluatorVersion): string => {
    const family = usableEvaluatorVersions
      .filter(
        (candidate) =>
          candidate.evaluatorId === version.evaluatorId &&
          candidate.id !== version.id
      )
      .sort((left, right) => right.version - left.version);
    return (
      family.find((candidate) => candidate.version < version.version)?.id ??
      family[0]?.id ??
      ""
    );
  };

  const applyEvaluatorVersion = (
    version: EvaluatorVersion,
    comparisonVersionId?: string
  ) => {
    const draft = cloneEvaluatorVersionDraft(version);
    setEnabled(true);
    setJudgeModelId(draft.evalModelId);
    setScenario(draft.userRequirement);
    setCandidates(
      draft.dimensions.map((dimension) => ({
        ...dimension,
        selected: true,
      }))
    );
    setEvalPrompt(draft.evalPrompt);
    setEvaluationMode(draft.evaluationMode);
    setExpectedAnswerKey(
      draft.expectedAnswerColumn ?? AUTO_EXPECTED_ANSWER_KEY
    );
    setConfirmedPolicyFingerprint(version.policyFingerprint);
    setActiveEvaluatorVersionId(version.id);
    setCompareEvaluatorVersionId(
      comparisonVersionId ?? defaultComparisonVersionId(version)
    );
    setEvaluatorName(version.name);
    setEvaluatorAuthor(version.createdBy);
    setEvaluatorChangeNote("");
  };

  const handleEvaluatorVersionSelection = (versionId: string) => {
    setEvaluatorVersionError("");
    if (!versionId) {
      setActiveEvaluatorVersionId("");
      setCompareEvaluatorVersionId("");
      setEvaluatorName("");
      setEvaluatorChangeNote("");
      return;
    }
    const version = usableEvaluatorVersions.find(
      (item) => item.id === versionId
    );
    if (!version) {
      setEvaluatorVersionError("Evaluator 版本不存在或完整性校验失败");
      return;
    }
    try {
      applyEvaluatorVersion(version);
    } catch (versionError) {
      setEvaluatorVersionError(
        versionError instanceof Error
          ? versionError.message
          : "Evaluator 版本加载失败"
      );
    }
  };

  const handleSaveEvaluatorVersion = () => {
    if (!canSaveEvaluatorVersion) return;
    try {
      const version = createEvaluatorVersion({
        ...currentEvaluatorDraft,
        existingVersions: evaluatorVersions,
        evaluatorId: activeEvaluatorVersion?.evaluatorId,
        name: evaluatorName,
        createdBy: evaluatorAuthor,
        changeNote: evaluatorChangeNote,
        applicableTaskId: sourceTaskId,
      });
      onSaveEvaluatorVersion(version);
      applyEvaluatorVersion(version, activeEvaluatorVersion?.id);
      setEvaluatorVersionError("");
    } catch (versionError) {
      setEvaluatorVersionError(
        versionError instanceof Error
          ? versionError.message
          : "Evaluator 版本保存失败"
      );
    }
  };

  const handleRestoreEvaluatorVersion = () => {
    if (!activeEvaluatorVersion || !evaluatorAuthor.trim() || isRunning) return;
    try {
      const restoredVersion = restoreEvaluatorVersion({
        sourceVersion: activeEvaluatorVersion,
        existingVersions: evaluatorVersions,
        createdBy: evaluatorAuthor,
        changeNote: evaluatorChangeNote,
        applicableTaskId: sourceTaskId,
      });
      onSaveEvaluatorVersion(restoredVersion);
      applyEvaluatorVersion(restoredVersion, activeEvaluatorVersion.id);
      setEvaluatorVersionError("");
    } catch (versionError) {
      setEvaluatorVersionError(
        versionError instanceof Error
          ? versionError.message
          : "Evaluator 历史版本恢复失败"
      );
    }
  };

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
          {!newDimensionContext && (
            <div className="rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-950">
              <p className="font-semibold">已复用该批次的模型或算法输出</p>
              <p className="mt-1 text-xs leading-5 text-sky-800">
                试评与正式评价都只调用裁判模型，不会重新运行被测目标。试评结果仅在当前页面预览，正式评价才会写入 AI 历史评价。
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
              评测目标（你想判断什么）
            </label>
            <textarea
              aria-label="评测目标"
              value={scenario}
              onChange={(event) => setScenario(event.target.value)}
              disabled={judgeDisabled}
              maxLength={MAX_DIMENSION_OBJECTIVE_LENGTH}
              rows={2}
              placeholder="例如：判断客服回复是否准确解决问题，并且信息完整、表达自然。"
              className="w-full resize-y rounded-md border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-100"
            />
          </div>

          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr),220px]">
            <label className="flex flex-col gap-1.5 text-sm font-medium text-gray-700">
              业务场景
              <textarea
                aria-label="业务场景"
                value={businessScenario}
                onChange={(event) => setBusinessScenario(event.target.value)}
                disabled={judgeDisabled}
                maxLength={MAX_DIMENSION_SCENARIO_LENGTH}
                rows={2}
                placeholder="例如：电商售后客服，回复将直接发送给消费者。"
                className="w-full resize-y rounded-md border border-gray-300 px-3 py-2 text-sm font-normal disabled:bg-gray-100"
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-medium text-gray-700">
              任务类型
              <select
                aria-label="任务类型"
                value={dimensionTaskType}
                onChange={(event) =>
                  setDimensionTaskType(event.target.value as DimensionTaskType)
                }
                disabled={judgeDisabled}
                className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-normal disabled:bg-gray-100"
              >
                {Object.entries(DIMENSION_TASK_TYPE_LABELS).map(
                  ([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  )
                )}
              </select>
            </label>
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

          <div className="flex flex-col gap-2 rounded-md border border-amber-200 bg-amber-50/60 p-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-sm font-medium text-slate-800">
                  硬规则（可选）
                </p>
                <p className="mt-0.5 text-xs text-slate-600">
                  每行只写一条必须满足的业务规则，不解析 JSON，也不猜测段落结构。
                </p>
              </div>
              <span className="shrink-0 rounded-full bg-white px-2 py-1 text-xs text-amber-800">
                {hardRulesAnalysis.rules.length}/{MAX_DIMENSION_HARD_RULES} 条
              </span>
            </div>
            <textarea
              aria-label="维度生成硬规则"
              aria-invalid={Boolean(hardRulesAnalysis.error)}
              value={hardRulesText}
              onChange={(event) => setHardRulesText(event.target.value)}
              disabled={judgeDisabled}
              rows={3}
              placeholder={"例如：不得承诺未确认的退款时效\n例如：涉及账户信息时必须先完成身份核验"}
              className="w-full resize-y rounded-md border border-amber-200 bg-white px-3 py-2 text-sm disabled:bg-gray-100"
            />
            {hardRulesAnalysis.error ? (
              <p role="alert" className="text-xs font-medium text-red-700">
                {hardRulesAnalysis.error}
              </p>
            ) : (
              <p className="text-xs text-slate-600">
                重复规则会按大小写、空白归一化后合并；规则只用于生成候选维度，不会自动启动评价。
              </p>
            )}
          </div>

          <div className="flex flex-col gap-3 rounded-md border border-cyan-200 bg-cyan-50/50 p-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-sm font-medium text-slate-800">
                  代表性输入输出样本
                </p>
                <p className="mt-0.5 text-xs text-slate-500">
                  当前由通用模型结合内部预设与下列样本生成结构化 Rubrics，OpenJudge 尚未接入。
                </p>
                <p
                  aria-label="维度生成模式"
                  className="mt-1 text-xs font-medium text-cyan-800"
                >
                  当前模式：
                  {usesHumanFeedback
                    ? "人工反馈上下文（一次生成，非 Iterative）"
                    : "Simple Rubrics（无人工评分或排序）"}
                </p>
              </div>
              <span className="rounded-full bg-white px-2 py-1 text-xs text-cyan-700">
                已选 {selectedGenerationSamples.length}/{sampleCandidates.length} 条 · Bad Case {Object.keys(effectiveBadCaseReasons).length} 条 · 人工反馈 {selectedHumanFeedbackCount} 条
              </span>
            </div>

            <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr),140px]">
              <label className="flex flex-col gap-1 text-xs text-slate-600">
                抽样策略
                <select
                  aria-label="代表性样本策略"
                  value={sampleStrategy}
                  onChange={(event) =>
                    setSampleStrategy(
                      event.target.value as DimensionSampleStrategy
                    )
                  }
                  className="rounded-md border border-cyan-200 bg-white px-2 py-1.5 text-sm text-slate-700"
                >
                  {Object.entries(DIMENSION_SAMPLE_STRATEGY_LABELS).map(
                    ([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    )
                  )}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs text-slate-600">
                样本数量（最多 {MAX_DIMENSION_SAMPLES}）
                <input
                  aria-label="代表性样本数量"
                  type="number"
                  min={1}
                  max={MAX_DIMENSION_SAMPLES}
                  value={sampleCount}
                  onChange={(event) =>
                    setSampleCount(
                      Math.min(
                        MAX_DIMENSION_SAMPLES,
                        Math.max(
                          1,
                          Math.floor(Number(event.target.value) || 1)
                        )
                      )
                    )
                  }
                  className="rounded-md border border-cyan-200 bg-white px-2 py-1.5 text-sm text-slate-700"
                />
              </label>
            </div>

            {selectedSampleIds.length === 0 ? (
              <p className="rounded-md border border-dashed border-cyan-200 bg-white px-3 py-3 text-center text-xs text-slate-400">
                当前没有可发送的输入输出样本，不能生成评价维度。
              </p>
            ) : (
              <ul className="grid gap-2 md:grid-cols-2">
                {selectedSampleIds.map((inputId) => {
                  const candidate = sampleCandidateById.get(inputId);
                  if (!candidate) return null;
                  const isBadCase = Object.prototype.hasOwnProperty.call(
                    effectiveBadCaseReasons,
                    inputId
                  );
                  const importedBadCaseActive =
                    candidate.importedBadCase &&
                    badCaseOverrides[inputId] === undefined;
                  const generationSample = generationSampleById.get(inputId);
                  const humanFeedbackDraft = humanFeedbackDrafts[inputId];
                  const humanFeedbackError =
                    humanFeedbackAnalysisByInputId.get(inputId)?.error;
                  return (
                    <li
                      key={inputId}
                      className={`rounded-md border bg-white p-2 text-xs ${
                        isBadCase ? "border-rose-200" : "border-cyan-100"
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <input
                          type="checkbox"
                          aria-label={`发送代表性样本 Case ${candidate.index + 1}`}
                          checked
                          onChange={() => toggleSelectedSample(inputId)}
                          className="mt-0.5"
                        />
                        <div className="min-w-0 flex-1">
                          <span className="block truncate font-medium text-slate-700">
                            Case {candidate.index + 1}：
                            {candidate.prompt || "（空 prompt）"}
                          </span>
                          <span className="mt-1 block text-slate-500">
                            成功 {candidate.successCount} · 失败 {candidate.errorCount} ·
                            {candidate.hasExpectedAnswer
                              ? " 有标准答案"
                              : " 无标准答案"}
                          </span>
                          {importedBadCaseActive && (
                            <span className="mt-1 inline-flex rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-medium text-rose-700">
                              数据集标记
                            </span>
                          )}
                        </div>
                        <div className="flex shrink-0 flex-col gap-1">
                          <button
                            type="button"
                            aria-pressed={isBadCase}
                            aria-label={`${isBadCase ? "取消" : "标记"} Case ${candidate.index + 1} Bad Case`}
                            onClick={() => toggleBadCase(inputId)}
                            className={`rounded-md border px-2 py-1 font-medium transition ${
                              isBadCase
                                ? "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
                                : "border-slate-200 text-slate-600 hover:bg-slate-50"
                            }`}
                          >
                            {isBadCase ? "取消 Bad Case" : "标记 Bad Case"}
                          </button>
                          <button
                            type="button"
                            aria-pressed={Boolean(humanFeedbackDraft)}
                            aria-label={`${humanFeedbackDraft ? "移除" : "添加"} Case ${candidate.index + 1} 人工反馈`}
                            onClick={() => toggleHumanFeedback(inputId)}
                            className={`rounded-md border px-2 py-1 font-medium transition ${
                              humanFeedbackDraft
                                ? "border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100"
                                : "border-slate-200 text-slate-600 hover:bg-slate-50"
                            }`}
                          >
                            {humanFeedbackDraft ? "移除人工反馈" : "添加人工反馈"}
                          </button>
                        </div>
                      </div>
                      {isBadCase && (
                        <label className="mt-2 flex flex-col gap-1 border-t border-rose-100 pt-2 text-rose-800">
                          Bad Case 原因（必填）
                          <textarea
                            aria-label={`Case ${candidate.index + 1} Bad Case 原因`}
                            aria-invalid={
                              !effectiveBadCaseReasons[inputId].trim()
                            }
                            value={effectiveBadCaseReasons[inputId]}
                            onChange={(event) =>
                              updateBadCaseReason(inputId, event.target.value)
                            }
                            maxLength={MAX_DIMENSION_BAD_CASE_REASON_LENGTH}
                            rows={2}
                            placeholder="说明这条输出为什么具有代表性风险，不要粘贴密钥或完整日志。"
                            className="resize-y rounded-md border border-rose-200 bg-white px-2 py-1.5 text-slate-700"
                          />
                        </label>
                      )}
                      {humanFeedbackDraft && generationSample && (
                        <div className="mt-2 flex flex-col gap-2 border-t border-sky-100 pt-2 text-sky-900">
                          <div className="flex flex-wrap items-end justify-between gap-2">
                            <label className="flex min-w-[160px] flex-col gap-1">
                              人工反馈模式
                              <select
                                aria-label={`Case ${candidate.index + 1} 人工反馈模式`}
                                value={humanFeedbackDraft.mode}
                                onChange={(event) =>
                                  updateHumanFeedbackMode(
                                    inputId,
                                    event.target.value as DimensionHumanFeedbackMode
                                  )
                                }
                                className="rounded-md border border-sky-200 bg-white px-2 py-1.5 text-slate-700"
                              >
                                {Object.entries(
                                  DIMENSION_HUMAN_FEEDBACK_MODE_LABELS
                                ).map(([value, label]) => (
                                  <option
                                    key={value}
                                    value={value}
                                    disabled={
                                      value === "ranking" &&
                                      generationSample.outputs.length < 2
                                    }
                                  >
                                    {label}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <span className="text-[11px] text-sky-700">
                              {humanFeedbackDraft.mode === "scores"
                                ? "0–10 分，最多 1 位小数"
                                : "1 为最佳，名次不得重复"}
                            </span>
                          </div>
                          <div className="grid gap-2 sm:grid-cols-2">
                            {generationSample.outputs.map((output) => (
                              <label
                                key={output.targetId}
                                className="flex flex-col gap-1 text-slate-700"
                              >
                                {output.targetName} · {output.status === "success" ? "成功" : "失败"}
                                <input
                                  aria-label={`Case ${candidate.index + 1} ${output.targetName} ${humanFeedbackDraft.mode === "scores" ? "人工评分" : "偏好名次"}`}
                                  type="number"
                                  min={humanFeedbackDraft.mode === "scores" ? 0 : 1}
                                  max={
                                    humanFeedbackDraft.mode === "scores"
                                      ? 10
                                      : generationSample.outputs.length
                                  }
                                  step={
                                    humanFeedbackDraft.mode === "scores" ? 0.1 : 1
                                  }
                                  value={
                                    humanFeedbackDraft.values[output.targetId] ?? ""
                                  }
                                  onChange={(event) =>
                                    updateHumanFeedbackValue(
                                      inputId,
                                      output.targetId,
                                      event.target.value
                                    )
                                  }
                                  placeholder={
                                    humanFeedbackDraft.mode === "scores"
                                      ? "例如 8.5"
                                      : `1–${generationSample.outputs.length}`
                                  }
                                  className="rounded-md border border-sky-200 bg-white px-2 py-1.5"
                                />
                              </label>
                            ))}
                          </div>
                          <label className="flex flex-col gap-1 text-slate-700">
                            人工反馈备注（可选）
                            <textarea
                              aria-label={`Case ${candidate.index + 1} 人工反馈备注`}
                              value={humanFeedbackDraft.note}
                              onChange={(event) =>
                                updateHumanFeedbackNote(inputId, event.target.value)
                              }
                              maxLength={MAX_DIMENSION_HUMAN_FEEDBACK_NOTE_LENGTH}
                              rows={2}
                              placeholder="说明评分或排序依据，不要粘贴密钥或完整日志。"
                              className="resize-y rounded-md border border-sky-200 bg-white px-2 py-1.5"
                            />
                          </label>
                          {humanFeedbackError && (
                            <p role="alert" className="font-medium text-red-700">
                              {humanFeedbackError}
                            </p>
                          )}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
            {missingBadCaseReasonIds.length > 0 && (
              <p role="alert" className="text-xs font-medium text-red-700">
                已标记的 Bad Case 必须填写原因，补充完成后才能生成维度。
              </p>
            )}
            <p className="text-xs text-slate-500">
              仅发送截断后的文字、规则、Bad Case 原因、人工评分或排序、输出状态与图片数量，不发送原始图片、base64 或完整错误文本。OpenJudge 与 Iterative Rubrics Generator 尚未接入，当前人工反馈只作为受控维度生成上下文。
            </p>
          </div>

          <div className="flex flex-col gap-2.5 rounded-md border border-indigo-100 bg-indigo-50/40 p-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-gray-700">
                评价维度与策略（Judge 独立打分，平台确定性汇总）
              </label>
              <span className="text-xs text-gray-500">
                已勾选 {selectedCandidateCount} 个 · Rubric 完整 {selectedDimensions.length} 个
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
                className="rounded-md bg-indigo-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-800 disabled:cursor-not-allowed disabled:bg-gray-300"
              >
                {isGeneratingDim
                  ? "AI 生成维度中…"
                  : candidates.length === 0
                    ? "AI 生成评价维度"
                    : "再来一批新维度"}
              </button>
              {(!scenario.trim() ||
                !businessScenario.trim() ||
                selectedGenerationSamples.length === 0 ||
                hardRulesAnalysis.error ||
                missingBadCaseReasonIds.length > 0 ||
                humanFeedbackErrorIds.length > 0) && (
                <span className="text-xs text-gray-500">
                  请先补齐评测上下文，并修正规则、Bad Case 或人工反馈提示
                </span>
              )}
              {reachedDimensionLimit && (
                <span className="text-xs text-amber-600">
                  维度已达上限（{MAX_DIMENSIONS} 条），如需新增请先删除部分
                </span>
              )}
            </div>

            {candidates.length === 0 ? (
              <p className="rounded-md border border-dashed border-gray-200 bg-white px-3 py-3 text-center text-xs text-gray-500">
                点击「AI 生成评价维度」让模型按你的需求生成结构化候选 Rubrics，
                <span className="font-medium text-gray-500">勾选你想考察的</span>
                ；觉得不够可点「再来一批新维度」继续追加，也可手动添加。
              </p>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {candidates.map((candidate, index) => {
                  const displayAnalysis =
                    rubricAnalysisByCandidateIndex.get(index) ??
                    analyzeEvaluationRubric(candidate);
                  const rubricMessages = candidate.selected
                    ? Array.from(
                        new Set(
                          displayAnalysis.issues.map((issue) => issue.message)
                        )
                      )
                    : [];
                  const canFillTemplate = Boolean(
                    candidate.name.trim() && candidate.desc?.trim()
                  );
                  return (
                    <li
                      key={index}
                      className={`rounded-md border p-2 transition ${
                        candidate.selected
                          ? "border-indigo-200 bg-white"
                          : "border-gray-200 bg-gray-50 opacity-70"
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <input
                          aria-label={`选择维度 ${candidate.name || index + 1}`}
                          type="checkbox"
                          checked={candidate.selected}
                          onChange={() => toggleCandidate(index)}
                          disabled={judgeDisabled}
                          className="mt-1 h-4 w-4 shrink-0 cursor-pointer accent-indigo-600"
                        />
                        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                          <input
                            aria-label={`维度 ${index + 1} 名称`}
                            type="text"
                            maxLength={MAX_RUBRIC_NAME_LENGTH}
                            value={candidate.name}
                            onChange={(event) =>
                              updateCandidate(index, { name: event.target.value })
                            }
                            disabled={judgeDisabled}
                            placeholder="维度名（如 准确性）"
                            className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm font-medium disabled:bg-gray-100"
                          />
                          <textarea
                            aria-label={`维度 ${index + 1} 说明`}
                            maxLength={MAX_RUBRIC_DEFINITION_LENGTH}
                            value={candidate.desc ?? ""}
                            onChange={(event) =>
                              updateCandidate(index, { desc: event.target.value })
                            }
                            disabled={judgeDisabled}
                            rows={2}
                            placeholder="清晰定义：说明该维度具体考察什么"
                            className="w-full resize-y rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-600 disabled:bg-gray-100"
                          />
                          <div className="flex flex-wrap items-center gap-2 text-[11px]">
                            <span
                              className={`rounded-full px-2 py-0.5 font-medium ${
                                displayAnalysis.dimension
                                  ? "bg-emerald-50 text-emerald-700"
                                  : "bg-amber-50 text-amber-700"
                              }`}
                            >
                              {displayAnalysis.dimension
                                ? "Rubric 完整"
                                : "Rubric 待补"}
                            </span>
                            {!displayAnalysis.dimension && canFillTemplate && (
                              <button
                                type="button"
                                aria-label={`按定义补齐维度 ${index + 1} Rubric`}
                                onClick={() => fillCandidateRubricTemplate(index)}
                                disabled={judgeDisabled}
                                className="rounded-md border border-indigo-200 px-2 py-0.5 font-medium text-indigo-700 hover:bg-indigo-50 disabled:opacity-40"
                              >
                                按定义补齐模板
                              </button>
                            )}
                          </div>
                          <div className="grid gap-2 rounded-md border border-blue-100 bg-blue-50/60 p-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
                            <label className="flex flex-col gap-1 text-[11px] font-medium text-slate-700">
                              权重（%）
                              <input
                                aria-label={`维度 ${index + 1} 权重`}
                                type="number"
                                min="0.01"
                                max="100"
                                step="0.01"
                                value={candidate.weight ?? ""}
                                onChange={(event) =>
                                  updateCandidate(index, {
                                    weight:
                                      event.target.value === ""
                                        ? undefined
                                        : Number(event.target.value),
                                  })
                                }
                                disabled={judgeDisabled || !candidate.selected}
                                className="rounded-md border border-blue-200 bg-white px-2 py-1 text-sm font-semibold text-blue-900 disabled:bg-gray-100 disabled:text-gray-400"
                              />
                            </label>
                            <div className="flex flex-col gap-1 text-[11px] text-slate-700">
                              <label className="inline-flex items-center gap-2 font-medium">
                                <input
                                  aria-label={`维度 ${index + 1} 启用一票否决`}
                                  type="checkbox"
                                  checked={candidate.vetoThreshold !== undefined}
                                  onChange={(event) =>
                                    updateCandidate(index, {
                                      vetoThreshold: event.target.checked
                                        ? 5
                                        : undefined,
                                    })
                                  }
                                  disabled={judgeDisabled || !candidate.selected}
                                  className="h-4 w-4 accent-red-600"
                                />
                                设为一票否决项
                              </label>
                              {candidate.vetoThreshold !== undefined && (
                                <label className="flex items-center gap-2">
                                  得分低于
                                  <input
                                    aria-label={`维度 ${index + 1} 否决阈值`}
                                    type="number"
                                    min="0"
                                    max="10"
                                    step="0.1"
                                    value={candidate.vetoThreshold}
                                    onChange={(event) =>
                                      updateCandidate(index, {
                                        vetoThreshold: Number(event.target.value),
                                      })
                                    }
                                    disabled={judgeDisabled || !candidate.selected}
                                    className="w-20 rounded-md border border-red-200 bg-white px-2 py-1 text-sm font-semibold text-red-700 disabled:bg-gray-100"
                                  />
                                  分时否决
                                </label>
                              )}
                            </div>
                          </div>
                          <details className="rounded-md border border-slate-200 bg-slate-50/70 px-2 py-1.5">
                            <summary className="cursor-pointer text-xs font-medium text-slate-700">
                              评分锚点、证据要求与判断规则
                            </summary>
                            <div className="mt-2 flex flex-col gap-2">
                              <div className="grid gap-2 sm:grid-cols-3">
                                {REQUIRED_RUBRIC_SCORES.map((score) => (
                                  <label
                                    key={score}
                                    className="flex flex-col gap-1 text-[11px] text-slate-600"
                                  >
                                    {score} 分标准
                                    <textarea
                                      aria-label={`维度 ${index + 1} ${score} 分标准`}
                                      value={
                                        candidate.scoreLevels?.find(
                                          (level) => level.score === score
                                        )?.criteria ?? ""
                                      }
                                      onChange={(event) =>
                                        updateCandidateScoreLevel(
                                          index,
                                          score,
                                          event.target.value
                                        )
                                      }
                                      disabled={judgeDisabled}
                                      maxLength={MAX_RUBRIC_CRITERIA_LENGTH}
                                      rows={3}
                                      className="resize-y rounded-md border border-slate-200 bg-white px-2 py-1"
                                    />
                                  </label>
                                ))}
                              </div>
                              <label className="flex flex-col gap-1 text-[11px] text-slate-600">
                                证据要求（每行一条，最多 {MAX_RUBRIC_EVIDENCE_ITEMS} 条）
                                <textarea
                                  aria-label={`维度 ${index + 1} 证据要求`}
                                  value={(candidate.evidenceRequirements ?? []).join(
                                    "\n"
                                  )}
                                  onChange={(event) =>
                                    updateCandidateEvidence(index, event.target.value)
                                  }
                                  disabled={judgeDisabled}
                                  maxLength={
                                    (MAX_RUBRIC_EVIDENCE_LENGTH + 1) *
                                    MAX_RUBRIC_EVIDENCE_ITEMS
                                  }
                                  rows={2}
                                  placeholder="例如：引用与标准答案不一致的具体字段"
                                  className="resize-y rounded-md border border-slate-200 bg-white px-2 py-1"
                                />
                              </label>
                              <label className="flex flex-col gap-1 text-[11px] text-slate-600">
                                可执行判断规则
                                <textarea
                                  aria-label={`维度 ${index + 1} 判断规则`}
                                  value={candidate.judgeInstruction ?? ""}
                                  onChange={(event) =>
                                    updateCandidate(index, {
                                      judgeInstruction: event.target.value,
                                    })
                                  }
                                  disabled={judgeDisabled}
                                  maxLength={MAX_RUBRIC_JUDGE_INSTRUCTION_LENGTH}
                                  rows={2}
                                  placeholder="说明先看什么证据、如何匹配评分锚点"
                                  className="resize-y rounded-md border border-slate-200 bg-white px-2 py-1"
                                />
                              </label>
                            </div>
                          </details>
                          {rubricMessages.length > 0 && (
                            <div
                              role="alert"
                              className="rounded-md bg-red-50 px-2 py-1.5 text-[11px] text-red-700"
                            >
                              Rubric 尚未完成：{rubricMessages.join("；")}
                            </div>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => removeCandidate(index)}
                          disabled={judgeDisabled}
                          className="mt-0.5 shrink-0 rounded-md border border-red-200 px-2 py-1 text-xs text-red-600 transition hover:bg-red-50 disabled:opacity-40"
                        >
                          删除
                        </button>
                      </div>
                    </li>
                  );
                })}
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
              <span className="text-xs text-gray-500">
                共 {candidates.length}/{MAX_DIMENSIONS} 条
              </span>
            </div>
            {duplicateDimensionNames.length > 0 && (
              <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
                以下维度与来源评价或本次其他维度重复，请修改后再继续：
                {duplicateDimensionNames.join("、")}
              </p>
            )}
            {hasRubricErrors && (
              <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
                所有已勾选维度都必须补齐定义、0/5/10 评分锚点、证据要求和判断规则，完成前不会生成 Judge Prompt 或启动评价。
              </p>
            )}
            {selectedCandidateCount > 0 && (
              <div
                aria-label="评价策略确认"
                className="rounded-lg border border-slate-200 bg-white p-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">
                      最终评价策略
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      权重合计 {evaluatorPolicyAnalysis.totalWeight}% · 一票否决项 {selectedVetoCount} 个
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={rebalanceCandidateWeights}
                    disabled={judgeDisabled || selectedCandidateCount === 0}
                    className="rounded-md border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                  >
                    平均分配权重
                  </button>
                </div>
                {evaluatorPolicyIssues.length > 0 && (
                  <div
                    role="alert"
                    className="mt-3 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700"
                  >
                    {Array.from(
                      new Set(
                        evaluatorPolicyIssues.map((issue) => issue.message)
                      )
                    ).join("；")}
                  </div>
                )}
                <p className="mt-3 text-xs leading-5 text-slate-600">
                  Judge 只返回各维度独立分数；平台按此处权重计算加权分，并在任一否决项低于阈值时标记“已否决”。修改任何维度或策略后必须重新确认。
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() =>
                      setConfirmedPolicyFingerprint(currentPolicyFingerprint)
                    }
                    disabled={!canConfirmPolicy || policyConfirmed}
                    className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-700"
                  >
                    {policyConfirmed ? "评价策略已确认" : "确认评价策略"}
                  </button>
                  <span
                    className={`text-xs font-medium ${
                      policyConfirmed ? "text-emerald-700" : "text-amber-700"
                    }`}
                  >
                    {policyConfirmed
                      ? "当前策略已锁定，可生成 Judge Prompt"
                      : "尚未确认或内容已变化"}
                  </span>
                </div>
              </div>
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
                className="rounded-md border border-blue-300 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-800 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
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

          <section
            aria-label="Evaluator 版本管理"
            className="flex flex-col gap-3 rounded-xl border border-indigo-200 bg-gradient-to-br from-indigo-50 via-white to-cyan-50 p-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-indigo-950">
                  Evaluator 版本
                </h3>
                <p className="mt-1 text-xs leading-5 text-indigo-800">
                  保存的是裁判、完整评价策略与 Prompt 快照。手动修改只形成草稿，旧版本永不覆盖；保存版本不会自动启动评价。
                </p>
              </div>
              <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-indigo-700 shadow-sm">
                已保存 {usableEvaluatorVersions.length} 个版本
              </span>
            </div>

            <label className="flex flex-col gap-1 text-xs font-medium text-slate-700">
              加载已保存版本
              <select
                aria-label="加载 Evaluator 版本"
                value={activeEvaluatorVersionId}
                onChange={(event) =>
                  handleEvaluatorVersionSelection(event.target.value)
                }
                disabled={isRunning}
                className="rounded-md border border-indigo-200 bg-white px-3 py-2 text-sm disabled:bg-slate-100"
              >
                <option value="">当前草稿（另存为新 Evaluator）</option>
                {usableEvaluatorVersions.map((version) => (
                  <option key={version.id} value={version.id}>
                    {version.name} v{version.version} · {version.createdBy} · {formatDateTime(version.createTime)}
                  </option>
                ))}
              </select>
            </label>

            <div className="grid gap-3 md:grid-cols-2">
              <label className="flex flex-col gap-1 text-xs font-medium text-slate-700">
                Evaluator 名称
                <input
                  aria-label="Evaluator 名称"
                  value={evaluatorName}
                  onChange={(event) => setEvaluatorName(event.target.value)}
                  maxLength={MAX_EVALUATOR_NAME_LENGTH}
                  disabled={isRunning}
                  placeholder="例如：客服上线质量评价器"
                  className="rounded-md border border-indigo-200 bg-white px-3 py-2 text-sm disabled:bg-slate-100"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs font-medium text-slate-700">
                修改人
                <input
                  aria-label="Evaluator 修改人"
                  value={evaluatorAuthor}
                  onChange={(event) => setEvaluatorAuthor(event.target.value)}
                  maxLength={MAX_EVALUATOR_AUTHOR_LENGTH}
                  disabled={isRunning}
                  className="rounded-md border border-indigo-200 bg-white px-3 py-2 text-sm disabled:bg-slate-100"
                />
              </label>
            </div>

            <label className="flex flex-col gap-1 text-xs font-medium text-slate-700">
              变更说明（可选）
              <input
                aria-label="Evaluator 变更说明"
                value={evaluatorChangeNote}
                onChange={(event) => setEvaluatorChangeNote(event.target.value)}
                maxLength={MAX_EVALUATOR_CHANGE_NOTE_LENGTH}
                disabled={isRunning}
                placeholder="例如：补充人工检查步骤并收紧一票否决阈值"
                className="rounded-md border border-indigo-200 bg-white px-3 py-2 text-sm disabled:bg-slate-100"
              />
            </label>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleSaveEvaluatorVersion}
                disabled={!canSaveEvaluatorVersion || isRunning}
                className="rounded-md bg-indigo-700 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-800 disabled:cursor-not-allowed disabled:bg-indigo-200 disabled:text-indigo-800"
              >
                {evaluatorVersionBound
                  ? "当前版本已保存"
                  : activeEvaluatorVersion
                    ? `保存为新版本 v${nextEvaluatorVersion}`
                    : "保存为 Evaluator v1"}
              </button>
              <span
                className={`text-xs font-medium ${
                  evaluatorVersionBound
                    ? "text-emerald-700"
                    : activeEvaluatorVersion
                      ? "text-amber-700"
                      : "text-slate-600"
                }`}
              >
                {evaluatorVersionBound && activeEvaluatorVersion
                  ? `已绑定不可变版本：${activeEvaluatorVersion.name} v${activeEvaluatorVersion.version}`
                  : activeEvaluatorVersion
                    ? `草稿已修改，旧版 v${activeEvaluatorVersion.version} 保持不变`
                    : currentEvaluatorDefinitionFingerprint
                      ? "当前草稿尚未保存；评价历史将显示未绑定版本"
                      : "请先确认评价策略并填写 Prompt"}
              </span>
            </div>

            {activeEvaluatorVersion && (
              <dl className="grid gap-2 rounded-lg border border-white bg-white/80 p-3 text-xs text-slate-600 sm:grid-cols-3">
                <div>
                  <dt className="text-slate-400">版本</dt>
                  <dd className="mt-1 font-semibold text-slate-800">
                    {activeEvaluatorVersion.name} v{activeEvaluatorVersion.version}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-400">修改人与时间</dt>
                  <dd className="mt-1 font-semibold text-slate-800">
                    {activeEvaluatorVersion.createdBy} · {formatDateTime(activeEvaluatorVersion.createTime)}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-400">适用任务</dt>
                  <dd className="mt-1 font-mono text-[11px] font-semibold text-slate-800" title={activeEvaluatorVersion.applicableTaskId}>
                    {activeEvaluatorVersion.applicableTaskId.slice(0, 18)}
                  </dd>
                </div>
                {activeEvaluatorVersion.changeNote && (
                  <div className="sm:col-span-3">
                    <dt className="text-slate-400">变更说明</dt>
                    <dd className="mt-1 text-slate-800">
                      {activeEvaluatorVersion.changeNote}
                    </dd>
                  </div>
                )}
              </dl>
            )}

            {activeEvaluatorVersion &&
              activeEvaluatorFamilyVersions.length > 1 && (
                <EvaluatorVersionDiffPanel
                  activeVersion={activeEvaluatorVersion}
                  familyVersions={activeEvaluatorFamilyVersions}
                  compareVersionId={compareEvaluatorVersionId}
                  nextVersion={nextEvaluatorVersion}
                  restoreDisabled={!evaluatorAuthor.trim() || isRunning}
                  onCompareVersionChange={setCompareEvaluatorVersionId}
                  onRestore={handleRestoreEvaluatorVersion}
                />
              )}

            {evaluatorVersions.length > usableEvaluatorVersions.length && (
              <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
                有 {evaluatorVersions.length - usableEvaluatorVersions.length} 个版本未通过完整性校验，已禁止加载。
              </p>
            )}
            {evaluatorVersionError && (
              <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
                {evaluatorVersionError}
              </p>
            )}
          </section>

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

          {error && itemErrors.length === 0 && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-600">
              {error}
            </p>
          )}

          <section
            aria-label="评价执行"
            className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-4 md:grid-cols-2"
          >
            <div className="rounded-lg border border-cyan-200 bg-white p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-cyan-950">
                    先做少量样本试评
                  </h3>
                  <p className="mt-1 text-xs leading-5 text-cyan-800">
                    检查分数与解析错误，不写入 AI 历史评价。
                  </p>
                </div>
                <label className="flex items-center gap-1 text-xs text-slate-600">
                  样本数
                  <select
                    aria-label="试评样本数"
                    value={trialCount}
                    onChange={(event) =>
                      setTrialCount(Number(event.target.value))
                    }
                    disabled={isRunning}
                    className="rounded-md border border-slate-300 bg-white px-2 py-1"
                  >
                    {Array.from(
                      { length: MAX_TRIAL_EVALUATION_COUNT },
                      (_, index) => index + 1
                    ).map((count) => (
                      <option key={count} value={count}>
                        {count}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <button
                type="button"
                onClick={handleTrialEvaluate}
                disabled={!canEvaluate || trialPlan.inputIds.length === 0}
                className="mt-3 w-full rounded-md border border-cyan-500 bg-cyan-50 px-4 py-2 text-sm font-semibold text-cyan-900 hover:bg-cyan-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isRunning && lastExecutionIntent === "trial"
                  ? "试评进行中…"
                  : `试评 ${trialPlan.judgeCallCount} 条（不写历史）`}
              </button>
            </div>

            <div className="rounded-lg border border-blue-200 bg-white p-3">
              <h3 className="text-sm font-semibold text-blue-950">
                正式 AI 评价
              </h3>
              <p className="mt-1 text-xs leading-5 text-blue-800">
                复用 {formalPlan.reusedOutputCount} 条历史输出，完成后新增独立评价记录。
              </p>
              <button
                type="button"
                onClick={handleEvaluate}
                disabled={!canEvaluate}
                className="mt-3 w-full rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isRunning && lastExecutionIntent === "formal"
                  ? "评价进行中…"
                  : status === "done" &&
                      newDimensionContext &&
                      lastExecutionIntent === "formal"
                    ? "新增维度评价已完成"
                    : newDimensionContext
                      ? "预览并确认新增维度评价"
                      : "开始 AI 评价"}
              </button>
            </div>

            {isRunning && (
              <button
                type="button"
                onClick={cancel}
                className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm transition hover:bg-gray-50 md:col-span-2"
              >
                取消本次评价
              </button>
            )}
          </section>

          {status === "done" && lastExecutionIntent && (
            <div
              role="status"
              className={`rounded-md px-3 py-2 text-xs ${
                lastExecutionIntent === "trial"
                  ? "border border-cyan-200 bg-cyan-50 text-cyan-900"
                  : "border border-emerald-200 bg-emerald-50 text-emerald-900"
              }`}
            >
              {lastExecutionIntent === "trial"
                ? `试评完成：成功 ${evalResults.length} 条，失败 ${itemErrors.length} 条。结果仅保留在当前页面，未写入 AI 历史评价。`
                : evalResults.length > 0
                  ? `正式评价完成：成功 ${evalResults.length} 条，已新增一条独立 AI 历史评价；被测模型或算法调用 0 次。`
                  : "正式评价未产生可保存结果，请根据上方错误修正后重试；AI 历史评价未写入。"}
            </div>
          )}

          {itemErrors.length > 0 && (
            <div
              role="alert"
              aria-label="逐条评价错误"
              className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700"
            >
              <p className="font-semibold">
                有 {itemErrors.length} 条结果未能完成评价，请先修正裁判输出或 Prompt：
              </p>
              <ul className="mt-1 list-inside list-disc space-y-1">
                {itemErrors.map((item) => {
                  const inputIndex = inputs.findIndex(
                    (input) => input.id === item.inputId
                  );
                  return (
                    <li key={item.inputId}>
                      输入 #{inputIndex >= 0 ? inputIndex + 1 : item.inputId}：
                      {item.message}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          <EvaluationResults
            evalResults={evalResults}
            inputs={inputs}
            results={results}
            dimensions={validDimensions}
          />
        </div>
      )}

      {confirmOpen && confirmationPlan.inputIds.length > 0 && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="evaluation-confirm-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4"
        >
          <div className="w-full max-w-lg rounded-xl bg-white p-5 shadow-2xl">
            <h3
              id="evaluation-confirm-title"
              className="text-base font-semibold text-slate-900"
            >
              {confirmationIntent === "trial"
                ? "确认少量样本试评"
                : newDimensionContext
                  ? "确认新增维度评价"
                  : "确认正式 AI 评价"}
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              {confirmationPlan.writesHistory
                ? "完成后将创建一条独立评价记录，原始跑批结果和已有评价都不会被覆盖。"
                : "本次只用于校验评分与解析质量，结果不会写入 AI 历史评价。"}
            </p>

            <dl className="mt-4 grid grid-cols-2 gap-2 text-sm">
              <div className="rounded-lg bg-amber-50 p-3">
                <dt className="text-xs text-amber-700">裁判模型调用</dt>
                <dd className="mt-1 text-lg font-semibold text-amber-900">
                  {confirmationPlan.judgeCallCount} 次
                </dd>
              </div>
              <div className="rounded-lg bg-emerald-50 p-3">
                <dt className="text-xs text-emerald-700">被测模型/算法调用</dt>
                <dd className="mt-1 text-lg font-semibold text-emerald-900">
                  {confirmationPlan.testedTargetCallCount} 次
                </dd>
              </div>
              <div className="rounded-lg bg-slate-50 p-3">
                <dt className="text-xs text-slate-500">复用历史输出</dt>
                <dd className="mt-1 font-semibold text-slate-800">
                  {confirmationPlan.reusedOutputCount} 条
                </dd>
              </div>
              <div className="rounded-lg bg-indigo-50 p-3">
                <dt className="text-xs text-indigo-600">AI 历史评价</dt>
                <dd className="mt-1 font-semibold text-indigo-900">
                  {confirmationPlan.writesHistory ? "新增 1 条" : "不写入"}
                </dd>
              </div>
            </dl>

            {newDimensionContext && (
              <div className="mt-3 rounded-md border border-slate-200 px-3 py-2 text-xs text-slate-600">
                本次维度：
                {validDimensions.map((dimension) => dimension.name).join("、")}
              </div>
            )}
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
                onClick={() => void executeEvaluation(confirmationIntent)}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                {confirmationIntent === "trial"
                  ? "确认并开始试评"
                  : "确认并开始评价"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
