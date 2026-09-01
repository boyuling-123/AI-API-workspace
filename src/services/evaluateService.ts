import type {
  EvalDimension,
  EvaluationEvidence,
  EvaluationMode,
  ImageItem,
  TargetDimensionScores,
} from "@/types";
import { chatWithModel } from "@/services/llmClient";
import {
  calculateEvaluatorPolicyOutcome,
  formatEvaluatorPolicyForPrompt,
  parseEvaluatorPolicy,
} from "@/lib/evaluatorPolicy";

export const MAX_EVALUATION_EVIDENCE_ITEMS = 3;
export const MAX_EVALUATION_EVIDENCE_TEXT_LENGTH = 300;

/**
 * 逐条评价（服务端，M9；v4.5 改为多维度）：一次处理一条输入，把该条各目标的输出交给裁判模型横向对比，
 * Judge 对每个目标逐维度独立打分，平台再确定性计算加权分与否决结果。
 */

export interface EvaluateInputItem {
  inputId: string;
  prompt: string;
  /** 标准答案模式：从该输入 extraFields 读取到的参考答案。 */
  expectedOutput?: string;
  expectedOutputKey?: string;
  /** 已压缩的图片副本（仅传裁判用，原图不经此处）。 */
  images?: ImageItem[];
  targets: {
    targetId: string;
    targetName: string;
    outputText?: string;
    outputImageCount: number;
    /** 仅供 Judge 的压缩副本；不会写入评价结果。 */
    outputImages?: ImageItem[];
  }[];
}

export interface EvaluateResultPerInput {
  inputId: string;
  /** 各目标的独立维度评分，以及平台计算的策略结果。 */
  scores: TargetDimensionScores[];
  summary: string;
  recommendation: string;
}

function buildDimensionsBlock(dimensions: EvalDimension[]): string {
  return dimensions
    .map((dimension, index) =>
      formatEvaluatorPolicyForPrompt(dimension, index)
    )
    .join("\n\n");
}

function buildEvalGuide(
  evalPrompt: string,
  dimensions: EvalDimension[],
  evaluationMode: EvaluationMode
): string {
  const dimensionNames = dimensions.map((dimension) => dimension.name);
  const dimensionsJsonHint = dimensionNames
    .map(
      (name) =>
        `{ "dimension": ${JSON.stringify(name)}, "score": 0-10, "comment": "该维度的简短理由", "evidence": [ { "kind": "text_quote", "source": "target_output", "targetId": "当前评分目标的 targetId", "quote": "输出中的精确原文" } ] }`
    )
    .join(", ");

  const modeInstruction =
    evaluationMode === "reference"
      ? `你是一个严格、客观的测评裁判。请依据下方「评价要求」和本条输入的「标准答案」，分别判断每个目标输出是否满足标准答案与业务规则。重点是逐个目标对照标准答案判分，不要只做目标之间的相对比较。`
      : `你是一个严格、客观的测评裁判。请依据下方「评价要求」，对同一条输入下多个目标的输出进行横向对比，并按每个维度独立打分。`;

  const referenceInstruction =
    evaluationMode === "reference"
      ? `\n标准答案模式要求：\n- 必须把「标准答案」作为主要判分依据，允许语义等价但不允许关键字段缺失、格式错误或类别错判。\n- 如果标准答案是 JSON / 工具调用，请重点检查 JSON 可解析性、字段名、字段值、工具名、参数与追问逻辑是否一致。\n- 评分可参考：10=完全正确可直接上线；6-8=基本正确但有轻微缺陷；1-5=部分相关但关键问题明显；0=错误、不可用或答非所问。\n`
      : "";

  return `${modeInstruction}

=== 评价要求 ===
${evalPrompt}
=== 结束 ===
${referenceInstruction}

=== 评价维度与已确认策略（必须逐维度独立打分）===
${buildDimensionsBlock(dimensions)}
=== 结束 ===

请严格只输出一个 JSON 对象（不要任何解释、不要 markdown 代码块标记），字段如下：
- scores: 数组，每项对应一个目标，结构为 { "targetId": 字符串(必须用下方给定的 targetId), "dimensionScores": [ ${dimensionsJsonHint} ], "overallComment": 可选的总体点评(文字) }。必须覆盖所有给定目标，且 dimensionScores 必须覆盖上述每一个维度（dimension 字段用维度名）。
- summary: 字符串，对本条对比的总体结论。
- recommendation: 字符串，推荐选用哪个目标及理由。

证据规则（每个目标的每个维度都必须满足）：
- evidence 必须包含 1-${MAX_EVALUATION_EVIDENCE_ITEMS} 条，不得只写泛泛理由。
- 文字引用使用 { "kind": "text_quote", "source": "input_prompt" | "expected_answer" | "target_output", "targetId": "仅 target_output 必填", "quote": "来源中的精确连续原文" }；quote 最长 ${MAX_EVALUATION_EVIDENCE_TEXT_LENGTH} 字，平台会核验原文并自行计算位置。
- 图片观察使用 { "kind": "image_observation", "source": "input_image" | "target_image", "targetId": "仅 target_image 必填", "imageIndex": 从1开始的图片序号, "observation": "可核验的视觉观察" }。
- 目标存在文字或图片输出时，至少一条证据必须引用当前评分目标自己的 target_output 或 target_image。
${
    evaluationMode === "reference"
      ? "- 标准答案模式下，每个维度还必须至少引用一条 expected_answer 原文。"
      : "- 横向对比模式不得伪造 expected_answer 证据。"
  }

注意：各维度独立打分，不要自行计算总分或加权汇总。平台会根据已确认权重计算加权分，并确定性执行一票否决。只输出 JSON 对象本身。`;
}

