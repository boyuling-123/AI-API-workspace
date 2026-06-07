import { NextResponse } from "next/server";
import { evaluateOneInput } from "@/services/evaluateService";
import type { EvaluateInputItem } from "@/services/evaluateService";
import type { BaseModelConfig, EvalDimension } from "@/types";

export const runtime = "nodejs";
export const maxDuration = 60;

interface EvaluateBody {
  item: EvaluateInputItem;
  evalPrompt: string;
  /** v4.8：前端传入的基础大模型完整配置（裁判模型）。 */
  baseModel: BaseModelConfig;
  /** 本次选定维度（v4.5），裁判须逐项打分。 */
  dimensions: EvalDimension[];
}

/**
 * 逐条评价路由（M9；v4.5 多维度）：一次处理一条输入，把该条各目标输出交给裁判模型横向对比，
 * 按每个维度独立打分（无总分）。并发由前端通过通用 Task Runner 按 Task.concurrency 管控，逐条调用本路由。
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
  if (!body.baseModel?.baseUrl || !body.baseModel?.apiKey || !body.baseModel?.modelName) {
    return NextResponse.json(
      { error: "缺少裁判模型配置（baseUrl/apiKey/modelName）" },
      { status: 400 }
    );
  }
  if (!Array.isArray(body.dimensions) || body.dimensions.length === 0) {
    return NextResponse.json({ error: "缺少评价维度 dimensions" }, { status: 400 });
  }

  try {
    const result = await evaluateOneInput(
      body.item,
      body.evalPrompt,
      body.baseModel,
      body.dimensions
    );
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "未知错误";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
