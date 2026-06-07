import type { BaseModelConfig, EvalDimension } from "@/types";
import { chatWithModel } from "@/services/llmClient";

/**
 * AI 自动生成评价 Prompt（服务端，M9 需求6；v4.5 改为按维度）：
 * 用户描述测评场景/要求 + 选定维度 + 目标名单 → 大模型生成一段可直接用于「裁判模型」的评价 Prompt 文案。
 * 要求裁判按每个维度逐项打分（0-10）+ 一句理由，明确不要总分。
 * 返回纯文本，前端填入 evalPrompt 后用户可再编辑。
 */

function buildDimensionsBlock(dimensions: EvalDimension[]): string {
  if (dimensions.length === 0) {
    return "（未指定具体维度，请结合场景自行拆解若干维度）";
  }
  return dimensions
    .map(
      (dimension, index) =>
        `${index + 1}. ${dimension.name}${dimension.desc ? `：${dimension.desc}` : ""}`
    )
    .join("\n");
}

function buildGuide(
  dimensions: EvalDimension[],
  targetNames: string[]
): string {
  const targetsHint =
    targetNames.length > 0
      ? `\n本次将对比的目标：${targetNames.join("、")}。`
      : "";
  return `你是一个测评专家。请根据用户描述的测评场景与下方「评价维度」，生成一段「评价 Prompt」，这段 Prompt 将用于让裁判大模型对多个模型/算法的输出做横向对比打分。

=== 评价维度（裁判须逐项打分）===
${buildDimensionsBlock(dimensions)}
=== 结束 ===${targetsHint}

要求：
- 直接输出这段评价 Prompt 本身，不要任何额外解释、不要 markdown 代码块标记。
- Prompt 中应明确：裁判须对每个目标、在上述每一个维度上单独打分（0-10 分，可含一位小数），并为每个维度给出一句简短理由。
- 明确要求：不要计算总分、不要加权汇总，各维度独立评分即可。
- 还应要求裁判给出总体结论与推荐项（纯文字，非分数）。
- 语言简洁、可操作，便于裁判模型稳定执行。`;
}

export async function generateEvalPrompt(
  scenario: string,
  baseModel: BaseModelConfig,
  dimensions: EvalDimension[] = [],
  targetNames: string[] = []
): Promise<string> {
  const guide = buildGuide(dimensions, targetNames);
  const prompt = `${guide}\n\n=== 用户测评场景/要求 ===\n${scenario}\n=== 结束 ===`;
  const output = await chatWithModel({ baseModel, prompt });
  return output.outputText.trim();
}