function buildTargetsBlock(item: EvaluateInputItem): string {
  let attachmentIndex = item.images?.length ?? 0;
  const lines = item.targets.map((target, index) => {
    const imageCount = target.outputImages?.length ?? 0;
    const imageRefs = Array.from({ length: imageCount }, (_, imageIndex) => {
      attachmentIndex += 1;
      return `target_image targetId="${target.targetId}" imageIndex=${imageIndex + 1} 对应请求附件 ${attachmentIndex}`;
    });
    const imageNote = imageRefs.length > 0 ? `\n输出图片：${imageRefs.join("；")}` : "";
    return `目标 ${index + 1}: targetId="${target.targetId}" 名称="${target.targetName}"\n输出文本：${target.outputText ?? "(无文本)"} ${imageNote}`;
  });
  return lines.join("\n\n");
}

function buildInputImageBlock(item: EvaluateInputItem): string {
  if (!item.images?.length) return "";
  const refs = item.images.map(
    (_, index) =>
      `input_image imageIndex=${index + 1} 对应请求附件 ${index + 1}`
  );
  return `\n\n=== 输入图片证据定位 ===\n${refs.join("\n")}\n=== 结束 ===`;
}

function collectJudgeImages(item: EvaluateInputItem): ImageItem[] {
  return [
    ...(item.images ?? []),
    ...item.targets.flatMap((target) => target.outputImages ?? []),
  ];
}

function buildExpectedBlock(item: EvaluateInputItem): string {
  if (!item.expectedOutput?.trim()) {
    return "";
  }
  const keyNote = item.expectedOutputKey ? `（字段：${item.expectedOutputKey}）` : "";
  return `\n\n=== 标准答案 ${keyNote}===\n${item.expectedOutput}\n=== 结束 ===`;
}

function extractJsonBlock(text: string): string {
  const trimmed = text.trim();
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenceMatch) return fenceMatch[1].trim();
  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1);
  }
  return trimmed;
}

function clampScore(value: unknown): number {
  const num = typeof value === "number" ? value : Number(value);
  if (Number.isNaN(num)) return 0;
  const bounded = Math.min(10, Math.max(0, num));
  return Math.round(bounded * 10) / 10;
}

