import type { BaseModelConfig, EvalDimension } from "@/types";
import { chatWithModel } from "@/services/llmClient";
import { DIMENSION_PRESETS } from "@/config/dimensionPresets";

/**
 * AI 生成候选评价维度（服务端，v4.5）：
 * 用户描述测评需求 → 大模型生成若干候选维度（每个带说明），强制结构化 JSON 数组输出并容错解析。
 * 内置预设维度集仅作为模型生成时的内部参考（reference），不透出给用户、不直接套用。
 * 产出 EvalDimension[]，前端供用户勾选/增删改后定稿。
 */

const GEN_DIMENSIONS_GUIDE = `你是一个测评专家。请根据用户描述的测评需求，提炼出该场景下最值得考察的评价维度。

要求：
- 严格只输出一个 JSON 数组（不要任何解释、不要 markdown 代码块标记）。
- 数组每一项结构：{ "name": 维度名(简短，2-6字), "desc": 维度说明(一句话说清这条维度具体考察什么) }。
- 维度之间相互独立、不重叠，覆盖该场景的主要关注点。
- 维度数量控制在 4-8 个，贴合用户描述，避免空泛，便于用户从中勾选。
- 只输出 JSON 数组本身。`;

/**
 * 把所有内置预设维度汇总成一段"参考范例"喂给模型——
 * 仅作为生成维度的风格/粒度参考，不要求模型照搬。这些预设不透出给用户。
 */
function buildPresetReference(): string {
  const lines = DIMENSION_PRESETS.flatMap((preset) => [
    `【${preset.scene}】`,
    ...preset.dimensions.map(
      (dimension) => `- ${dimension.name}：${dimension.desc ?? ""}`
    ),
  ]).join("\n");
  return `\n\n=== 维度参考范例（仅供你把握维度的粒度与表述风格，请结合用户需求自行生成，不要照搬）===\n${lines}`;
}

function extractJsonArray(text: string): string {
  const trimmed = text.trim();
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenceMatch) return fenceMatch[1].trim();
  const firstBracket = trimmed.indexOf("[");
  const lastBracket = trimmed.lastIndexOf("]");
  if (firstBracket !== -1 && lastBracket > firstBracket) {
    return trimmed.slice(firstBracket, lastBracket + 1);
  }
  return trimmed;
}

/** 把 AI 返回的单项归一化为 EvalDimension（容错：缺 name 丢弃，desc 可空）。 */
function normalizeDimension(raw: unknown): EvalDimension | null {
  const obj = (raw ?? {}) as Record<string, unknown>;
  const name = typeof obj.name === "string" ? obj.name.trim() : "";
  if (!name) return null;
  const desc = typeof obj.desc === "string" ? obj.desc.trim() : undefined;
  return { name, desc: desc || undefined };
}

export async function generateDimensions(
  userRequirement: string,
  baseModel: BaseModelConfig
): Promise<EvalDimension[]> {
  const presetReference = buildPresetReference();
  const prompt = `${GEN_DIMENSIONS_GUIDE}${presetReference}\n\n=== 用户测评需求 ===\n${userRequirement}\n=== 结束 ===\n\n请输出候选维度的 JSON 数组。`;

  const output = await chatWithModel({ baseModel, prompt });
  const jsonText = extractJsonArray(output.outputText);

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    throw new Error(
      "AI 返回内容无法解析为维度 JSON 数组，请重试或更换模型。原始返回片段：" +
        output.outputText.slice(0, 200)
    );
  }

  if (!Array.isArray(parsed)) {
    throw new Error("AI 未返回 JSON 数组，请重试。");
  }

  const dimensions = parsed
    .map(normalizeDimension)
    .filter((dimension): dimension is EvalDimension => dimension !== null);

  if (dimensions.length === 0) {
    throw new Error("AI 未生成有效维度，请调整需求后重试。");
  }

  return dimensions;
}
