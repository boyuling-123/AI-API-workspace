import { NextResponse } from "next/server";
import { evaluateOneInput } from "@/services/evaluateService";
import type { EvaluateInputItem } from "@/services/evaluateService";
import type { EvalDimension, EvaluationMode } from "@/types";
import {
  EvaluatorPolicyValidationError,
  parseEvaluatorPolicy,
} from "@/lib/evaluatorPolicy";

export const runtime = "nodejs";
export const maxDuration = 60;

interface EvaluateBody {
  item: EvaluateInputItem;
  evalPrompt: string;
  modelId: string;
  /** 本次选定维度（v4.5），裁判须逐项打分。 */
  dimensions: EvalDimension[];
  evaluationMode?: EvaluationMode;
}

/**
 * 逐条评价路由（M9；v4.5 多维度）：一次处理一条输入，把该条各目标输出交给裁判模型横向对比，
 * Judge 逐维度打分，服务端确定性汇总策略结果。并发由前端 Task Runner 管控。
 */
export async function POST(request: Request) {
  let body: EvaluateBody;
  try {
    body = (await request.json()) as EvaluateBody;
  } catch {
    return NextResponse.json(
      { error: "请求体解析失败，需为合法 JSON" },
      { status: 400 }
    );
  }

  if (!body.item?.inputId) {
    return NextResponse.json({ error: "缺少待评价的 item" }, { status: 400 });
  }
  if (!body.evalPrompt?.trim()) {
    return NextResponse.json({ error: "缺少评价 prompt" }, { status: 400 });
  }
  if (!body.modelId) {
    return NextResponse.json({ error: "缺少裁判模型 modelId" }, { status: 400 });
  }
  let dimensions: EvalDimension[];
  try {
    dimensions = parseEvaluatorPolicy(body.dimensions);
  } catch (error) {
    const message =
      error instanceof EvaluatorPolicyValidationError
        ? error.message
        : "评价维度校验失败";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  try {
    const result = await evaluateOneInput(
      body.item,
      body.evalPrompt,
      body.modelId,
      dimensions,
      body.evaluationMode ?? "comparison"
    );
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "未知错误";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