/** 严格解析单个目标的多维度评分；缺少任一维度或证据时拒绝整条 Judge 结果。 */
function normalizeDimensionScores(
  rawDimensionScores: unknown,
  dimensions: EvalDimension[],
  item: EvaluateInputItem,
  scoreTargetId: string,
  evaluationMode: EvaluationMode
): TargetDimensionScores["dimensionScores"] {
  const arr = Array.isArray(rawDimensionScores) ? rawDimensionScores : [];
  const byName = new Map<
    string,
    { score: number; comment: string; evidence: unknown }
  >();
  for (const entry of arr) {
    const dimObj = (entry ?? {}) as Record<string, unknown>;
    const name = typeof dimObj.dimension === "string" ? dimObj.dimension : "";
    if (!name) continue;
    byName.set(name, {
      score: clampScore(dimObj.score),
      comment: typeof dimObj.comment === "string" ? dimObj.comment : "",
      evidence: dimObj.evidence,
    });
  }
  return dimensions.map((dimension) => {
    const matched = byName.get(dimension.name);
    if (!matched) {
      throw new Error(
        `裁判未返回目标“${scoreTargetId}”维度“${dimension.name}”的评分与证据`
      );
    }
    return {
      dimension: dimension.name,
      score: matched.score,
      comment: matched.comment || "（裁判未给出该维度理由）",
      evidence: normalizeEvidence(
        matched.evidence,
        item,
        scoreTargetId,
        dimension.name,
        evaluationMode
      ),
    };
  });
}

function normalizeEvidence(
  rawEvidence: unknown,
  item: EvaluateInputItem,
  scoreTargetId: string,
  dimensionName: string,
  evaluationMode: EvaluationMode
): EvaluationEvidence[] {
  if (
    !Array.isArray(rawEvidence) ||
    rawEvidence.length < 1 ||
    rawEvidence.length > MAX_EVALUATION_EVIDENCE_ITEMS
  ) {
    throw new Error(
      `目标“${scoreTargetId}”维度“${dimensionName}”必须包含 1-${MAX_EVALUATION_EVIDENCE_ITEMS} 条结构化证据`
    );
  }
  const normalized = rawEvidence.map((entry) =>
    normalizeEvidenceEntry(entry, item, scoreTargetId, dimensionName)
  );
  const unique = new Set(normalized.map(evidenceIdentity));
  if (unique.size !== normalized.length) {
    throw new Error(
      `目标“${scoreTargetId}”维度“${dimensionName}”包含重复证据`
    );
  }

  const currentTarget = item.targets.find(
    (target) => target.targetId === scoreTargetId
  );
  const hasCurrentOutput = Boolean(
    currentTarget?.outputText?.trim() || currentTarget?.outputImages?.length
  );
  const citesCurrentOutput = normalized.some(
    (evidence) =>
      (evidence.source === "target_output" ||
        evidence.source === "target_image") &&
      evidence.targetId === scoreTargetId
  );
  if (hasCurrentOutput && !citesCurrentOutput) {
    throw new Error(
      `目标“${scoreTargetId}”维度“${dimensionName}”必须引用当前目标自己的输出证据`
    );
  }
  const citesExpectedAnswer = normalized.some(
    (evidence) => evidence.source === "expected_answer"
  );
  if (evaluationMode === "reference" && !citesExpectedAnswer) {
    throw new Error(
      `目标“${scoreTargetId}”维度“${dimensionName}”在标准答案模式下必须引用标准答案`
    );
  }
  if (evaluationMode === "comparison" && citesExpectedAnswer) {
    throw new Error("横向对比模式不能引用不存在的标准答案");
  }
  return normalized;
}

