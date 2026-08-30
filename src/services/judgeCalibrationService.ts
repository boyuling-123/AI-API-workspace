import type { GoldenHumanLabel } from "@/types";
import { MAX_CALIBRATION_CRITERIA_LENGTH } from "@/lib/judgeCalibrationRerun";
import { redactSensitiveText } from "@/lib/redactSensitive";
import { chatWithModel } from "@/services/llmClient";

export const MAX_CALIBRATION_CASE_ID_LENGTH = 160;
export const MAX_CALIBRATION_TEXT_LENGTH = 100_000;
export const MAX_CALIBRATION_MODEL_ID_LENGTH = 160;

export interface JudgeCalibrationInputItem {
  caseId: string;
  prompt: string;
  candidateOutput: string;
  expectedAnswer?: string;
}

export interface JudgeCalibrationJudgment {
  caseId: string;
  judgeLabel: GoldenHumanLabel;
  confidence: number;
  reason: string;
}

export class JudgeCalibrationValidationError extends Error {}

function requiredText(
  value: unknown,
  label: string,
  maxLength: number
): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new JudgeCalibrationValidationError(`${label}不能为空`);
  }
  const normalized = redactSensitiveText(value.trim());
  if (normalized.length > maxLength) {
    throw new JudgeCalibrationValidationError(
      `${label}不能超过 ${maxLength} 个字符`
    );
  }
  return normalized;
}

function optionalText(
  value: unknown,
  label: string,
  maxLength: number
): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string") {
    throw new JudgeCalibrationValidationError(`${label}必须是字符串`);
  }
  const normalized = redactSensitiveText(value.trim());
  if (!normalized) return undefined;
  if (normalized.length > maxLength) {
    throw new JudgeCalibrationValidationError(
      `${label}不能超过 ${maxLength} 个字符`
    );
  }
  return normalized;
}

/** 白名单重建输入，调用方多传的 humanLabel/reviewerNote 不会进入 Judge Prompt。 */
export function parseJudgeCalibrationInput(
  raw: unknown
): JudgeCalibrationInputItem {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new JudgeCalibrationValidationError("缺少待校准的 Case");
  }
  const source = raw as Record<string, unknown>;
  return {
    caseId: requiredText(
      source.caseId,
      "Case ID",
      MAX_CALIBRATION_CASE_ID_LENGTH
    ),
    prompt: requiredText(source.prompt, "输入", MAX_CALIBRATION_TEXT_LENGTH),
    candidateOutput: requiredText(
      source.candidateOutput,
      "候选输出",
      MAX_CALIBRATION_TEXT_LENGTH
    ),
    expectedAnswer: optionalText(
      source.expectedAnswer,
      "标准答案",
      MAX_CALIBRATION_TEXT_LENGTH
    ),
  };
}

export function parseJudgeCalibrationCriteria(raw: unknown): string {
  return requiredText(raw, "校准判定标准", MAX_CALIBRATION_CRITERIA_LENGTH);
}

export function parseJudgeCalibrationModelId(raw: unknown): string {
  return requiredText(raw, "裁判模型 modelId", MAX_CALIBRATION_MODEL_ID_LENGTH);
}

export function buildJudgeCalibrationPrompt(
  item: JudgeCalibrationInputItem,
  criteria: string
): string {
  const expectedBlock = item.expectedAnswer
    ? `\n\n=== 标准答案 ===\n${item.expectedAnswer}\n=== 结束 ===`
    : "";
  return `你是一个严格、独立的二分类测评裁判。请判断候选输出是否满足判定标准。你看不到人工标签，也不得猜测人工标注者的选择。

=== 校准判定标准 ===
${criteria}
=== 结束 ===

=== 输入 ===
${item.prompt}
=== 结束 ===

=== 候选输出 ===
${item.candidateOutput}
=== 结束 ===${expectedBlock}

请严格只输出一个 JSON 对象，不要 Markdown 或额外解释：
{"label":"pass 或 fail","confidence":0到1之间的数字,"reason":"简短且可核验的判定理由"}

label=pass 表示候选输出满足标准，label=fail 表示不满足标准。`;
}

function extractJsonObject(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) return fenced[1].trim();
  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  return firstBrace >= 0 && lastBrace > firstBrace
    ? trimmed.slice(firstBrace, lastBrace + 1)
    : trimmed;
}

function normalizeLabel(value: unknown): GoldenHumanLabel | null {
  if (typeof value === "boolean") return value ? "pass" : "fail";
  const normalized = String(value ?? "").trim().toLowerCase();
  if (["pass", "通过", "true", "1", "yes"].includes(normalized)) return "pass";
  if (["fail", "不通过", "false", "0", "no"].includes(normalized)) return "fail";
  return null;
}

function parseJudgment(
  outputText: string,
  caseId: string
): JudgeCalibrationJudgment {
  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJsonObject(outputText));
  } catch {
    throw new Error(
      `Judge 返回内容无法解析为 JSON。原始片段：${redactSensitiveText(outputText.slice(0, 200))}`
    );
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Judge 返回结果必须是 JSON 对象");
  }
  const source = parsed as Record<string, unknown>;
  const judgeLabel = normalizeLabel(source.label);
  if (!judgeLabel) throw new Error("Judge 返回的 label 必须是 pass 或 fail");
  const confidence = Number(source.confidence);
  if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) {
    throw new Error("Judge 返回的 confidence 必须是 0 到 1 之间的数字");
  }
  if (typeof source.reason !== "string" || !source.reason.trim()) {
    throw new Error("Judge 返回的 reason 不能为空");
  }
  const reason = redactSensitiveText(source.reason.trim());
  if (reason.length > 2_000) {
    throw new Error("Judge 返回的 reason 不能超过 2000 个字符");
  }
  return {
    caseId,
    judgeLabel,
    confidence: Math.round(confidence * 1_000) / 1_000,
    reason,
  };
}

export async function judgeGoldenCase(
  rawItem: unknown,
  rawModelId: unknown,
  rawCriteria: unknown,
  signal?: AbortSignal
): Promise<JudgeCalibrationJudgment> {
  const item = parseJudgeCalibrationInput(rawItem);
  const modelId = parseJudgeCalibrationModelId(rawModelId);
  const criteria = parseJudgeCalibrationCriteria(rawCriteria);
  const output = await chatWithModel(
    { modelId, prompt: buildJudgeCalibrationPrompt(item, criteria) },
    signal
  );
  return parseJudgment(output.outputText, item.caseId);
}
