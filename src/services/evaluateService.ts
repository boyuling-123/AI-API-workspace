import type {
  EvalDimension,
  EvaluationMode,
  ImageItem,
  TargetDimensionScores,
} from "@/types";
import { chatWithModel } from "@/services/llmClient";

/**
 * 逐条评价（服务端，M9；v4.5 改为多维度）：一次处理一条输入，把该条各目标的输出交给裁判模型横向对比，
 * 裁判对每个目标、在每个维度上独立打分（0-10）+ 一句理由，不算总分。强制结构化 JSON 输出并容错解析。
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
  }[];
}

export interface EvaluateResultPerInput {
  inputId: string;
  /** 各目标的多维度评分（v4.5，无总分）。 */
  scores: TargetDimensionScores[];
  summary: string;
  recommendation: string;
}

function buildDimensionsBlock(dimensions: EvalDimension[]): string {
  return dimensions
    .map(
      (dimension, index) =>
        `${index + 1}. ${dimension.name}${dimension.desc ? `：${dimension.desc}` : ""}`
    )
    .join("\n");
}

function buildEvalGuide(
  evalPrompt: string,
  dimensions: EvalDimension[],
  evaluationMode: EvaluationMode
): string {
  const dimensionNames = dimensions.map((dimension) => dimension.name);
  const dimensionsJsonHint = dimensionNames
    .map((name) => `{ "dimension": "${name}", "score": 0-10, "comment": "该维度的简短理由" }`)
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

=== 评价维度（必须对每个目标、在每个维度上单独打分，不要总分）===
${buildDimensionsBlock(dimensions)}
=== 结束 ===

请严格只输出一个 JSON 对象（不要任何解释、不要 markdown 代码块标记），字段如下：
- scores: 数组，每项对应一个目标，结构为 { "targetId": 字符串(必须用下方给定的 targetId), "dimensionScores": [ ${dimensionsJsonHint} ], "overallComment": 可选的总体点评(文字) }。必须覆盖所有给定目标，且 dimensionScores 必须覆盖上述每一个维度（dimension 字段用维度名）。
- summary: 字符串，对本条对比的总体结论。
- recommendation: 字符串，推荐选用哪个目标及理由。

注意：各维度独立打分，绝对不要计算总分或加权汇总。只输出 JSON 对象本身。`;
}

function buildTargetsBlock(item: EvaluateInputItem): string {
  const lines = item.targets.map((target, index) => {
    const imageNote =
      target.outputImageCount > 0
        ? `（另含 ${target.outputImageCount} 张图片输出）`
        : "";
    return `目标 ${index + 1}: targetId="${target.targetId}" 名称="${target.targetName}"\n输出文本：${target.outputText ?? "(无文本)"} ${imageNote}`;
  });
  return lines.join("\n\n");
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

/** 解析单个目标的多维度评分，按本次选定维度补齐（裁判漏给某维度则置 0 + 提示）。 */
function normalizeDimensionScores(
  rawDimensionScores: unknown,
  dimensions: EvalDimension[]
): { dimension: string; score: number; comment: string }[] {
  const arr = Array.isArray(rawDimensionScores) ? rawDimensionScores : [];
  const byName = new Map<string, { score: number; comment: string }>();
  for (const entry of arr) {
    const dimObj = (entry ?? {}) as Record<string, unknown>;
    const name = typeof dimObj.dimension === "string" ? dimObj.dimension : "";
    if (!name) continue;
    byName.set(name, {
      score: clampScore(dimObj.score),
      comment: typeof dimObj.comment === "string" ? dimObj.comment : "",
    });
  }
  return dimensions.map((dimension) => {
    const matched = byName.get(dimension.name);
    return {
      dimension: dimension.name,
      score: matched?.score ?? 0,
      comment: matched?.comment ?? "（裁判未给出该维度理由）",
    };
  });
}

function normalizeResult(
  raw: unknown,
  item: EvaluateInputItem,
  dimensions: EvalDimension[]
): EvaluateResultPerInput {
  const obj = (raw ?? {}) as Record<string, unknown>;
  const rawScores = Array.isArray(obj.scores) ? obj.scores : [];

  const scoreByTargetId = new Map<string, Record<string, unknown>>();
  for (const entry of rawScores) {
    const scoreObj = (entry ?? {}) as Record<string, unknown>;
    const targetId =
      typeof scoreObj.targetId === "string" ? scoreObj.targetId : "";
    if (!targetId) continue;
    scoreByTargetId.set(targetId, scoreObj);
  }

  const scores: TargetDimensionScores[] = item.targets.map((target) => {
    const matched = scoreByTargetId.get(target.targetId);
    const overallComment =
      matched && typeof matched.overallComment === "string"
        ? matched.overallComment
        : undefined;
    return {
      targetId: target.targetId,
      targetName: target.targetName,
      dimensionScores: normalizeDimensionScores(
        matched?.dimensionScores,
        dimensions
      ),
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
  const prompt = `${buildEvalGuide(evalPrompt, dimensions, evaluationMode)}\n\n=== 输入 prompt ===\n${item.prompt}${buildExpectedBlock(item)}\n\n=== 各目标输出 ===\n${buildTargetsBlock(item)}`;

  const output = await chatWithModel(
    { modelId, prompt, images: item.images },
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

  return normalizeResult(parsed, item, dimensions);
}