function normalizeEvidenceEntry(
  raw: unknown,
  item: EvaluateInputItem,
  scoreTargetId: string,
  dimensionName: string
): EvaluationEvidence {
  const entry = (raw ?? {}) as Record<string, unknown>;
  if (entry.kind === "text_quote") {
    const source = entry.source;
    if (
      source !== "input_prompt" &&
      source !== "expected_answer" &&
      source !== "target_output"
    ) {
      throw evidenceError(scoreTargetId, dimensionName, "文字来源非法");
    }
    const targetId =
      typeof entry.targetId === "string" ? entry.targetId : undefined;
    let sourceText = "";
    if (source === "input_prompt") {
      if (targetId) {
        throw evidenceError(scoreTargetId, dimensionName, "输入证据不得携带 targetId");
      }
      sourceText = item.prompt;
    } else if (source === "expected_answer") {
      if (targetId) {
        throw evidenceError(scoreTargetId, dimensionName, "标准答案证据不得携带 targetId");
      }
      sourceText = item.expectedOutput ?? "";
    } else {
      if (!targetId) {
        throw evidenceError(scoreTargetId, dimensionName, "目标输出证据缺少 targetId");
      }
      const target = item.targets.find((candidate) => candidate.targetId === targetId);
      if (!target) {
        throw evidenceError(scoreTargetId, dimensionName, `引用了未知目标“${targetId}”`);
      }
      sourceText = target.outputText ?? "";
    }
    const quote = boundedEvidenceText(entry.quote, "quote");
    const start = sourceText.indexOf(quote);
    if (start < 0) {
      throw evidenceError(
        scoreTargetId,
        dimensionName,
        `原文中无法定位引用“${quote.slice(0, 40)}”`
      );
    }
    return {
      kind: "text_quote",
      source,
      ...(source === "target_output" ? { targetId } : {}),
      quote: sourceText.slice(start, start + quote.length),
      start,
      end: start + quote.length,
    };
  }

  if (entry.kind === "image_observation") {
    const source = entry.source;
    if (source !== "input_image" && source !== "target_image") {
      throw evidenceError(scoreTargetId, dimensionName, "图片来源非法");
    }
    const targetId =
      typeof entry.targetId === "string" ? entry.targetId : undefined;
    const imageIndex = Number(entry.imageIndex);
    if (!Number.isSafeInteger(imageIndex) || imageIndex < 1) {
      throw evidenceError(scoreTargetId, dimensionName, "图片序号必须是从 1 开始的整数");
    }
    let imageCount = 0;
    if (source === "input_image") {
      if (targetId) {
        throw evidenceError(scoreTargetId, dimensionName, "输入图片证据不得携带 targetId");
      }
      imageCount = item.images?.length ?? 0;
    } else {
      if (!targetId) {
        throw evidenceError(scoreTargetId, dimensionName, "目标图片证据缺少 targetId");
      }
      const target = item.targets.find((candidate) => candidate.targetId === targetId);
      if (!target) {
        throw evidenceError(scoreTargetId, dimensionName, `引用了未知目标“${targetId}”`);
      }
      imageCount = target.outputImages?.length ?? 0;
    }
    if (imageIndex > imageCount) {
      throw evidenceError(
        scoreTargetId,
        dimensionName,
        `图片序号 ${imageIndex} 超出来源图片数量 ${imageCount}`
      );
    }
    const observation = boundedEvidenceText(entry.observation, "observation");
    return {
      kind: "image_observation",
      source,
      ...(source === "target_image" ? { targetId } : {}),
      imageIndex,
      observation,
    };
  }
  throw evidenceError(scoreTargetId, dimensionName, "证据 kind 非法");
}

function boundedEvidenceText(value: unknown, field: string): string {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) throw new Error(`Judge 证据 ${field} 不能为空`);
  if (text.length > MAX_EVALUATION_EVIDENCE_TEXT_LENGTH) {
    throw new Error(
      `Judge 证据 ${field} 不能超过 ${MAX_EVALUATION_EVIDENCE_TEXT_LENGTH} 字`
    );
  }
  return text;
}

function evidenceError(
  targetId: string,
  dimensionName: string,
  reason: string
): Error {
  return new Error(
    `目标“${targetId}”维度“${dimensionName}”的 Judge 证据无效：${reason}`
  );
}

