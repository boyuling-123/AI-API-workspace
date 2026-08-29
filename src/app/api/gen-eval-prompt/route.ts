import { NextResponse } from "next/server";
import { generateEvalPrompt } from "@/services/evalPromptService";
import type { EvalDimension } from "@/types";
import {
  EvaluationRubricValidationError,
  parseEvaluationRubrics,
} from "@/lib/evaluationRubric";

export const runtime = "nodejs";
export const maxDuration = 60;

interface GenEvalPromptBody {
  scenario: string;
  modelId: string;
  /** 本次选定维度（v4.5），裁判须逐项打分。 */
  dimensions?: EvalDimension[];
  /** 本次将对比的目标名单（v4.5）。 */
  targetNames?: string[];
}

/**
 * AI 自动生成评价 Prompt（M9 需求6；v4.5 按维度）：用户描述测评场景 + 选定维度
 * → 大模型生成可编辑的评价 Prompt 文案（要求按维度逐项打分、无总分）。
 */
export async function POST(request: Request) {
  let body: GenEvalPromptBody;
  try {
    body = (await request.json()) as GenEvalPromptBody;
  } catch {
    return NextResponse.json(
      { error: "请求体解析失败，需为合法 JSON" },
      { status: 400 }
    );
  }

  if (!body.scenario?.trim()) {
    return NextResponse.json({ error: "请描述测评场景/要求" }, { status: 400 });
  }
  if (!body.modelId) {
    return NextResponse.json({ error: "缺少生成模型 modelId" }, { status: 400 });
  }

  let dimensions: EvalDimension[];
  try {
    dimensions = parseEvaluationRubrics(body.dimensions);
  } catch (error) {
    const message =
      error instanceof EvaluationRubricValidationError
        ? error.message
        : "评价维度校验失败";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  try {
    const evalPrompt = await generateEvalPrompt(
      body.scenario,
      body.modelId,
      dimensions,
      body.targetNames ?? []
    );
    return NextResponse.json({ evalPrompt });
  } catch (error) {
    const message = error instanceof Error ? error.message : "未知错误";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