function evidenceIdentity(evidence: EvaluationEvidence): string {
  return evidence.kind === "text_quote"
    ? `${evidence.kind}:${evidence.source}:${evidence.targetId ?? ""}:${evidence.start}:${evidence.end}`
    : `${evidence.kind}:${evidence.source}:${evidence.targetId ?? ""}:${evidence.imageIndex}:${evidence.observation}`;
}

function normalizeResult(
  raw: unknown,
  item: EvaluateInputItem,
  dimensions: EvalDimension[],
  evaluationMode: EvaluationMode
): EvaluateResultPerInput {
  const obj = (raw ?? {}) as Record<string, unknown>;
  const rawScores = Array.isArray(obj.scores) ? obj.scores : [];

  const scoreByTargetId = new Map<string, Record<string, unknown>>();
  const expectedTargetIds = new Set(
    item.targets.map((target) => target.targetId)
  );
  for (const entry of rawScores) {
    const scoreObj = (entry ?? {}) as Record<string, unknown>;
    const targetId =
      typeof scoreObj.targetId === "string" ? scoreObj.targetId : "";
    if (!targetId) {
      throw new Error("裁判评分缺少目标 ID");
    }
    if (!expectedTargetIds.has(targetId)) {
      throw new Error(`裁判返回了未知目标“${targetId}”的评分`);
    }
    if (scoreByTargetId.has(targetId)) {
      throw new Error(`裁判重复返回了目标“${targetId}”的评分`);
    }
    scoreByTargetId.set(targetId, scoreObj);
  }

  const scores: TargetDimensionScores[] = item.targets.map((target) => {
    const matched = scoreByTargetId.get(target.targetId);
    const overallComment =
      matched && typeof matched.overallComment === "string"
        ? matched.overallComment
        : undefined;
    const dimensionScores = normalizeDimensionScores(
      matched?.dimensionScores,
      dimensions,
      item,
      target.targetId,
      evaluationMode
    );
    const policyOutcome = calculateEvaluatorPolicyOutcome(
      dimensions,
      dimensionScores
    );
    return {
      targetId: target.targetId,
      targetName: target.targetName,
      dimensionScores,
      ...policyOutcome,
      overallComment: overallComment || undefined,
    };
  });

  return {
    inputId: item.inputId,
    scores,
    summary: typeof obj.summary === "string" ? obj.summary : "",
    recommendation:
      typeof obj.recommendation === "string" ? obj.recommendation : "",
  };
}

export async function evaluateOneInput(
  item: EvaluateInputItem,
  evalPrompt: string,
  modelId: string,
  dimensions: EvalDimension[],
  evaluationMode: EvaluationMode = "comparison",
  signal?: AbortSignal
): Promise<EvaluateResultPerInput> {
  const parsedDimensions = parseEvaluatorPolicy(dimensions);
  if (evaluationMode === "reference" && !item.expectedOutput?.trim()) {
    throw new Error("标准答案模式缺少可引用的标准答案");
  }
  if (item.targets.length === 0) {
    throw new Error("本条输入没有可评价的目标输出");
  }
  const targetIds = item.targets.map((target) => target.targetId);
  if (new Set(targetIds).size !== targetIds.length) {
    throw new Error("本条输入包含重复的目标 ID");
  }
  const prompt = `${buildEvalGuide(evalPrompt, parsedDimensions, evaluationMode)}\n\n=== 输入 prompt ===\n${item.prompt}${buildExpectedBlock(item)}${buildInputImageBlock(item)}\n\n=== 各目标输出 ===\n${buildTargetsBlock(item)}`;
  const judgeImages = collectJudgeImages(item);

  const output = await chatWithModel(
    {
      modelId,
      prompt,
      images: judgeImages.length > 0 ? judgeImages : undefined,
    },
    signal
  );
  const jsonText = extractJsonBlock(output.outputText);

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    throw new Error(
      "裁判模型返回内容无法解析为 JSON，请重试或更换裁判模型。原始片段：" +
        output.outputText.slice(0, 200)
    );
  }

  return normalizeResult(parsed, item, parsedDimensions, evaluationMode);
}
